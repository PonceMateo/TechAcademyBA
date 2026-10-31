"""Edición de una comisión del catálogo (HU #4).

Corre contra PostgreSQL real (D15). Lo que se afirma:

- la edición conserva el `id`, el código derivado y las inscripciones de la comisión;
- el cupo se compara contra las inscripciones **ACTIVA** y una reducción por debajo de ellas se
  rechaza con la cantidad actual;
- `EN_ESPERA`, `BAJA` y `COMPLETADA` no ocupan banco;
- el curso, el número, la modalidad, la sede y el código no son parte del contrato: mandarlos
  responde `422` y la comisión conserva esos valores;
- un docente o una comisión inexistentes responden `404`, y las rutas son solo de Administración.
"""

from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogo import Comision
from app.models.enums import EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Docente, Usuario
from app.schemas.catalogo import ComisionUpdate
from app.services import catalogo
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_docente,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
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


#: Secuencia de documentos y correos: `crear_alumno` y `crear_docente` tienen valores por
#: defecto, así que un test que crea más de uno necesita distinguirlos.
_SECUENCIA = itertools.count(1)


def _docente(session: Session, **cambios: object) -> Docente:
    """Docente válido con DNI y correo únicos dentro de la corrida."""
    numero = next(_SECUENCIA)
    datos = {
        "dni": f"30{numero:06d}",
        "email": f"docente{numero}@techacademy.invalid",
    }
    datos.update(cambios)
    return crear_docente(session, **datos)


def _datos(docente: Docente, **cambios: object) -> dict:
    """Cuerpo válido de la edición, con los datos que admite el contrato (historias #4 y #49)."""
    datos = {
        "docente_id": docente.id,
        "horarios": horarios("MAR JUE", inicio="19:00", fin="21:00"),
        "arancel": "48000.00",
        "cupo_maximo": 25,
        "fecha_inicio": "2026-03-02",
        "fecha_fin": "2026-07-03",
    }
    datos.update(cambios)
    return datos


def _inscribir(
    session: Session,
    comision: Comision,
    cantidad: int,
    estado: str = EstadoInscripcion.ACTIVA.value,
) -> list[Inscripcion]:
    """Inscribe `cantidad` alumnos distintos en la comisión, con el estado pedido."""
    alumnos = [
        crear_alumno(
            session,
            nombre=f"Alumno {next(_SECUENCIA)}",
            documento=f"30{next(_SECUENCIA):06d}",
            email=f"alumno{next(_SECUENCIA)}@techacademy.invalid",
        )
        for _ in range(cantidad)
    ]
    return [
        crear_inscripcion(session, comision=comision, alumno=alumno, estado=estado)
        for alumno in alumnos
    ]


# ------------------------------------------------------------------- servicio


def test_editar_comision_actualiza_los_cuatro_datos_y_conserva_el_resto(
    db_session: Session,
) -> None:
    """HU #4: corregir la oferta no reasigna la comisión ni toca su historial."""
    curso = crear_curso(db_session, nombre="Python Inicial")
    comision = crear_comision(db_session, curso=curso)
    docente = _docente(db_session)
    inscripcion = _inscribir(db_session, comision, 1)[0]
    db_session.refresh(comision)
    codigo = comision.codigo

    actualizada = catalogo.editar_comision(
        db_session, comision, ComisionUpdate(**_datos(docente))
    )

    assert actualizada.id == comision.id
    assert actualizada.codigo == codigo
    assert actualizada.curso_id == curso.id
    assert actualizada.docente_id == docente.id
    assert actualizada.dias_horarios == "Mar y Jue 19-21hs"
    assert actualizada.arancel == Decimal("48000.00")
    assert actualizada.cupo_maximo == 25
    assert db_session.get(Inscripcion, inscripcion.id).comision_id == comision.id


def test_editar_comision_recalcula_las_vacantes(db_session: Session) -> None:
    comision = crear_comision(db_session, cupo_maximo=10)
    _inscribir(db_session, comision, 3)
    docente = _docente(db_session)

    actualizada = catalogo.editar_comision(
        db_session, comision, ComisionUpdate(**_datos(docente, cupo_maximo=8))
    )

    assert actualizada.vacantes == 5


def test_reducir_el_cupo_hasta_los_inscriptos_es_aceptado(db_session: Session) -> None:
    comision = crear_comision(db_session, cupo_maximo=30)
    _inscribir(db_session, comision, 15)
    docente = _docente(db_session)

    actualizada = catalogo.editar_comision(
        db_session, comision, ComisionUpdate(**_datos(docente, cupo_maximo=15))
    )

    assert actualizada.cupo_maximo == 15
    assert actualizada.vacantes == 0


def test_cupo_por_debajo_de_los_inscriptos_es_rechazado_con_la_cantidad(
    db_session: Session,
) -> None:
    comision = crear_comision(db_session, cupo_maximo=30)
    _inscribir(db_session, comision, 15)
    docente = _docente(db_session)

    with pytest.raises(catalogo.CupoInsuficiente) as error:
        catalogo.editar_comision(
            db_session, comision, ComisionUpdate(**_datos(docente, cupo_maximo=14))
        )

    assert error.value.inscriptos == 15
    assert "15" in str(error.value)
    db_session.refresh(comision)
    assert comision.cupo_maximo == 30, "el cupo anterior no se toca cuando la edición se rechaza"


def test_las_inscripciones_en_espera_o_dadas_de_baja_no_ocupan_cupo(
    db_session: Session,
) -> None:
    comision = crear_comision(db_session, cupo_maximo=10)
    _inscribir(db_session, comision, 2)
    _inscribir(db_session, comision, 1, estado=EstadoInscripcion.EN_ESPERA.value)
    _inscribir(db_session, comision, 1, estado=EstadoInscripcion.BAJA.value)
    _inscribir(db_session, comision, 1, estado=EstadoInscripcion.COMPLETADA.value)
    docente = _docente(db_session)

    actualizada = catalogo.editar_comision(
        db_session, comision, ComisionUpdate(**_datos(docente, cupo_maximo=2))
    )

    assert actualizada.cupo_maximo == 2
    assert actualizada.vacantes == 0


def test_editar_comision_con_un_docente_inexistente(db_session: Session) -> None:
    comision = crear_comision(db_session)

    with pytest.raises(catalogo.DocenteNoEncontrado):
        catalogo.editar_comision(db_session, comision, ComisionUpdate(**_datos_nuevo(999999)))


def test_obtener_una_comision_inexistente(db_session: Session) -> None:
    with pytest.raises(catalogo.ComisionNoEncontrada):
        catalogo.obtener_comision(db_session, 999999)


def _datos_nuevo(docente_id: int, **cambios: object) -> dict:
    """Cuerpo válido con un `docente_id` explícito, para el caso del docente inexistente."""
    datos = {
        "docente_id": docente_id,
        "horarios": horarios("SAB", inicio="09:00", fin="12:00"),
        "arancel": "35000.00",
        "cupo_maximo": 20,
        "fecha_inicio": "2026-03-02",
        "fecha_fin": "2026-07-03",
    }
    datos.update(cambios)
    return datos


# ----------------------------------------------------------------------- API


def test_edicion_exitosa_devuelve_la_comision_actualizada(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = crear_comision(db_session, cupo_maximo=20)
    _inscribir(db_session, comision, 3)
    docente = _docente(db_session)
    db_session.refresh(comision)
    codigo = comision.codigo

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}", json=_datos(docente, cupo_maximo=12)
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == comision.id
    assert cuerpo["codigo"] == codigo
    assert cuerpo["docente_id"] == docente.id
    assert cuerpo["docente_nombre"] == f"{docente.nombre} {docente.apellido}"
    assert cuerpo["dias_horarios"] == "Mar y Jue 19-21hs"
    assert cuerpo["arancel"] == "48000.00"
    assert cuerpo["cupo_maximo"] == 12
    assert cuerpo["vacantes"] == 9


def test_cupo_por_debajo_de_los_inscriptos_da_422_con_la_cantidad(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = crear_comision(db_session, cupo_maximo=30)
    _inscribir(db_session, comision, 15)
    docente = _docente(db_session)

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}", json=_datos(docente, cupo_maximo=14)
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "15" in respuesta.json()["detail"]
    db_session.expire_all()
    assert db_session.get(Comision, comision.id).cupo_maximo == 30


def test_reducir_el_cupo_hasta_los_inscriptos_deja_vacantes_en_cero(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = crear_comision(db_session, cupo_maximo=30)
    _inscribir(db_session, comision, 4)
    docente = _docente(db_session)

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}", json=_datos(docente, cupo_maximo=4)
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["vacantes"] == 0


@pytest.mark.parametrize(
    "fuera_del_contrato",
    [
        {"curso_id": 1},
        {"numero": 7},
        {"modalidad": "VIRTUAL"},
        {"sede_id": 1},
        {"codigo": "CUR001-9"},
    ],
)
def test_los_campos_fuera_del_contrato_dan_422_y_no_cambian_nada(
    cliente_admin: TestClient, db_session: Session, fuera_del_contrato: dict
) -> None:
    """D51: cambiar el curso, el número, la modalidad o la sede no es parte de esta historia."""
    comision = crear_comision(db_session, cupo_maximo=20)
    docente = _docente(db_session)
    db_session.refresh(comision)
    dias_originales = comision.dias_horarios

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}", json=_datos(docente, **fuera_del_contrato)
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.expire_all()
    guardada = db_session.get(Comision, comision.id)
    assert guardada.dias_horarios == dias_originales
    assert guardada.numero == 1
    assert guardada.modalidad == comision.modalidad


@pytest.mark.parametrize(
    "cambios",
    [
        {"cupo_maximo": 0},
        {"cupo_maximo": -3},
        {"arancel": "0.00"},
        {"arancel": "-10.00"},
        {"horarios": []},
        {"horarios": horarios("LUN", inicio="19:00", fin="19:00")},
    ],
)
def test_datos_invalidos_dan_422(
    cliente_admin: TestClient, db_session: Session, cambios: dict
) -> None:
    comision = crear_comision(db_session, cupo_maximo=20)
    docente = _docente(db_session)

    respuesta = cliente_admin.put(f"/comisiones/{comision.id}", json=_datos(docente, **cambios))

    assert respuesta.status_code == 422, respuesta.text


def test_comision_inexistente_da_404(cliente_admin: TestClient, db_session: Session) -> None:
    docente = _docente(db_session)

    respuesta = cliente_admin.put("/comisiones/999999", json=_datos(docente))

    assert respuesta.status_code == 404, respuesta.text


def test_docente_inexistente_da_404(cliente_admin: TestClient, db_session: Session) -> None:
    comision = crear_comision(db_session)

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}", json=_datos_nuevo(999999)
    )

    assert respuesta.status_code == 404, respuesta.text
    assert "999999" in respuesta.json()["detail"]


def test_editar_sin_token_es_401(api_client: TestClient, db_session: Session) -> None:
    comision = crear_comision(db_session)
    docente = _docente(db_session)

    respuesta = api_client.put(f"/comisiones/{comision.id}", json=_datos(docente))

    assert respuesta.status_code == 401


@pytest.mark.parametrize("rol", ["docente", "alumno"])
def test_editar_exige_rol_de_administracion(
    api_client: TestClient, db_session: Session, rol: str
) -> None:
    comision = crear_comision(db_session, cupo_maximo=20)
    docente = _docente(db_session)
    cuenta = (
        crear_usuario_docente(db_session)
        if rol == "docente"
        else crear_usuario_alumno(db_session)
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))

    respuesta = api_client.put(
        f"/comisiones/{comision.id}", json=_datos(docente, cupo_maximo=1)
    )

    assert respuesta.status_code == 403
    assert respuesta.headers["X-Roles-Admitidos"] == "ADMIN"
    db_session.expire_all()
    assert db_session.get(Comision, comision.id).cupo_maximo == 20


# ------------------------------------------------------ período de cursada (HU 49) ---------------


def test_editar_el_periodo_lo_guarda_y_no_toca_las_inscripciones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D62: el período nuevo se persiste y las inscripciones quedan como estaban.

    Del lunes 6 de abril al viernes 7 de agosto de 2026 hay 36 clases de martes y jueves, que es
    el horario que manda `_datos`.
    """
    comision = crear_comision(db_session, cupo_maximo=20)
    inscripcion = _inscribir(db_session, comision, 1)[0]
    docente = _docente(db_session)
    estado_anterior = inscripcion.estado

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}",
        json=_datos(docente, fecha_inicio="2026-04-06", fecha_fin="2026-08-07"),
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["fecha_inicio"] == "2026-04-06"
    assert cuerpo["fecha_fin"] == "2026-08-07"
    assert cuerpo["cantidad_clases"] == 36
    db_session.refresh(inscripcion)
    assert inscripcion.comision_id == comision.id
    assert inscripcion.estado == estado_anterior


def test_un_periodo_invalido_conserva_las_fechas_anteriores(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """Escenario «Período inválido en la edición»: 422 y la comisión conserva su período."""
    comision = crear_comision(
        db_session, fecha_inicio=date(2026, 3, 2), fecha_fin=date(2026, 7, 3)
    )
    docente = _docente(db_session)

    respuesta = cliente_admin.put(
        f"/comisiones/{comision.id}",
        json=_datos(docente, fecha_inicio="2026-07-03", fecha_fin="2026-03-02"),
    )

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"] == "La fecha de fin no puede ser anterior a la de inicio."
    db_session.refresh(comision)
    assert comision.fecha_inicio == date(2026, 3, 2)
    assert comision.fecha_fin == date(2026, 7, 3)


def test_una_comision_heredada_no_se_guarda_sin_periodo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """La edición exige el período: una comisión del legado no se guarda sin fechas."""
    comision = crear_comision(db_session)
    docente = _docente(db_session)
    cuerpo = {
        clave: valor for clave, valor in _datos(docente).items() if not clave.startswith("fecha_")
    }

    respuesta = cliente_admin.put(f"/comisiones/{comision.id}", json=cuerpo)

    assert respuesta.status_code == 422, respuesta.text
    db_session.refresh(comision)
    assert comision.fecha_inicio is None
    assert comision.fecha_fin is None
