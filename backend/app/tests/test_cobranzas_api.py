"""Cobranzas manuales contra PostgreSQL real (HU 21)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cobranza import Cobranza, Imputacion, Pagador
from app.models.enums import EstadoCobranza, EstadoInscripcion
from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_docente,
    cuit_valido,
    encabezado_de_autorizacion,
    token_de_prueba,
)


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def admin_headers(admin: Usuario) -> dict[str, str]:
    return encabezado_de_autorizacion(token_de_prueba(admin))


@pytest.fixture
def alumno_inscripto(db_session: Session):
    alumno = crear_alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno)
    return alumno, inscripcion


def pago(**cambios):
    datos = {
        "fecha": (date.today() - timedelta(days=1)).isoformat(),
        "importe": "45000.00",
        "medio": "EFECTIVO",
        "titular": "Juan Ignacio Pérez",
        "estado": EstadoCobranza.ACREDITADO.value,
        "alumno_id": None,
        "inscripcion_id": None,
    }
    datos.update(cambios)
    return datos


def test_post_exitoso_persiste_en_postgresql(
    api_client: TestClient, db_session: Session, admin_headers, alumno_inscripto
) -> None:
    alumno, inscripcion = alumno_inscripto

    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=inscripcion.id),
    )
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["pagador"]["nombre"] == "Juan Ignacio Pérez"
    assert float(cuerpo["importe"]) == 45000.0
    assert cuerpo["factura"] is None

    # Persistencia: la fila sigue en la base aun después de expirar la sesión.
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, cuerpo["id"])
    assert cobranza is not None
    assert cobranza.importe == Decimal("45000.00")


def test_get_recupera_el_pago_registrado(
    api_client: TestClient, admin_headers, alumno_inscripto
) -> None:
    alumno, inscripcion = alumno_inscripto
    creada = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=inscripcion.id),
    )
    assert creada.status_code == 201, creada.text

    respuesta = api_client.get("/cobranzas", headers=admin_headers)
    assert respuesta.status_code == 200, respuesta.text
    filas = respuesta.json()
    assert len(filas) == 1
    assert filas[0]["id"] == creada.json()["id"]
    assert filas[0]["imputacion"]["alumno"] == alumno.nombre
    assert filas[0]["imputacion"]["comision"]["codigo"] == inscripcion.comision.codigo


def test_imputacion_queda_en_la_inscripcion_del_alumno(
    api_client: TestClient, db_session: Session, admin_headers, alumno_inscripto
) -> None:
    alumno, inscripcion = alumno_inscripto
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=inscripcion.id),
    )
    assert respuesta.status_code == 201, respuesta.text

    imputacion = db_session.scalar(select(Imputacion))
    assert imputacion is not None
    assert imputacion.inscripcion_id == inscripcion.id
    assert imputacion.monto == Decimal("45000.00")


@pytest.mark.parametrize("importe", ["0", "-10"])
def test_importe_cero_o_negativo_es_rechazado(
    api_client: TestClient, db_session: Session, admin_headers, importe: str
) -> None:
    respuesta = api_client.post(
        "/cobranzas", headers=admin_headers, json=pago(importe=importe)
    )
    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(Cobranza)) is None


def test_fecha_futura_es_rechazada(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(fecha=(date.today() + timedelta(days=1)).isoformat()),
    )
    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(Cobranza)) is None


@pytest.mark.parametrize("campo", ["fecha", "importe", "medio", "titular"])
def test_campos_obligatorios_faltantes(
    api_client: TestClient, db_session: Session, admin_headers, campo: str
) -> None:
    datos = pago()
    datos.pop(campo)

    respuesta = api_client.post("/cobranzas", headers=admin_headers, json=datos)
    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(Cobranza)) is None


def test_estado_no_acreditado_exige_causa(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(estado=EstadoCobranza.OBSERVADO.value),
    )
    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(Cobranza)) is None


def test_alumno_con_varias_inscripciones_debe_elegir(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    alumno = crear_alumno(db_session)
    primera = crear_inscripcion(db_session, alumno=alumno)
    segunda_comision = crear_comision(
        db_session, curso=primera.comision.curso, sede=primera.comision.sede
    )
    crear_inscripcion(db_session, alumno=alumno, comision=segunda_comision)

    sin_elegir = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id),
    )
    assert sin_elegir.status_code == 422, sin_elegir.text
    assert "varias inscripciones" in sin_elegir.json()["detail"]

    elegida = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=primera.id),
    )
    assert elegida.status_code == 201, elegida.text


def test_alumno_sin_inscripciones_activas_es_rechazado(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    alumno = crear_alumno(db_session)
    crear_inscripcion(
        db_session, alumno=alumno, estado=EstadoInscripcion.BAJA.value
    )

    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id),
    )
    assert respuesta.status_code == 422, respuesta.text
    assert "inscripción activa" in respuesta.json()["detail"]


def test_inscripcion_de_otro_alumno_es_rechazada(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    alumno = crear_alumno(db_session)
    otro = crear_alumno(
        db_session, documento="40111222", email="otro@techacademy.invalid"
    )
    inscripcion_de_otro = crear_inscripcion(db_session, alumno=otro)

    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=inscripcion_de_otro.id),
    )
    assert respuesta.status_code == 422, respuesta.text
    assert "no pertenece" in respuesta.json()["detail"]


def test_factura_a_exige_cuit_valido_y_lo_persiste(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    sin_cuit = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(factura_a_solicitada=True),
    )
    assert sin_cuit.status_code == 422, sin_cuit.text

    cuit = cuit_valido()
    con_cuit = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(factura_a_solicitada=True, cuit_titular=cuit),
    )
    assert con_cuit.status_code == 201, con_cuit.text
    assert con_cuit.json()["factura"] == "A"

    db_session.expire_all()
    cobranza = db_session.scalar(select(Cobranza))
    assert cobranza.factura_a_solicitada is True
    pagador = db_session.scalar(select(Pagador))
    assert pagador.documento_norm == cuit


def test_get_busca_por_titular_con_coincidencia_parcial(
    api_client: TestClient, admin_headers
) -> None:
    api_client.post("/cobranzas", headers=admin_headers, json=pago(titular="Ana Gómez"))
    api_client.post(
        "/cobranzas", headers=admin_headers, json=pago(titular="Carlos Ruiz")
    )

    respuesta = api_client.get("/cobranzas?q=gómez", headers=admin_headers)
    assert respuesta.status_code == 200, respuesta.text
    filas = respuesta.json()
    assert [fila["pagador"]["nombre"] for fila in filas] == ["Ana Gómez"]


def test_permisos_de_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    assert api_client.get("/cobranzas").status_code == 401

    docente = crear_usuario_docente(db_session)
    headers = encabezado_de_autorizacion(token_de_prueba(docente))
    assert api_client.get("/cobranzas", headers=headers).status_code == 403
    assert api_client.post("/cobranzas", headers=headers, json=pago()).status_code == 403


def test_inscripciones_activas_del_alumno(
    api_client: TestClient, admin_headers, alumno_inscripto
) -> None:
    alumno, inscripcion = alumno_inscripto

    respuesta = api_client.get(
        f"/alumnos/{alumno.id}/inscripciones", headers=admin_headers
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == [
        {
            "id": inscripcion.id,
            "estado": EstadoInscripcion.ACTIVA.value,
            "comision": {
                "codigo": inscripcion.comision.codigo,
                "nombre": inscripcion.comision.curso.nombre,
            },
        }
    ]
