"""Horarios de cursada estructurados (historia #48).

Lo que estos tests afirman, en orden de importancia:

- el contrato dejó de aceptar texto libre y ahora exige la lista de `horarios`;
- cada regla del rango se rechaza con `422` y no llega nunca a la derivación del texto;
- el docente no puede tener dos comisiones vigentes que se pisen, con comparación estricta, y la
  edición no se choca consigo misma;
- el texto `dias_horarios` que devuelve la API es el resumen de las filas, no lo que mandó el
  cliente.

Va contra PostgreSQL real porque los CHECK de `comision_horario` forman parte de lo que se prueba:
un validador de Pydantic que dejara pasar algo que la base rechaza tiene que fallar acá.
"""

from __future__ import annotations

import itertools

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogo import Comision
from app.models.enums import Modalidad
from app.models.padron import Docente, Usuario
from app.tests.factories import (
    crear_comision,
    crear_curso,
    crear_docente,
    crear_sede,
    crear_usuario_admin,
    encabezado_de_autorizacion,
    horarios,
    token_de_prueba,
)


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _cuerpo(curso_id: int, docente_id: int, **cambios: object) -> dict:
    """Cuerpo válido del alta de comisión, con el horario por defecto lunes y miércoles."""
    cuerpo = {
        "curso_id": curso_id,
        "docente_id": docente_id,
        "horarios": horarios("LUN MIE", inicio="19:00", fin="21:00"),
        "arancel": "52000.00",
        "cupo_maximo": 20,
        "fecha_inicio": "2026-03-02",
        "fecha_fin": "2026-07-03",
        "modalidad": Modalidad.PRESENCIAL.value,
    }
    cuerpo.update(cambios)
    return cuerpo


#: Los `crear_curso` del factory usan el mismo nombre por defecto, así que un test que arma más de
#: un curso necesita distinguirlos.
_SECUENCIA = itertools.count(1)


def _existente(
    session: Session,
    docente: Docente,
    *,
    curso=None,
    horarios_semana: list[tuple[str, str, str]],
    activo: bool = True,
) -> Comision:
    """Comisión ya guardada, sin sede y con el horario pedido.

    `con_sede=False` porque la sede del factory es única por nombre y un test que crea dos
    comisiones chocaría contra ella, que no es lo que está probando.
    """
    comision = crear_comision(
        session,
        curso=curso or crear_curso(session, nombre=f"Curso existente {next(_SECUENCIA)}"),
        docente=docente,
        con_sede=False,
        horarios_semana=horarios_semana,
    )
    if not activo:
        comision.activo = False
        session.flush()
    return comision


# ------------------------------------------------------------------ contrato


def test_el_alta_devuelve_los_horarios_y_el_texto_derivado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json=_cuerpo(
            curso.id,
            docente.id,
            sede_id=sede.id,
            horarios=[
                {"dia": "MAR", "inicio": "18:15", "fin": "21:30"},
                {"dia": "LUN", "inicio": "19:00", "fin": "21:00"},
            ],
        ),
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    # El orden de la respuesta es el de la semana, no el del cuerpo que mandó el cliente.
    assert [h["dia"] for h in cuerpo["horarios"]] == ["LUN", "MAR"]
    assert cuerpo["horarios"][1] == {"dia": "MAR", "inicio": "18:15", "fin": "21:30"}
    assert cuerpo["dias_horarios"] == "Lun 19-21hs, Mar 18:15-21:30hs"


def test_el_texto_libre_de_horarios_ya_no_es_parte_del_contrato(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """El campo viejo no se ignora: `extra="forbid"` lo rechaza."""
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)
    cuerpo = _cuerpo(curso.id, docente.id)
    cuerpo.pop("horarios")

    respuesta = cliente_admin.post(
        "/comisiones",
        json={**cuerpo, "dias_horarios": "Lunes y miércoles 19 a 21"},
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "dias_horarios" in respuesta.text


def test_guardar_sin_horarios_es_422(cliente_admin: TestClient, db_session: Session) -> None:
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post("/comisiones", json=_cuerpo(curso.id, docente.id, horarios=[]))

    assert respuesta.status_code == 422, respuesta.text
    assert "horario" in respuesta.text.lower()


@pytest.mark.parametrize(
    "horario",
    [
        {"dia": "LUN", "inicio": "19:10", "fin": "21:00"},
        {"dia": "LUN", "inicio": "19:00", "fin": "21:07"},
        {"dia": "LUN", "inicio": "05:45", "fin": "08:00"},
        {"dia": "LUN", "inicio": "21:30", "fin": "22:15"},
        {"dia": "LUN", "inicio": "21:00", "fin": "21:00"},
        {"dia": "LUN", "inicio": "21:00", "fin": "19:00"},
    ],
)
def test_un_rango_invalido_es_422(
    cliente_admin: TestClient, db_session: Session, horario: dict
) -> None:
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones", json=_cuerpo(curso.id, docente.id, horarios=[horario])
    )

    assert respuesta.status_code == 422, respuesta.text


def test_dos_rangos_del_mismo_dia_son_422(cliente_admin: TestClient, db_session: Session) -> None:
    """Con un rango por día, el día repetido es lo que hace imposible que dos rangos se pisen."""
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json=_cuerpo(
            curso.id,
            docente.id,
            horarios=[
                {"dia": "LUN", "inicio": "19:00", "fin": "21:00"},
                {"dia": "LUN", "inicio": "20:00", "fin": "22:00"},
            ],
        ),
    )

    assert respuesta.status_code == 422, respuesta.text


# ------------------------------------------------- choque de horario del docente


def test_el_choque_con_otra_comision_del_mismo_docente_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """El caso del criterio: mismo docente, otro curso, rangos que se pisan."""
    docente = crear_docente(db_session)
    merge = _existente(
        db_session, docente, horarios_semana=[("MAR", "19:00", "21:00")]
    )
    curso = crear_curso(db_session, nombre="Python Inicial")

    respuesta = cliente_admin.post(
        "/comisiones",
        json=_cuerpo(
            curso.id,
            docente.id,
            horarios=[{"dia": "MAR", "inicio": "20:00", "fin": "22:00"}],
        ),
    )

    assert respuesta.status_code == 409, respuesta.text
    assert merge.codigo in respuesta.text
    assert "Mar 19-21hs" in respuesta.text


def test_los_bordes_exactos_se_permiten(cliente_admin: TestClient, db_session: Session) -> None:
    """Una comisión que termina 18:30 y otra que empieza 18:30 no se pisan."""
    docente = crear_docente(db_session)
    _existente(db_session, docente, horarios_semana=[("JUE", "16:30", "18:30")])

    respuesta = cliente_admin.post(
        "/comisiones",
        json=_cuerpo(
            crear_curso(db_session, nombre="Python Inicial").id,
            docente.id,
            horarios=[{"dia": "JUE", "inicio": "18:30", "fin": "20:30"}],
        ),
    )

    assert respuesta.status_code == 201, respuesta.text


def test_el_mismo_horario_de_otro_docente_se_permite(
    cliente_admin: TestClient, db_session: Session
) -> None:
    otro = crear_docente(db_session, dni="30111223", email="otro.docente@techacademy.invalid")
    _existente(db_session, otro, horarios_semana=[("MAR", "19:00", "21:00")])
    curso = crear_curso(db_session, nombre="Python Inicial")
    nuevo = crear_docente(db_session, dni="30111224", email="nuevo.docente@techacademy.invalid")

    respuesta = cliente_admin.post("/comisiones", json=_cuerpo(curso.id, nuevo.id))

    assert respuesta.status_code == 201, respuesta.text


def test_la_comision_dada_de_baja_no_choca(cliente_admin: TestClient, db_session: Session) -> None:
    docente = crear_docente(db_session)
    _existente(
        db_session, docente, horarios_semana=[("MAR", "19:00", "21:00")], activo=False
    )

    respuesta = cliente_admin.post(
        "/comisiones",
        json=_cuerpo(
            crear_curso(db_session, nombre="Python Inicial").id,
            docente.id,
            horarios=[{"dia": "MAR", "inicio": "20:00", "fin": "22:00"}],
        ),
    )

    assert respuesta.status_code == 201, respuesta.text


# ------------------------------------------------------------------ edición


def _editar(docente: Docente, **cambios: object) -> dict:
    datos = {
        "docente_id": docente.id,
        "horarios": horarios("LUN MIE", inicio="18:00", fin="20:00"),
        "arancel": "48000.00",
        "cupo_maximo": 25,
        "fecha_inicio": "2026-03-02",
        "fecha_fin": "2026-07-03",
    }
    datos.update(cambios)
    return datos


def test_la_edicion_no_choca_consigo_misma(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """Reenviar los horarios actuales no puede ser un conflicto contra la propia comisión."""
    docente = crear_docente(db_session)
    comision = _existente(
        db_session,
        docente,
        horarios_semana=[("LUN", "18:00", "20:00"), ("MIE", "18:00", "20:00")],
    )

    respuesta = cliente_admin.put(f"/comisiones/{comision.id}", json=_editar(docente))

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["dias_horarios"] == "Lun y Mié 18-20hs"


def test_la_edicion_rechaza_el_choque_con_otra_comision(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(db_session)
    curso = crear_curso(db_session)
    mover = _existente(
        db_session, docente, curso=curso, horarios_semana=[("LUN", "09:00", "11:00")]
    )
    fija = _existente(
        db_session, docente, curso=curso, horarios_semana=[("LUN", "18:00", "20:00")]
    )

    respuesta = cliente_admin.put(
        f"/comisiones/{mover.id}",
        json=_editar(docente, horarios=horarios("LUN", inicio="19:00", fin="21:00")),
    )

    assert respuesta.status_code == 409, respuesta.text
    assert fija.codigo in respuesta.text
