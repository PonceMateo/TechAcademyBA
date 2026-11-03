"""Inscripciones contra PostgreSQL real (HU #14)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import CategoriaInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Usuario
from app.services.inscripciones import ProrrateoNoDisponible, calcular_importe_arancel
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_empresa,
    crear_inscripcion,
    crear_usuario_admin,
    encabezado_de_autorizacion,
    token_de_prueba,
)


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _periodo_actual() -> dict[str, date]:
    """Período que contiene la fecha de hoy, para que el prorrateo tenga clases restantes."""
    return {"fecha_inicio": date.today(), "fecha_fin": date.today() + timedelta(days=60)}


def test_inscripcion_exitosa_descuenta_vacante(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=2, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "ACTIVA"
    assert cuerpo["categoria"] == "PARTICULAR"

    listado = cliente_admin.get("/comisiones").json()
    fila = next(item for item in listado if item["id"] == comision.id)
    assert fila["vacantes"] == 1


def test_inscripcion_repetida_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    primera = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert primera.status_code == 201

    segunda = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert segunda.status_code == 409


def test_no_inscribe_en_una_comision_finalizada(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """H/U 70: el alta se rechaza con 422 y no deja ninguna fila."""
    curso = crear_curso(db_session)
    hoy = date.today()
    comision = crear_comision(
        db_session,
        curso=curso,
        cupo_maximo=5,
        fecha_inicio=hoy - timedelta(days=60),
        fecha_fin=hoy - timedelta(days=1),
    )
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"] == "La comisión ya finalizó."
    assert db_session.scalars(select(Inscripcion)).all() == []


def test_comision_completa_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=1, **_periodo_actual())
    alumno_uno = crear_alumno(db_session, email="uno@techacademy.invalid", documento="11111111")
    alumno_dos = crear_alumno(db_session, email="dos@techacademy.invalid", documento="22222222")

    primera = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno_uno.id, "comision_id": comision.id},
    )
    assert primera.status_code == 201

    segunda = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno_dos.id, "comision_id": comision.id},
    )
    assert segunda.status_code == 409


def test_alta_con_beca_parcial_guarda_el_porcentaje(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: el alta elige la categoría y guarda el porcentaje de la beca parcial."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "BECADO_PARCIAL",
            "porcentaje_beca": 50,
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["categoria"] == "BECADO_PARCIAL"
    assert Decimal(str(cuerpo["porcentaje_beca"])) == Decimal("50")


def test_alta_con_beca_parcial_sin_porcentaje_es_422(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: la beca parcial sin porcentaje se rechaza, igual que en el `PATCH`."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "BECADO_PARCIAL",
        },
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == "El porcentaje debe estar entre 1 y 99."


def test_alta_con_porcentaje_fuera_de_rango_es_422(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: un porcentaje de 100 no es una beca parcial válida."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "BECADO_PARCIAL",
            "porcentaje_beca": 100,
        },
    )

    assert respuesta.status_code == 422


def test_alta_corporativa_con_empresa(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: la inscripción corporativa nace con su empresa."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)
    empresa = crear_empresa(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "CORPORATIVO",
            "empresa_id": empresa.id,
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["empresa_id"] == empresa.id


def test_alta_corporativa_sin_empresa_es_422(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: no se puede crear una corporativa sin empresa."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "CORPORATIVO",
        },
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == "Seleccioná la empresa."


def test_alta_corporativa_con_empresa_inexistente_es_404(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: la empresa elegida tiene que existir."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": alumno.id,
            "comision_id": comision.id,
            "categoria": "CORPORATIVO",
            "empresa_id": 999999,
        },
    )

    assert respuesta.status_code == 404


def test_inscripciones_del_alumno_informan_la_categoria(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: el selector de Cobranzas distingue las inscripciones por su categoría."""
    comision = crear_comision(db_session, cupo_maximo=5, **_periodo_actual())
    alumno = crear_alumno(db_session)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_TOTAL.value,
    )

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}/inscripciones")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()[0]["categoria"] == "BECADO_TOTAL"


def test_calcula_alta_tardia_sin_aplicar_la_beca_al_importe_base(
    db_session: Session,
) -> None:
    """D77: el importe persistido es el base prorrateado; la beca se deriva después."""
    comision = crear_comision(
        db_session,
        arancel="52000.00",
        horarios_semana=[("LUN", "18:00", "20:00"), ("MIE", "18:00", "20:00")],
        fecha_inicio=date(2026, 1, 5),
        fecha_fin=date(2026, 1, 30),
    )

    importe = calcular_importe_arancel(
        comision,
        CategoriaInscripcion.BECADO_PARCIAL.value,
        hoy=date(2026, 1, 19),
    )

    assert importe == Decimal("26000.00")


def test_calcula_arancel_completo_antes_del_inicio(db_session: Session) -> None:
    comision = crear_comision(
        db_session,
        arancel="52000.00",
        fecha_inicio=date(2026, 1, 5),
        fecha_fin=date(2026, 1, 30),
    )

    importe = calcular_importe_arancel(
        comision,
        CategoriaInscripcion.PARTICULAR.value,
        hoy=date(2026, 1, 5),
    )

    assert importe == Decimal("52000.00")


def test_rechaza_prorrateo_sin_periodo(db_session: Session) -> None:
    comision = crear_comision(db_session, fecha_inicio=None, fecha_fin=None)

    with pytest.raises(ProrrateoNoDisponible):
        calcular_importe_arancel(
            comision,
            CategoriaInscripcion.PARTICULAR.value,
            hoy=date(2026, 1, 19),
        )


def _monto_requerido(cliente: TestClient, alumno_id: int) -> Decimal:
    """El monto requerido que la ficha deriva para la única inscripción del alumno."""
    respuesta = cliente.get(f"/alumnos/{alumno_id}")
    assert respuesta.status_code == 200, respuesta.text
    [fila] = respuesta.json()["inscripciones"]
    return Decimal(fila["monto_requerido"])


def test_el_cambio_de_categoria_aplica_la_beca_sobre_el_base_prorrateado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """Issue #111: la beca se deriva del base guardado, no de un importe final congelado."""
    hoy = date.today()
    comision = crear_comision(
        db_session,
        arancel="52000.00",
        cupo_maximo=5,
        horarios_semana=[("LUN", "18:00", "20:00"), ("MIE", "18:00", "20:00")],
        fecha_inicio=hoy - timedelta(days=14),
        fecha_fin=hoy + timedelta(days=30),
    )
    particular = crear_alumno(db_session)
    becado = crear_alumno(
        db_session,
        documento="40999888",
        email="becado@techacademy.invalid",
    )

    alta_particular = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": particular.id, "comision_id": comision.id},
    )
    assert alta_particular.status_code == 201, alta_particular.text
    alta_becado = cliente_admin.post(
        "/inscripciones",
        json={
            "alumno_id": becado.id,
            "comision_id": comision.id,
            "categoria": CategoriaInscripcion.BECADO_PARCIAL.value,
            "porcentaje_beca": 50,
        },
    )
    assert alta_becado.status_code == 201, alta_becado.text

    base = _monto_requerido(cliente_admin, particular.id)
    esperado_con_beca = (base / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert base < Decimal("52000.00"), "el alta tardía tiene que estar prorrateada"
    assert _monto_requerido(cliente_admin, becado.id) == esperado_con_beca

    a_beca = cliente_admin.patch(
        f"/inscripciones/{alta_particular.json()['id']}",
        json={"categoria": CategoriaInscripcion.BECADO_PARCIAL.value, "porcentaje_beca": 50},
    )
    assert a_beca.status_code == 200, a_beca.text
    assert _monto_requerido(cliente_admin, particular.id) == esperado_con_beca

    a_particular = cliente_admin.patch(
        f"/inscripciones/{alta_particular.json()['id']}",
        json={"categoria": CategoriaInscripcion.PARTICULAR.value},
    )
    assert a_particular.status_code == 200, a_particular.text
    assert _monto_requerido(cliente_admin, particular.id) == base


def test_alta_tardia_invalida_no_guarda_inscripcion(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = crear_comision(db_session, fecha_inicio=None, fecha_fin=None)
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )

    assert respuesta.status_code == 422
    assert (
        db_session.query(Inscripcion)
        .filter_by(alumno_id=alumno.id, comision_id=comision.id)
        .count()
        == 0
    )
