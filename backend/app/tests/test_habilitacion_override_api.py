"""Forzado manual del estado de habilitación por inscripción (H/U #30 y #27).

La operación real se prueba contra PostgreSQL: lo que se afirma es que la fila de
`override_habilitacion` existe, que el estado efectivo prevalece y que la quita no borra el
historial. La regla automática no se replica acá: los estados de partida salen de las fábricas y
de las cobranzas reales.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.clases import AuditLog, OverrideHabilitacion
from app.models.enums import (
    CategoriaInscripcion,
    EstadoHabilitacion,
    EstadoInscripcion,
)
from app.models.padron import Usuario
from app.services import clases
from app.tests.factories import (
    crear_alumno,
    crear_clase,
    crear_comision,
    crear_curso,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
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


def _bloqueada(db_session: Session, **kwargs) -> object:
    """Inscripción particular sin pagos: la regla automática la deja BLOQUEADA."""
    return crear_inscripcion(db_session, **kwargs)


def _habilitada(db_session: Session, **kwargs) -> object:
    """Beca total: la regla automática la deja HABILITADA sin depender de cobranzas."""
    return crear_inscripcion(
        db_session, categoria=CategoriaInscripcion.BECADO_TOTAL.value, **kwargs
    )


def _detalle(cliente: TestClient, alumno_id: int, inscripcion_id: int) -> dict:
    cuerpo = cliente.get(f"/alumnos/{alumno_id}").json()
    return next(
        inscripcion
        for inscripcion in cuerpo["inscripciones"]
        if inscripcion["id"] == inscripcion_id
    )


def test_forzar_habilitado_sobre_una_inscripcion_bloqueada(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción autorizada por dirección"},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == {
        "estado": "HABILITADO",
        "causa": "Excepción autorizada por dirección",
        "forzado": True,
    }
    acceso = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)["acceso"]
    assert acceso["estado"] == "HABILITADO"
    assert acceso["estado_automatico"] == "BLOQUEADO"
    assert acceso["forzado"] is True
    assert acceso["motivo"] == "Excepción autorizada por dirección"


def test_forzar_bloqueado_sobre_una_inscripcion_habilitada(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _habilitada(db_session)

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "BLOQUEADO", "motivo": "Comprobante en revisión"},
    )

    assert respuesta.status_code == 200, respuesta.text
    acceso = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)["acceso"]
    assert acceso["estado"] == "BLOQUEADO"
    assert acceso["causa"] == "Comprobante en revisión"
    assert acceso["estado_automatico"] == "HABILITADO"
    assert acceso["forzado"] is True


def test_motivo_vacio_es_422(cliente_admin: TestClient, db_session: Session) -> None:
    inscripcion = _bloqueada(db_session)

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "   "},
    )

    assert respuesta.status_code == 422, respuesta.text
    assert db_session.scalar(select(func.count()).select_from(OverrideHabilitacion)) == 0


def test_persiste_motivo_administrador_y_fecha(
    cliente_admin: TestClient, db_session: Session, admin: Usuario
) -> None:
    inscripcion = _bloqueada(db_session)

    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "  Pago acordado  "},
    )

    override = db_session.scalar(select(OverrideHabilitacion))
    assert override.inscripcion_id == inscripcion.id
    assert override.estado_forzado == EstadoHabilitacion.HABILITADO.value
    assert override.motivo == "Pago acordado"
    assert override.usuario_id == admin.id
    assert override.fecha is not None
    assert override.activo is True


def test_el_estado_forzado_prevalece_sobre_el_automatico(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)
    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )

    fila = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)

    assert fila["acceso"]["estado"] == "HABILITADO"
    assert fila["acceso"]["estado_automatico"] == "BLOQUEADO"


def test_quitar_el_forzado_restaura_el_estado_automatico(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)
    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )

    respuesta = cliente_admin.delete(f"/inscripciones/{inscripcion.id}/habilitacion")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == "BLOQUEADO"
    assert respuesta.json()["forzado"] is False
    fila = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)
    assert fila["acceso"]["estado"] == "BLOQUEADO"
    assert fila["acceso"]["estado_automatico"] == "BLOQUEADO"
    assert fila["acceso"]["motivo"] is None


def test_quitar_conserva_el_registro_historico_y_audita(
    cliente_admin: TestClient, db_session: Session, admin: Usuario
) -> None:
    inscripcion = _bloqueada(db_session)
    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )

    cliente_admin.delete(f"/inscripciones/{inscripcion.id}/habilitacion")

    assert db_session.scalar(select(func.count()).select_from(OverrideHabilitacion)) == 1
    override = db_session.scalar(select(OverrideHabilitacion))
    assert override.activo is False
    assert override.motivo == "Excepción"

    auditoria = db_session.scalar(
        select(AuditLog).where(AuditLog.accion == "habilitacion.forzado.quitado")
    )
    assert auditoria.usuario_id == admin.id
    assert auditoria.entidad == "inscripcion"
    assert auditoria.entidad_id == inscripcion.id
    assert json.loads(auditoria.detalle)["motivo"] == "Excepción"
    assert auditoria.created_at is not None


def test_otra_inscripcion_del_mismo_alumno_no_se_modifica(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    curso = crear_curso(db_session)
    comision_primera = crear_comision(db_session, curso=curso, con_sede=False)
    comision_segunda = crear_comision(db_session, curso=curso, con_sede=False)
    primera = _bloqueada(db_session, alumno=alumno, comision=comision_primera)
    segunda = _bloqueada(db_session, alumno=alumno, comision=comision_segunda)

    cliente_admin.post(
        f"/inscripciones/{primera.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )

    assert _detalle(cliente_admin, alumno.id, primera.id)["acceso"]["forzado"] is True
    otra = _detalle(cliente_admin, alumno.id, segunda.id)["acceso"]
    assert otra["estado"] == "BLOQUEADO"
    assert otra["forzado"] is False


@pytest.mark.parametrize("metodo", ["post", "delete"])
def test_inscripcion_no_activa_es_409(
    cliente_admin: TestClient, db_session: Session, metodo: str
) -> None:
    inscripcion = _bloqueada(db_session, estado=EstadoInscripcion.BAJA.value)

    if metodo == "post":
        respuesta = cliente_admin.post(
            f"/inscripciones/{inscripcion.id}/habilitacion",
            json={"estado": "HABILITADO", "motivo": "Excepción"},
        )
    else:
        respuesta = cliente_admin.delete(f"/inscripciones/{inscripcion.id}/habilitacion")

    assert respuesta.status_code == 409, respuesta.text


def test_inscripcion_inexistente_es_404(cliente_admin: TestClient) -> None:
    assert (
        cliente_admin.post(
            "/inscripciones/999999/habilitacion",
            json={"estado": "HABILITADO", "motivo": "Excepción"},
        ).status_code
        == 404
    )
    assert cliente_admin.delete("/inscripciones/999999/habilitacion").status_code == 404


def test_solo_administracion_puede_forzar(
    api_client: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)

    assert (
        api_client.post(
            f"/inscripciones/{inscripcion.id}/habilitacion",
            json={"estado": "HABILITADO", "motivo": "Excepción"},
        ).status_code
        == 401
    )

    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))
    assert (
        api_client.post(
            f"/inscripciones/{inscripcion.id}/habilitacion",
            json={"estado": "HABILITADO", "motivo": "Excepción"},
        ).status_code
        == 403
    )
    assert api_client.delete(f"/inscripciones/{inscripcion.id}/habilitacion").status_code == 403


def test_un_segundo_forzado_vigente_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)
    primero = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )
    assert primero.status_code == 200

    segundo = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Otra excepción"},
    )

    assert segundo.status_code == 409, segundo.text
    assert db_session.scalar(select(func.count()).select_from(OverrideHabilitacion)) == 1


def test_forzar_el_mismo_estado_que_el_automatico_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "BLOQUEADO", "motivo": "Excepción"},
    )

    assert respuesta.status_code == 409, respuesta.text
    assert db_session.scalar(select(func.count()).select_from(OverrideHabilitacion)) == 0


def test_quitar_sin_forzado_vigente_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)

    assert cliente_admin.delete(f"/inscripciones/{inscripcion.id}/habilitacion").status_code == 409
    assert db_session.scalar(select(func.count()).select_from(AuditLog)) == 0


def test_el_forzado_no_altera_categoria_ni_importes(
    cliente_admin: TestClient, db_session: Session
) -> None:
    inscripcion = _bloqueada(db_session)
    antes = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)

    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )

    despues = _detalle(cliente_admin, inscripcion.alumno_id, inscripcion.id)
    for campo in (
        "categoria",
        "porcentaje_beca",
        "arancel",
        "monto_requerido",
        "total_pagado",
        "total_observado",
        "saldo_pendiente",
    ):
        assert despues[campo] == antes[campo]


def test_el_acceso_a_clases_usa_el_estado_efectivo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session)
    inscripcion = _bloqueada(db_session, alumno=alumno, comision=comision)
    crear_clase(db_session, comision=comision, link_virtual="https://zoom.us/j/123456789")

    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    with pytest.raises(clases.NoAutorizado):
        clases.obtener_link(db_session, comision.codigo, usuario)

    cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/habilitacion",
        json={"estado": "HABILITADO", "motivo": "Excepción"},
    )
    assert clases.obtener_link(db_session, comision.codigo, usuario) == "https://zoom.us/j/123456789"
