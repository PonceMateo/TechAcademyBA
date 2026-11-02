"""Comprobantes que envía el alumno (HU 52) contra PostgreSQL real.

La carga se prueba con `AlmacenamientoLocal` sobre un directorio temporal: ningún test toca un
servicio externo. Lo que se verifica es el contrato HTTP, la persistencia, los permisos y —lo más
importante— que el envío no acredite el pago ni cambie la habilitación.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.comprobantes import get_almacenamiento
from app.core.config import Settings
from app.core.storage import (
    AlmacenamientoLocal,
    AlmacenamientoNoConfigurado,
    AlmacenamientoNoDisponible,
    ClaveInvalida,
    construir_almacenamiento,
)
from app.models.cobranza import Cobranza, Imputacion
from app.models.comprobantes import TAMANO_MAXIMO_BYTES, ComprobanteAlumno
from app.models.enums import EstadoComprobanteAlumno, EstadoInscripcion
from app.models.padron import Usuario
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
JPG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32 + b"\xff\xd9"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20 + b"IEND\xaeB`\x82"


class AlmacenamientoRoto(AlmacenamientoLocal):
    """Simula un storage que acepta la subida pero no puede leerse al confirmar."""

    def leer(self, clave: str) -> bytes:
        raise AlmacenamientoNoDisponible("sin storage")


class AlmacenamientoSinFirma(AlmacenamientoLocal):
    """Simula un storage que no puede firmar la subida."""

    def destino_de_carga(self, clave: str, mime: str):
        raise AlmacenamientoNoDisponible("sin storage")


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
def admin_headers(db_session: Session) -> dict[str, str]:
    return encabezado_de_autorizacion(token_de_prueba(crear_usuario_admin(db_session)))


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


def iniciar(api: TestClient, headers: dict[str, str], inscripcion_id: int, **cambios):
    return api.post("/alumno/comprobantes", headers=headers, json=cuerpo(inscripcion_id, **cambios))


def subir(api: TestClient, headers: dict[str, str], iniciado, contenido: bytes = PDF):
    return api.put(
        iniciado.json()["subida"]["url"],
        headers={**headers, "Content-Type": "application/octet-stream"},
        content=contenido,
    )


def enviar(api: TestClient, headers: dict[str, str], inscripcion_id: int, **cambios):
    contenido = cambios.pop("_contenido", PDF)
    iniciado = iniciar(api, headers, inscripcion_id, **cambios)
    assert iniciado.status_code == 201, iniciado.text
    respuesta = subir(api, headers, iniciado, contenido)
    assert respuesta.status_code == 204, respuesta.text
    return api.post(
        f"/alumno/comprobantes/{iniciado.json()['comprobante']['id']}/confirmar",
        headers=headers,
    )


def test_envio_valido_persiste_y_queda_pendiente(
    api: TestClient, headers, inscripcion, db_session: Session, almacen
) -> None:
    respuesta = enviar(api, headers, inscripcion.id)
    assert respuesta.status_code == 200, respuesta.text

    fila = respuesta.json()
    assert fila["estado"] == EstadoComprobanteAlumno.PENDIENTE_REVISION.value
    assert fila["enviado_at"] is not None
    assert fila["archivo_mime"] == "application/pdf"
    assert fila["inscripcion"]["codigo"] == inscripcion.comision.codigo

    db_session.expire_all()
    guardado = db_session.get(ComprobanteAlumno, fila["id"])
    assert guardado is not None
    assert guardado.importe == Decimal("31000.00")
    assert guardado.enviado_at is not None
    assert (almacen.raiz / guardado.archivo_clave).read_bytes() == PDF


def test_envio_no_crea_cobranza_ni_cambia_la_habilitacion(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    antes = habilitacion.derivar_estado(db_session, inscripcion)
    respuesta = enviar(api, headers, inscripcion.id)
    assert respuesta.status_code == 200, respuesta.text

    assert habilitacion.derivar_estado(db_session, inscripcion) == antes
    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 0
    assert db_session.scalar(select(func.count()).select_from(Imputacion)) == 0
    db_session.refresh(inscripcion)
    assert inscripcion.estado == EstadoInscripcion.ACTIVA.value


def test_inscripcion_ajena_es_rechazada(
    api: TestClient, headers, db_session: Session, alumna
) -> None:
    otro = crear_alumno(
        db_session, documento="39999888", email="otro.alumno@techacademy.invalid"
    )
    ajena = crear_inscripcion(db_session, alumno=otro)

    respuesta = iniciar(api, headers, ajena.id)
    assert respuesta.status_code == 422
    assert "inscripción activa tuya" in respuesta.json()["detail"]


def test_inscripcion_inactiva_es_rechazada(
    api: TestClient, headers, db_session: Session, alumna
) -> None:
    inactiva = crear_inscripcion(
        db_session, alumno=alumna[0], estado=EstadoInscripcion.BAJA.value
    )

    respuesta = iniciar(api, headers, inactiva.id)
    assert respuesta.status_code == 422
    assert "no está activa" in respuesta.json()["detail"]


@pytest.mark.parametrize(
    "ruta,metodo",
    [
        ("/alumno/comprobantes", "get"),
        ("/alumno/comprobantes", "post"),
        ("/alumno/comprobantes/1/archivo", "get"),
        ("/alumno/comprobantes/1/confirmar", "post"),
    ],
)
def test_sin_sesion_responde_401(api: TestClient, ruta: str, metodo: str) -> None:
    respuesta = getattr(api, metodo)(ruta)
    assert respuesta.status_code == 401


def test_otro_rol_no_puede_enviar(api: TestClient, db_session: Session, inscripcion) -> None:
    admin = crear_usuario_admin(db_session)
    docente = crear_usuario_docente(db_session)

    for usuario in (admin, docente):
        respuesta = iniciar(
            api, encabezado_de_autorizacion(token_de_prueba(usuario)), inscripcion.id
        )
        assert respuesta.status_code == 403


@pytest.mark.parametrize(
    "contenido,mime",
    [(PDF, "application/pdf"), (JPG, "image/jpeg"), (PNG, "image/png")],
    ids=["pdf", "jpg", "png"],
)
def test_formatos_permitidos(api: TestClient, headers, inscripcion, contenido, mime) -> None:
    respuesta = enviar(api, headers, inscripcion.id, _contenido=contenido)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["archivo_mime"] == mime


def test_extension_permitida_con_contenido_invalido(
    api: TestClient, headers, inscripcion, db_session: Session, almacen
) -> None:
    iniciado = iniciar(api, headers, inscripcion.id, archivo_nombre="comprobante.pdf")
    comprobante_id = iniciado.json()["comprobante"]["id"]
    assert subir(api, headers, iniciado, b"esto no es un pdf").status_code == 204

    respuesta = api.post(
        f"/alumno/comprobantes/{comprobante_id}/confirmar", headers=headers
    )
    assert respuesta.status_code == 422
    assert "PDF, JPG o PNG" in respuesta.json()["detail"]

    db_session.expire_all()
    assert db_session.get(ComprobanteAlumno, comprobante_id) is None
    assert not [ruta for ruta in almacen.raiz.rglob("*") if ruta.is_file()]


def test_archivo_superior_a_5_mb_es_rechazado(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    iniciado = iniciar(api, headers, inscripcion.id)
    respuesta = subir(api, headers, iniciado, b"x" * (TAMANO_MAXIMO_BYTES + 1))
    assert respuesta.status_code == 413

    db_session.expire_all()
    fila = db_session.get(ComprobanteAlumno, iniciado.json()["comprobante"]["id"])
    assert fila.estado == EstadoComprobanteAlumno.PENDIENTE_CARGA.value


def test_archivo_vacio_es_rechazado(api: TestClient, headers, inscripcion) -> None:
    iniciado = iniciar(api, headers, inscripcion.id)
    respuesta = subir(api, headers, iniciado, b"")
    assert respuesta.status_code == 422
    assert "vacío" in respuesta.json()["detail"]


def test_fecha_futura_es_rechazada(api: TestClient, headers, inscripcion) -> None:
    respuesta = iniciar(
        api,
        headers,
        inscripcion.id,
        fecha_pago=(date.today() + timedelta(days=1)).isoformat(),
    )
    assert respuesta.status_code == 422
    assert "futura" in respuesta.text


@pytest.mark.parametrize("importe", ["0", "-10", "100.123"])
def test_importe_invalido_es_rechazado(api: TestClient, headers, inscripcion, importe) -> None:
    respuesta = iniciar(api, headers, inscripcion.id, importe=importe)
    assert respuesta.status_code == 422


def test_factura_a_sin_cuit_valido_es_rechazada(
    api: TestClient, headers, inscripcion
) -> None:
    sin_cuit = iniciar(api, headers, inscripcion.id, factura_a_solicitada=True)
    assert sin_cuit.status_code == 422

    invalido = iniciar(
        api, headers, inscripcion.id, factura_a_solicitada=True, cuit="30123456780"
    )
    assert invalido.status_code == 422


def test_cuit_sin_factura_a_es_rechazado(api: TestClient, headers, inscripcion) -> None:
    respuesta = iniciar(api, headers, inscripcion.id, cuit=cuit_valido())
    assert respuesta.status_code == 422
    assert "Factura A" in respuesta.json()["detail"][0]["msg"]


def test_factura_a_guarda_el_cuit_normalizado(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    valido = cuit_valido()
    respuesta = enviar(
        api, headers, inscripcion.id, factura_a_solicitada=True, cuit=f"{valido[:2]}-{valido[2:]}"
    )
    assert respuesta.status_code == 200, respuesta.text

    db_session.expire_all()
    fila = db_session.get(ComprobanteAlumno, respuesta.json()["id"])
    assert fila.cuit_norm == valido


def test_titular_es_opcional_y_no_se_completa_con_el_alumno(
    api: TestClient, headers, inscripcion, alumna
) -> None:
    respuesta = enviar(api, headers, inscripcion.id)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["titular"] is None

    con_titular = enviar(
        api, headers, inscripcion.id, titular="Familiar de Agustina", _contenido=JPG
    )
    assert con_titular.json()["titular"] == "Familiar de Agustina"


def test_el_mismo_comprobante_no_se_envia_dos_veces(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    assert enviar(api, headers, inscripcion.id).status_code == 200

    repetido = enviar(api, headers, inscripcion.id)
    assert repetido.status_code == 409
    assert "Ya enviaste" in repetido.json()["detail"]

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(ComprobanteAlumno)) == 1


def test_el_alumno_ve_solo_sus_comprobantes(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    assert enviar(api, headers, inscripcion.id).status_code == 200

    propia = api.get("/alumno/comprobantes", headers=headers)
    assert propia.status_code == 200
    assert len(propia.json()) == 1

    otra = crear_usuario_alumno(
        db_session,
        alumno=crear_alumno(
            db_session, documento="39999888", email="otra.alumna@techacademy.invalid"
        ),
        email="otra.alumna.login@techacademy.invalid",
    )
    ajeno = api.get(
        "/alumno/comprobantes", headers=encabezado_de_autorizacion(token_de_prueba(otra))
    )
    assert ajeno.status_code == 200
    assert ajeno.json() == []


def test_secretaria_ve_los_pendientes_y_el_docente_no(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    assert enviado.status_code == 200

    pendientes = api.get("/comprobantes", headers=admin_headers)
    assert pendientes.status_code == 200
    assert [fila["id"] for fila in pendientes.json()] == [enviado.json()["id"]]
    assert pendientes.json()[0]["alumno"] == inscripcion.alumno.nombre

    docente = crear_usuario_docente(db_session)
    respuesta = api.get(
        "/comprobantes", headers=encabezado_de_autorizacion(token_de_prueba(docente))
    )
    assert respuesta.status_code == 403


def test_secretaria_no_crea_cobranza_al_listar_ni_descargar(
    api: TestClient, headers, admin_headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    descarga = api.get(
        f"/comprobantes/{enviado.json()['id']}/archivo", headers=admin_headers
    )
    assert descarga.status_code == 200
    assert descarga.content == PDF

    assert db_session.scalar(select(func.count()).select_from(Cobranza)) == 0
    assert db_session.scalar(select(func.count()).select_from(Imputacion)) == 0


def test_descarga_del_dueno_y_bloqueo_a_otros(
    api: TestClient, headers, inscripcion, db_session: Session
) -> None:
    enviado = enviar(api, headers, inscripcion.id)
    comprobante_id = enviado.json()["id"]

    propia = api.get(f"/alumno/comprobantes/{comprobante_id}/archivo", headers=headers)
    assert propia.status_code == 200
    assert propia.content == PDF
    assert propia.headers["content-type"] == "application/pdf"

    otra = crear_usuario_alumno(
        db_session,
        alumno=crear_alumno(
            db_session, documento="39999888", email="otra.alumna@techacademy.invalid"
        ),
        email="otra.alumna.login@techacademy.invalid",
    )
    ajena = api.get(
        f"/alumno/comprobantes/{comprobante_id}/archivo",
        headers=encabezado_de_autorizacion(token_de_prueba(otra)),
    )
    assert ajena.status_code == 404
    assert api.get(
        f"/alumno/comprobantes/{comprobante_id}/archivo"
    ).status_code == 401


def test_fallo_del_storage_no_confirma_el_comprobante(
    api: TestClient, headers, inscripcion, db_session: Session, tmp_path
) -> None:
    api.app.dependency_overrides[get_almacenamiento] = lambda: AlmacenamientoRoto(
        tmp_path / "roto"
    )
    iniciado = iniciar(api, headers, inscripcion.id)
    comprobante_id = iniciado.json()["comprobante"]["id"]
    assert subir(api, headers, iniciado).status_code == 204

    respuesta = api.post(
        f"/alumno/comprobantes/{comprobante_id}/confirmar", headers=headers
    )
    assert respuesta.status_code == 503

    db_session.expire_all()
    fila = db_session.get(ComprobanteAlumno, comprobante_id)
    assert fila.estado == EstadoComprobanteAlumno.PENDIENTE_CARGA.value
    assert fila.enviado_at is None


def test_fallo_al_preparar_la_subida_no_deja_fila(
    api: TestClient, headers, inscripcion, db_session: Session, tmp_path
) -> None:
    api.app.dependency_overrides[get_almacenamiento] = lambda: AlmacenamientoSinFirma(
        tmp_path / "sin-firma"
    )

    respuesta = iniciar(api, headers, inscripcion.id)
    assert respuesta.status_code == 503

    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(ComprobanteAlumno)) == 0


def test_confirmar_sin_archivo_almacenado_responde_503(
    api: TestClient, headers, inscripcion
) -> None:
    iniciado = iniciar(api, headers, inscripcion.id)
    respuesta = api.post(
        f"/alumno/comprobantes/{iniciado.json()['comprobante']['id']}/confirmar",
        headers=headers,
    )
    assert respuesta.status_code == 503


def test_el_almacenamiento_local_no_sale_de_su_raiz(tmp_path) -> None:
    almacen = AlmacenamientoLocal(tmp_path / "comprobantes")

    with pytest.raises(ClaveInvalida):
        almacen.leer("../secreto")


def test_produccion_no_usa_el_disco_local() -> None:
    settings = Settings(
        app_env="production",
        storage_backend="local",
        jwt_secret_key="solo-prueba",
    )

    with pytest.raises(AlmacenamientoNoConfigurado):
        construir_almacenamiento(settings)


def test_supabase_sin_configuracion_no_arranca() -> None:
    settings = Settings(
        app_env="production",
        storage_backend="supabase",
        jwt_secret_key="solo-prueba",
    )

    with pytest.raises(AlmacenamientoNoConfigurado):
        construir_almacenamiento(settings)
