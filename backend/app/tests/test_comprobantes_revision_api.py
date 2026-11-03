"""Revisión administrativa de los comprobantes de alumnos (HU 54) contra PostgreSQL real.

Cubre el panel, el detalle, las tres resoluciones y el reenvío. Lo que se verifica no es solo el
contrato HTTP: la aceptación tiene que crear una cobranza acreditada con su imputación en la misma
transacción, no puede duplicarla, y observar o rechazar no pueden tocar la habilitación.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.comprobantes import get_almacenamiento
from app.core.database import get_db
from app.core.storage import AlmacenamientoLocal
from app.models.clases import AuditLog
from app.models.cobranza import Cobranza, Imputacion
from app.models.comprobantes import ComprobanteAlumno
from app.models.enums import (
    EstadoCobranza,
    EstadoComprobanteAlumno,
    EstadoHabilitacion,
    EstadoInscripcion,
)
from app.models.padron import Usuario
from app.schemas.cobranzas import TITULAR_SIN_IDENTIFICAR
from app.services import habilitacion
from app.tests.factories import (
    crear_alumno,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    cuit_valido,
    encabezado_de_autorizacion,
    token_de_prueba,
)

PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n"
ZONA = ZoneInfo("America/Argentina/Buenos_Aires")

PENDIENTE = EstadoComprobanteAlumno.PENDIENTE_REVISION.value
ACEPTADO = EstadoComprobanteAlumno.ACEPTADO.value
OBSERVADO = EstadoComprobanteAlumno.OBSERVADO.value
RECHAZADO = EstadoComprobanteAlumno.RECHAZADO.value


@pytest.fixture
def alumna(db_session: Session) -> tuple[object, Usuario]:
    legajo = crear_alumno(db_session)
    return legajo, crear_usuario_alumno(db_session, alumno=legajo)


@pytest.fixture
def headers(alumna) -> dict[str, str]:
    return encabezado_de_autorizacion(token_de_prueba(alumna[1]))


@pytest.fixture
def inscripcion(db_session: Session, alumna):
    return crear_inscripcion(db_session, alumno=alumna[0])


@pytest.fixture
def almacen(tmp_path) -> AlmacenamientoLocal:
    return AlmacenamientoLocal(tmp_path / "comprobantes")


@pytest.fixture
def api(api_client: TestClient, almacen: AlmacenamientoLocal) -> TestClient:
    api_client.app.dependency_overrides[get_almacenamiento] = lambda: almacen
    return api_client


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def admin_headers(admin: Usuario) -> dict[str, str]:
    return encabezado_de_autorizacion(token_de_prueba(admin))


def cuerpo(inscripcion_id: int, **cambios) -> dict[str, object]:
    datos = {
        "inscripcion_id": inscripcion_id,
        "fecha_pago": (date.today() - timedelta(days=1)).isoformat(),
        "importe": "31000.00",
        "medio": "TRANSFERENCIA",
        "archivo_nombre": "comprobante.pdf",
    }
    datos.update(cambios)
    return datos


def enviar(
    api: TestClient,
    headers: dict[str, str],
    inscripcion_id: int,
    **cambios,
) -> dict[str, object]:
    """Envía el comprobante completo y devuelve la fila en `PENDIENTE_REVISION`."""
    iniciado = api.post(
        "/alumno/comprobantes", headers=headers, json=cuerpo(inscripcion_id, **cambios)
    )
    assert iniciado.status_code == 201, iniciado.text
    comprobante_id = iniciado.json()["comprobante"]["id"]
    subida = api.put(
        iniciado.json()["subida"]["url"],
        headers={**headers, "Content-Type": "application/octet-stream"},
        content=PDF,
    )
    assert subida.status_code == 204, subida.text
    confirmado = api.post(f"/alumno/comprobantes/{comprobante_id}/confirmar", headers=headers)
    assert confirmado.status_code == 200, confirmado.text
    return confirmado.json()


def resolver(
    api: TestClient, headers: dict[str, str], comprobante_id: int, accion: str, motivo=None
):
    cuerpo_accion = {} if motivo is None else {"motivo": motivo}
    return api.post(f"/comprobantes/{comprobante_id}/{accion}", headers=headers, json=cuerpo_accion)


def test_listado_muestra_pendientes_primero_y_por_fecha_de_recepcion(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    """El orden es por recepción ascendente, no por la fecha declarada del pago."""
    ids = [
        enviar(api, headers, inscripcion.id, importe=importe)["id"]
        for importe in ("31000.00", "32000.00", "33000.00")
    ]
    recepciones = [
        "2026-01-03T10:00:00-03:00",
        "2026-01-01T10:00:00-03:00",
        "2026-01-02T10:00:00-03:00",
    ]
    for comprobante_id, recepcion in zip(ids, recepciones, strict=True):
        fila = db_session.get(ComprobanteAlumno, comprobante_id)
        fila.enviado_at = datetime.fromisoformat(recepcion)
    db_session.flush()

    # El más nuevo ya está resuelto: tiene que quedar después de los dos pendientes.
    assert resolver(api, admin_headers, ids[2], "observar", "Falta el sello.").status_code == 200

    respuesta = api.get("/comprobantes", headers=admin_headers)
    assert respuesta.status_code == 200
    assert [fila["id"] for fila in respuesta.json()] == [ids[1], ids[0], ids[2]]
    assert [fila["estado"] for fila in respuesta.json()] == [PENDIENTE, PENDIENTE, OBSERVADO]


def test_filtro_por_estado_conserva_los_resueltos(
    api: TestClient, headers, admin_headers, inscripcion
) -> None:
    pendiente = enviar(api, headers, inscripcion.id)
    observado = enviar(api, headers, inscripcion.id, importe="32000.00")
    rechazado = enviar(api, headers, inscripcion.id, importe="33000.00")
    assert (
        resolver(api, admin_headers, observado["id"], "observar", "No se lee.").status_code == 200
    )
    assert resolver(api, admin_headers, rechazado["id"], "rechazar", "Apócrifo.").status_code == 200

    todos = api.get("/comprobantes", headers=admin_headers).json()
    assert {fila["id"] for fila in todos} == {pendiente["id"], observado["id"], rechazado["id"]}

    solo_observados = api.get("/comprobantes?estado=OBSERVADO", headers=admin_headers)
    assert solo_observados.status_code == 200
    assert [fila["id"] for fila in solo_observados.json()] == [observado["id"]]
    assert solo_observados.json()[0]["motivo"] == "No se lee."

    assert api.get("/comprobantes?estado=OTRO", headers=admin_headers).status_code == 422


def test_detalle_con_el_alumno_y_la_resolucion(
    api: TestClient, headers, admin_headers, inscripcion, admin: Usuario
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    assert (
        resolver(api, admin_headers, enviado["id"], "observar", "Falta el sello.").status_code
        == 200
    )

    detalle = api.get(f"/comprobantes/{enviado['id']}", headers=admin_headers)
    assert detalle.status_code == 200
    fila = detalle.json()
    assert fila["estado"] == OBSERVADO
    assert fila["motivo"] == "Falta el sello."
    assert fila["revisado_por"] == admin.id
    assert fila["revisado_por_nombre"] == admin.nombre
    assert fila["revisado_at"] is not None
    assert fila["alumno"] == inscripcion.alumno.nombre
    assert fila["inscripcion"]["codigo"] == inscripcion.comision.codigo

    assert api.get("/comprobantes/999999", headers=admin_headers).status_code == 404


def test_aceptar_crea_cobranza_acreditada_imputacion_y_auditoria(
    api: TestClient, headers, admin_headers, inscripcion, admin: Usuario, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)

    respuesta = api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers)
    assert respuesta.status_code == 200, respuesta.text
    fila = respuesta.json()
    assert fila["estado"] == ACEPTADO
    assert fila["revisado_por"] == admin.id
    assert fila["cobranza_id"] is not None
    assert fila["motivo"] is None

    db_session.expire_all()
    cobranza = db_session.get(Cobranza, fila["cobranza_id"])
    assert cobranza.estado == EstadoCobranza.ACREDITADO.value
    assert cobranza.importe == Decimal("31000.00")
    assert cobranza.medio == "TRANSFERENCIA"
    assert cobranza.origen == "MANUAL"
    assert cobranza.pagador.nombre == TITULAR_SIN_IDENTIFICAR

    imputaciones = db_session.scalars(
        select(Imputacion).where(Imputacion.cobranza_id == cobranza.id)
    ).all()
    assert len(imputaciones) == 1
    assert imputaciones[0].inscripcion_id == inscripcion.id
    assert imputaciones[0].monto == Decimal("31000.00")

    comprobante = db_session.get(ComprobanteAlumno, enviado["id"])
    assert comprobante.cobranza_id == cobranza.id
    assert comprobante.revisado_por == admin.id
    assert comprobante.revisado_at is not None

    auditoria = db_session.scalars(
        select(AuditLog).where(
            AuditLog.entidad == "comprobante_alumno",
            AuditLog.entidad_id == enviado["id"],
            AuditLog.accion == "comprobante.aceptado",
        )
    ).all()
    assert len(auditoria) == 1
    assert str(cobranza.id) in auditoria[0].detalle


def test_aceptar_respeta_titular_y_factura_a(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    valido = cuit_valido()
    enviado = enviar(
        api,
        headers,
        inscripcion.id,
        titular="Familiar de Agustina",
        factura_a_solicitada=True,
        cuit=valido,
    )

    respuesta = api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers)
    assert respuesta.status_code == 200, respuesta.text

    db_session.expire_all()
    cobranza = db_session.get(Cobranza, respuesta.json()["cobranza_id"])
    assert cobranza.factura_a_solicitada is True
    assert cobranza.pagador.nombre == "Familiar de Agustina"
    assert cobranza.pagador.documento_norm == valido


def test_aceptar_aplica_las_reglas_de_habilitacion(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    """El importe del arancel deja la inscripción habilitada con la regla existente (D9)."""
    antes = habilitacion.derivar_estado(db_session, inscripcion)
    assert antes[0] == EstadoHabilitacion.BLOQUEADO.value

    enviado = enviar(api, headers, inscripcion.id, importe=str(inscripcion.comision.arancel))
    assert (
        api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers).status_code == 200
    )

    db_session.expire_all()
    assert (
        habilitacion.derivar_estado(db_session, inscripcion)[0]
        == EstadoHabilitacion.HABILITADO.value
    )


def test_observar_guarda_motivo_y_no_acredita(
    api: TestClient, headers, admin_headers, inscripcion, admin: Usuario, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    antes = habilitacion.derivar_estado(db_session, inscripcion)

    respuesta = resolver(api, admin_headers, enviado["id"], "observar", "  Falta el sello.  ")
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == OBSERVADO
    assert respuesta.json()["motivo"] == "Falta el sello."
    assert respuesta.json()["revisado_por"] == admin.id

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 0
    assert db_session.scalar(select(func.count()).select_from(Imputacion)) == 0
    assert habilitacion.derivar_estado(db_session, inscripcion) == antes


def test_rechazar_guarda_motivo_y_no_acredita(
    api: TestClient, headers, admin_headers, inscripcion, admin: Usuario, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)

    respuesta = resolver(api, admin_headers, enviado["id"], "rechazar", "Comprobante apócrifo.")
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == RECHAZADO
    assert respuesta.json()["motivo"] == "Comprobante apócrifo."
    assert respuesta.json()["revisado_por"] == admin.id

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 0


@pytest.mark.parametrize("accion", ["observar", "rechazar"])
@pytest.mark.parametrize("motivo", ["", "   ", "\t\n "])
def test_causa_vacia_es_rechazada(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session, accion, motivo
) -> None:
    enviado = enviar(api, headers, inscripcion.id)

    respuesta = resolver(api, admin_headers, enviado["id"], accion, motivo)
    assert respuesta.status_code == 422

    db_session.expire_all()
    assert db_session.get(ComprobanteAlumno, enviado["id"]).estado == PENDIENTE


def test_dos_resoluciones_simultaneas_dan_conflicto_y_una_sola_cobranza(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)

    primera = api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers)
    assert primera.status_code == 200, primera.text
    revisado_por = primera.json()["revisado_por"]
    revisado_at = primera.json()["revisado_at"]

    segunda = api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers)
    assert segunda.status_code == 409
    assert "ya fue resuelto" in segunda.json()["detail"]

    observada = resolver(api, admin_headers, enviado["id"], "observar", "Tarde.")
    assert observada.status_code == 409

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 1
    comprobante = db_session.get(ComprobanteAlumno, enviado["id"])
    assert comprobante.estado == ACEPTADO
    assert comprobante.revisado_por == revisado_por
    assert comprobante.revisado_at.isoformat() == revisado_at.replace("Z", "+00:00")


def test_aceptar_revierte_todo_si_la_inscripcion_ya_no_esta_activa(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    inscripcion.estado = EstadoInscripcion.BAJA.value
    db_session.flush()

    # El servicio revierte la transacción completa. La sesión de prueba comparte la transacción
    # externa del fixture, así que el endpoint corre en un savepoint: sin esto el rollback se
    # llevaría también los datos que armó el test.
    revision = Session(
        bind=db_session.connection(),
        join_transaction_mode="create_savepoint",
        autoflush=False,
        expire_on_commit=False,
    )
    api.app.dependency_overrides[get_db] = lambda: revision
    try:
        respuesta = api.post(f"/comprobantes/{enviado['id']}/aceptar", headers=admin_headers)
    finally:
        api.app.dependency_overrides[get_db] = lambda: db_session
        revision.close()

    assert respuesta.status_code == 422
    assert "no está activa" in respuesta.json()["detail"]

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 0
    assert db_session.scalar(select(func.count()).select_from(Imputacion)) == 0
    comprobante = db_session.get(ComprobanteAlumno, enviado["id"])
    assert comprobante.estado == PENDIENTE
    assert comprobante.cobranza_id is None
    assert comprobante.revisado_por is None


def test_reenvio_de_un_observado_crea_un_envio_nuevo_y_conserva_el_original(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    original = enviar(api, headers, inscripcion.id, titular="Familiar de Agustina")
    assert (
        resolver(api, admin_headers, original["id"], "observar", "Falta el sello.").status_code
        == 200
    )

    iniciado = api.post(
        f"/alumno/comprobantes/{original['id']}/reenviar",
        headers=headers,
        json={"archivo_nombre": "comprobante-nuevo.pdf"},
    )
    assert iniciado.status_code == 201, iniciado.text
    nuevo_id = iniciado.json()["comprobante"]["id"]
    assert nuevo_id != original["id"]
    assert iniciado.json()["comprobante"]["estado"] == "PENDIENTE_CARGA"
    assert iniciado.json()["comprobante"]["comprobante_origen_id"] == original["id"]

    assert (
        api.put(
            iniciado.json()["subida"]["url"],
            headers={**headers, "Content-Type": "application/octet-stream"},
            content=PDF,
        ).status_code
        == 204
    )
    confirmado = api.post(f"/alumno/comprobantes/{nuevo_id}/confirmar", headers=headers)
    assert confirmado.status_code == 200, confirmado.text
    assert confirmado.json()["estado"] == PENDIENTE
    assert confirmado.json()["comprobante_origen_id"] == original["id"]

    db_session.expire_all()
    viejo = db_session.get(ComprobanteAlumno, original["id"])
    assert viejo.estado == OBSERVADO
    assert viejo.motivo == "Falta el sello."
    nuevo = db_session.get(ComprobanteAlumno, nuevo_id)
    assert nuevo.fecha_pago == viejo.fecha_pago
    assert nuevo.importe == viejo.importe
    assert nuevo.medio == viejo.medio
    assert nuevo.titular == viejo.titular

    repetido = api.post(
        f"/alumno/comprobantes/{original['id']}/reenviar",
        headers=headers,
        json={"archivo_nombre": "otra-vez.pdf"},
    )
    assert repetido.status_code == 409


@pytest.mark.parametrize("estado", [PENDIENTE, RECHAZADO])
def test_no_se_reenvia_un_comprobante_no_observado(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session, estado: str
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    if estado == RECHAZADO:
        assert (
            resolver(api, admin_headers, enviado["id"], "rechazar", "Apócrifo.").status_code == 200
        )

    respuesta = api.post(
        f"/alumno/comprobantes/{enviado['id']}/reenviar",
        headers=headers,
        json={"archivo_nombre": "nuevo.pdf"},
    )
    assert respuesta.status_code == 409
    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(ComprobanteAlumno)) == 1


def test_reenvio_de_un_comprobante_ajeno_responde_404(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    assert (
        resolver(api, admin_headers, enviado["id"], "observar", "Falta el sello.").status_code
        == 200
    )

    otra = crear_usuario_alumno(
        db_session,
        alumno=crear_alumno(
            db_session, documento="39999888", email="otra.alumna@techacademy.invalid"
        ),
        email="otra.alumna.login@techacademy.invalid",
    )
    respuesta = api.post(
        f"/alumno/comprobantes/{enviado['id']}/reenviar",
        headers=encabezado_de_autorizacion(token_de_prueba(otra)),
        json={"archivo_nombre": "nuevo.pdf"},
    )
    assert respuesta.status_code == 404


@pytest.mark.parametrize(
    "ruta,metodo,cuerpo",
    [
        ("/comprobantes", "get", None),
        ("/comprobantes/1", "get", None),
        ("/comprobantes/1/archivo", "get", None),
        ("/comprobantes/1/aceptar", "post", {}),
        ("/comprobantes/1/observar", "post", {"motivo": "causa"}),
        ("/comprobantes/1/rechazar", "post", {"motivo": "causa"}),
    ],
)
def test_endpoints_administrativos_exigen_sesion_y_rol(
    api: TestClient, db_session: Session, ruta: str, metodo: str, cuerpo
) -> None:
    assert getattr(api, metodo)(ruta).status_code == 401

    docente = crear_usuario_docente(db_session)
    alumno = crear_usuario_alumno(db_session)
    for usuario in (docente, alumno):
        extra = {} if cuerpo is None else {"json": cuerpo}
        respuesta = getattr(api, metodo)(
            ruta, headers=encabezado_de_autorizacion(token_de_prueba(usuario)), **extra
        )
        assert respuesta.status_code == 403


def test_el_alumno_ve_el_estado_el_motivo_y_los_reenvios(
    api: TestClient, headers, admin_headers, inscripcion
) -> None:
    original = enviar(api, headers, inscripcion.id)
    assert (
        resolver(api, admin_headers, original["id"], "observar", "Falta el sello.").status_code
        == 200
    )
    iniciado = api.post(
        f"/alumno/comprobantes/{original['id']}/reenviar",
        headers=headers,
        json={"archivo_nombre": "nuevo.pdf"},
    )
    assert iniciado.status_code == 201
    api.put(
        iniciado.json()["subida"]["url"],
        headers={**headers, "Content-Type": "application/octet-stream"},
        content=PDF,
    )
    assert (
        api.post(
            f"/alumno/comprobantes/{iniciado.json()['comprobante']['id']}/confirmar",
            headers=headers,
        ).status_code
        == 200
    )

    respuesta = api.get("/alumno/comprobantes", headers=headers)
    assert respuesta.status_code == 200
    filas = {fila["id"]: fila for fila in respuesta.json()}
    assert filas[original["id"]]["estado"] == OBSERVADO
    assert filas[original["id"]]["motivo"] == "Falta el sello."
    assert len(filas) == 2


def test_el_adjunto_sigue_disponible_despues_de_resolverlo(
    api: TestClient, headers, admin_headers, inscripcion
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    assert resolver(api, admin_headers, enviado["id"], "rechazar", "Apócrifo.").status_code == 200

    admin_descarga = api.get(f"/comprobantes/{enviado['id']}/archivo", headers=admin_headers)
    assert admin_descarga.status_code == 200
    assert admin_descarga.content == PDF

    alumno_descarga = api.get(f"/alumno/comprobantes/{enviado['id']}/archivo", headers=headers)
    assert alumno_descarga.status_code == 200
