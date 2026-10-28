"""Edición del estado de una cobranza (ampliación de la HU 21).

Contra PostgreSQL real, como el resto de las pruebas del backend: el cambio de estado escribe
`cobranza.estado_cambiado_*` y `audit_log`, y las dos cosas dependen de la base.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.clases import AuditLog
from app.models.cobranza import Cobranza, Imputacion, Pagador
from app.models.enums import EstadoCobranza
from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

JUSTIFICACION = "El banco confirmó la acreditación del cheque."


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def admin_headers(admin: Usuario) -> dict[str, str]:
    return encabezado_de_autorizacion(token_de_prueba(admin))


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


def registrar(api_client: TestClient, headers, estado: EstadoCobranza, **cambios) -> dict:
    respuesta = api_client.post(
        "/cobranzas",
        headers=headers,
        json=pago(estado=estado.value, causa="Comprobante ilegible", **cambios),
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def cambiar_estado(
    api_client: TestClient,
    headers,
    cobranza_id: int,
    estado: EstadoCobranza = EstadoCobranza.ACREDITADO,
    **cambios,
):
    cuerpo = {"estado": estado.value, "justificacion": JUSTIFICACION}
    cuerpo.update(cambios)
    return api_client.patch(f"/cobranzas/{cobranza_id}/estado", headers=headers, json=cuerpo)


@pytest.mark.parametrize(
    ("estado_inicial", "estado_nuevo"),
    [
        (EstadoCobranza.ACREDITADO, EstadoCobranza.OBSERVADO),
        (EstadoCobranza.ACREDITADO, EstadoCobranza.RECHAZADO),
        (EstadoCobranza.OBSERVADO, EstadoCobranza.ACREDITADO),
        (EstadoCobranza.OBSERVADO, EstadoCobranza.RECHAZADO),
        (EstadoCobranza.RECHAZADO, EstadoCobranza.ACREDITADO),
    ],
)
def test_cambio_de_estado_persiste(
    api_client: TestClient,
    db_session: Session,
    admin: Usuario,
    admin_headers,
    estado_inicial: EstadoCobranza,
    estado_nuevo: EstadoCobranza,
) -> None:
    creada = registrar(api_client, admin_headers, estado_inicial)

    respuesta = cambiar_estado(api_client, admin_headers, creada["id"], estado_nuevo)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == estado_nuevo.value
    assert respuesta.json()["id"] == creada["id"]

    # Persistencia: el estado sigue en PostgreSQL después de expirar la sesión.
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == estado_nuevo.value
    assert cobranza.estado_cambiado_por == admin.id
    assert cobranza.estado_cambiado_at is not None

    # El estado nuevo es el que devuelve el historial al recargar.
    historial = api_client.get("/cobranzas", headers=admin_headers)
    assert historial.json()[0]["estado"] == estado_nuevo.value


def test_pasar_a_no_acreditado_guarda_la_justificacion_como_causa(
    api_client: TestClient,
    db_session: Session,
    admin_headers,
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.ACREDITADO)

    respuesta = cambiar_estado(api_client, admin_headers, creada["id"], EstadoCobranza.OBSERVADO)

    assert respuesta.status_code == 200, respuesta.text
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == EstadoCobranza.OBSERVADO.value
    assert cobranza.causa == JUSTIFICACION


def test_registra_el_historial_de_la_modificacion(
    api_client: TestClient,
    db_session: Session,
    admin: Usuario,
    admin_headers,
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.OBSERVADO)

    cambiar_estado(api_client, admin_headers, creada["id"])

    db_session.expire_all()
    entrada = db_session.scalar(select(AuditLog))
    assert entrada is not None
    assert entrada.accion == "cobranza.estado_cambiado"
    assert entrada.entidad == "cobranza"
    assert entrada.entidad_id == creada["id"]
    assert entrada.usuario_id == admin.id
    assert entrada.created_at is not None

    detalle = json.loads(entrada.detalle)
    assert detalle["estado_anterior"] == EstadoCobranza.OBSERVADO.value
    assert detalle["estado_nuevo"] == EstadoCobranza.ACREDITADO.value
    assert detalle["justificacion"] == JUSTIFICACION
    assert detalle["fecha"] != ""


def test_cambio_al_mismo_estado_es_rechazado(
    api_client: TestClient,
    db_session: Session,
    admin_headers,
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.OBSERVADO)
    assert cambiar_estado(api_client, admin_headers, creada["id"]).status_code == 200

    repetida = cambiar_estado(api_client, admin_headers, creada["id"])

    assert repetida.status_code == 422, repetida.text
    assert "ya está en ese estado" in repetida.json()["detail"]
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 1


def test_transicion_no_permitida(
    api_client: TestClient,
    db_session: Session,
    admin_headers,
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.RECHAZADO)

    respuesta = cambiar_estado(api_client, admin_headers, creada["id"], EstadoCobranza.OBSERVADO)

    assert respuesta.status_code == 422, respuesta.text
    assert "No se puede pasar" in respuesta.json()["detail"]
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == EstadoCobranza.RECHAZADO.value
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 0


@pytest.mark.parametrize("justificacion", [None, "", "   "])
def test_la_justificacion_es_obligatoria(
    api_client: TestClient,
    db_session: Session,
    admin_headers,
    justificacion: str | None,
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.OBSERVADO)

    cuerpo = {"estado": EstadoCobranza.ACREDITADO.value}
    if justificacion is not None:
        cuerpo["justificacion"] = justificacion
    respuesta = api_client.patch(
        f"/cobranzas/{creada['id']}/estado", headers=admin_headers, json=cuerpo
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.expire_all()
    assert db_session.get(Cobranza, creada["id"]).estado == EstadoCobranza.OBSERVADO.value


def test_cobranza_inexistente(api_client: TestClient, db_session: Session, admin_headers) -> None:
    respuesta = cambiar_estado(api_client, admin_headers, 999999)

    assert respuesta.status_code == 404, respuesta.text
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 0


def test_permisos_de_administracion(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.OBSERVADO)
    ruta = f"/cobranzas/{creada['id']}/estado"
    cuerpo = {"estado": EstadoCobranza.ACREDITADO.value, "justificacion": JUSTIFICACION}

    assert api_client.patch(ruta, json=cuerpo).status_code == 401

    docente = crear_usuario_docente(db_session)
    headers = encabezado_de_autorizacion(token_de_prueba(docente))
    assert api_client.patch(ruta, headers=headers, json=cuerpo).status_code == 403

    db_session.expire_all()
    assert db_session.get(Cobranza, creada["id"]).estado == EstadoCobranza.OBSERVADO.value


def test_conserva_importe_titular_fecha_e_imputacion(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    alumno = crear_alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno)
    creada = registrar(
        api_client,
        admin_headers,
        EstadoCobranza.OBSERVADO,
        alumno_id=alumno.id,
        inscripcion_id=inscripcion.id,
    )

    respuesta = cambiar_estado(api_client, admin_headers, creada["id"])
    assert respuesta.status_code == 200, respuesta.text

    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.importe == Decimal("45000.00")
    assert cobranza.fecha == date.today() - timedelta(days=1)
    assert cobranza.pagador.nombre == "Juan Ignacio Pérez"

    imputacion = db_session.scalar(select(Imputacion))
    assert imputacion.cobranza_id == creada["id"]
    assert imputacion.inscripcion_id == inscripcion.id
    assert imputacion.monto == Decimal("45000.00")

    # No se agregó un cobro nuevo ni un pagador nuevo al cambiar el estado.
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 1
    assert db_session.scalar(select(func.count()).select_from(Pagador)) == 1
    assert db_session.scalar(select(func.count()).select_from(Imputacion)) == 1


def test_completa_el_titular_de_un_comprobante_sin_identificar(
    api_client: TestClient,
    db_session: Session,
    admin: Usuario,
    admin_headers,
) -> None:
    """El PATCH completa el titular sin exigir un cambio de estado."""
    creada = registrar(
        api_client, admin_headers, EstadoCobranza.ACREDITADO, titular="Sin identificar"
    )

    respuesta = api_client.patch(
        f"/cobranzas/{creada['id']}/estado",
        headers=admin_headers,
        json={"titular": "María López"},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["pagador"]["nombre"] == "María López"

    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == EstadoCobranza.ACREDITADO.value
    assert cobranza.estado_cambiado_at is None
    assert cobranza.pagador.nombre == "María López"

    entrada = db_session.scalar(select(AuditLog))
    assert entrada.accion == "cobranza.titular_completado"
    detalle = json.loads(entrada.detalle)
    assert detalle["titular_anterior"] == "Sin identificar"
    assert detalle["titular_nuevo"] == "María López"
    assert detalle["estado_anterior"] == detalle["estado_nuevo"]
    assert detalle["justificacion"] == "Titular del comprobante completado."


def test_completa_el_titular_junto_con_el_cambio_de_estado(
    api_client: TestClient,
    db_session: Session,
    admin_headers,
) -> None:
    creada = registrar(
        api_client, admin_headers, EstadoCobranza.OBSERVADO, titular="Sin identificar"
    )

    respuesta = cambiar_estado(
        api_client, admin_headers, creada["id"], EstadoCobranza.ACREDITADO, titular="María López"
    )

    assert respuesta.status_code == 200, respuesta.text
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == EstadoCobranza.ACREDITADO.value
    assert cobranza.pagador.nombre == "María López"
    detalle = json.loads(db_session.scalar(select(AuditLog)).detalle)
    assert detalle["titular_nuevo"] == "María López"


def test_no_reescribe_el_titular_de_un_comprobante_identificado(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.ACREDITADO)

    respuesta = cambiar_estado(
        api_client, admin_headers, creada["id"], EstadoCobranza.OBSERVADO, titular="Otra Persona"
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "ya tiene un titular" in respuesta.json()["detail"]
    db_session.expire_all()
    cobranza = db_session.get(Cobranza, creada["id"])
    assert cobranza.estado == EstadoCobranza.ACREDITADO.value
    assert cobranza.pagador.nombre == "Juan Ignacio Pérez"
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 0


@pytest.mark.parametrize("titular", [None, "", "   "])
def test_el_patch_necesita_estado_o_titular(
    api_client: TestClient, db_session: Session, admin_headers, titular: str | None
) -> None:
    creada = registrar(api_client, admin_headers, EstadoCobranza.ACREDITADO)

    cuerpo = {"justificacion": JUSTIFICACION}
    if titular is not None:
        cuerpo["titular"] = titular
    respuesta = api_client.patch(
        f"/cobranzas/{creada['id']}/estado", headers=admin_headers, json=cuerpo
    )

    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 0
