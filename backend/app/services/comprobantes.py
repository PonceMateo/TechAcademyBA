"""Reglas del comprobante que envía el alumno (HU 52).

**El alumno nunca llega por parámetro**: todo parte de `usuario.alumno`, igual que el resto del
autoservicio (D60). La inscripción se valida contra ese legajo, así que un id ajeno no tiene forma
de colarse.

**El envío no acredita nada.** No se crea una `cobranza`, ni un `pagador`, ni una `imputación`, y
la habilitación se deriva igual que antes. La aceptación definitiva pertenece al flujo de revisión
de cobranzas.

**Verificar después de guardar.** El archivo se sube primero y se valida leyéndolo del storage en
`confirmar`. Si el contenido no sirve o el envío está duplicado, se borra el objeto y la fila
técnica: no quedan registros inconsistentes.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.storage import (
    AlmacenamientoLocal,
    AlmacenamientoNoDisponible,
    AlmacenamientoSupabase,
    DestinoDeCarga,
)
from app.models.catalogo import Comision
from app.models.clases import AuditLog
from app.models.comprobantes import TAMANO_MAXIMO_BYTES, ComprobanteAlumno
from app.models.enums import EstadoComprobanteAlumno, EstadoInscripcion, Rol
from app.models.inscripciones import Inscripcion
from app.models.padron import Usuario
from app.schemas.cobranzas import ZONA_ACADEMIA
from app.schemas.comprobantes import (
    ComprobanteAlumnoOut,
    ComprobanteCreate,
    ComprobantePendienteOut,
    InscripcionComprobanteOut,
)
from app.services.alumno import alumno_de
from app.services.normalization import normalize_document

Almacenamiento = AlmacenamientoLocal | AlmacenamientoSupabase

ESTADO_PENDIENTE = EstadoComprobanteAlumno.PENDIENTE_REVISION.value
ESTADO_EN_CARGA = EstadoComprobanteAlumno.PENDIENTE_CARGA.value

#: Formatos admitidos y cómo se reconoce su contenido real. No se confía en la extensión ni en el
#: `Content-Type`: el tipo sale de los bytes.
PDF_MAGIC = b"%PDF-"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


class InscripcionNoDisponible(Exception):
    """La inscripción no es del alumno autenticado o no está activa."""


class ComprobanteNoEncontrado(Exception):
    """El comprobante no existe o es de otro alumno. El mensaje es el mismo en los dos casos."""


class ComprobanteNoEditable(Exception):
    """El comprobante ya no está en carga: no se le cambia el archivo."""


class ArchivoInvalido(Exception):
    """El archivo está vacío, corrupto o no es un PDF, JPG o PNG."""


class ArchivoDemasiadoGrande(Exception):
    """El archivo supera los 5 MB."""


class ComprobanteDuplicado(Exception):
    """El mismo comprobante ya está pendiente de revisión."""


class ComprobanteInvalido(Exception):
    """La base rechazó el comprobante."""


class AlmacenamientoFallido(Exception):
    """El storage no está disponible o no se pudo verificar el archivo."""


@dataclass(frozen=True)
class ArchivoParaDescargar:
    """El adjunto resuelto: bytes en local o URL firmada en producción."""

    nombre: str
    mime: str
    contenido: bytes | None = None
    url: str | None = None


def detectar_tipo(contenido: bytes) -> str | None:
    """El tipo real del archivo, o `None` si no es PDF, JPG ni PNG.

    Además de la cabecera se exige el cierre del formato. Un archivo truncado tiene la cabecera
    correcta y aun así no se puede abrir, y aceptarlo dejaría a Secretaría con un adjunto roto.

    shortcut: no se decodifica la imagen ni se parsea el PDF completo; alcanza con cabecera y
    cierre para rechazar vacíos, truncados y archivos renombrados. Si aparecen adjuntos dañados que
    pasan estas comprobaciones, se agrega un decodificador real.
    """
    if contenido.startswith(PDF_MAGIC) and b"%%EOF" in contenido[-2048:]:
        return "application/pdf"
    if contenido.startswith(JPEG_MAGIC) and b"\xff\xd9" in contenido[-64:]:
        return "image/jpeg"
    if (
        contenido.startswith(PNG_MAGIC)
        and contenido[12:16] == b"IHDR"
        and b"IEND" in contenido[-32:]
    ):
        return "image/png"
    return None


def validar_contenido(contenido: bytes) -> str:
    """Valida tamaño y contenido real. Devuelve el MIME detectado."""
    if len(contenido) == 0:
        raise ArchivoInvalido("El archivo está vacío.")
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise ArchivoDemasiadoGrande("El archivo no puede superar los 5 MB.")
    tipo = detectar_tipo(contenido)
    if tipo is None:
        raise ArchivoInvalido("El archivo tiene que ser un PDF, JPG o PNG válido.")
    return tipo


def nombre_seguro(nombre: str | None) -> str:
    """El nombre original reducido a su último tramo, sin rutas y con tope de longitud."""
    if nombre is None:
        return "comprobante"
    base = Path(nombre.replace("\\", "/")).name.strip()
    return base[:200] or "comprobante"


def iniciar(
    session: Session,
    usuario: Usuario,
    datos: ComprobanteCreate,
    almacen: Almacenamiento,
) -> tuple[ComprobanteAlumno, DestinoDeCarga | None]:
    """Crea la fila en carga y devuelve el destino al que subir el archivo."""
    alumno = alumno_de(usuario)
    inscripcion = session.get(Inscripcion, datos.inscripcion_id)
    if inscripcion is None or inscripcion.alumno_id != alumno.id:
        raise InscripcionNoDisponible("Elegí una inscripción activa tuya.")
    if inscripcion.estado != EstadoInscripcion.ACTIVA.value:
        raise InscripcionNoDisponible("La inscripción elegida no está activa.")

    comprobante = ComprobanteAlumno(
        alumno_id=alumno.id,
        inscripcion_id=inscripcion.id,
        fecha_pago=datos.fecha_pago,
        importe=datos.importe,
        medio=datos.medio.value,
        titular=datos.titular,
        factura_a_solicitada=datos.factura_a_solicitada,
        cuit=datos.cuit,
        cuit_norm=normalize_document(datos.cuit) if datos.factura_a_solicitada else None,
        archivo_clave=f"alumno/{alumno.id}/{uuid4().hex}",
        archivo_nombre=nombre_seguro(datos.archivo_nombre),
        estado=ESTADO_EN_CARGA,
    )
    session.add(comprobante)
    try:
        session.flush()
        try:
            destino = almacen.destino_de_carga(
                comprobante.archivo_clave, "application/octet-stream"
            )
        except AlmacenamientoNoDisponible as error:
            raise AlmacenamientoFallido(
                "No pudimos preparar la subida del comprobante. Volvé a intentarlo."
            ) from error
        session.commit()
    except Exception:
        # La firma del storage puede fallar: no puede quedar una fila en carga sin destino.
        session.rollback()
        raise

    session.refresh(comprobante)
    return comprobante, destino


def guardar_archivo(
    session: Session,
    usuario: Usuario,
    comprobante_id: int,
    contenido: bytes,
    almacen: Almacenamiento,
) -> None:
    """Sube el binario al almacenamiento privado (solo desarrollo).

    No valida el contenido: eso ocurre en `confirmar`, leyendo lo que quedó guardado, que es lo que
    la historia exige verificar.
    """
    comprobante = _propio(session, usuario, comprobante_id, bloquear=True)
    _exigir_en_carga(comprobante)

    if len(contenido) == 0:
        raise ArchivoInvalido("El archivo está vacío.")
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise ArchivoDemasiadoGrande("El archivo no puede superar los 5 MB.")

    try:
        almacen.guardar(comprobante.archivo_clave, contenido)
    except AlmacenamientoNoDisponible as error:
        raise AlmacenamientoFallido(
            "No pudimos guardar el comprobante. Volvé a intentarlo."
        ) from error


def confirmar(
    session: Session,
    usuario: Usuario,
    comprobante_id: int,
    almacen: Almacenamiento,
) -> ComprobanteAlumno:
    """Verifica el archivo almacenado y deja el comprobante pendiente de revisión."""
    comprobante = _propio(session, usuario, comprobante_id, bloquear=True)
    _exigir_en_carga(comprobante)

    try:
        contenido = almacen.leer(comprobante.archivo_clave)
    except AlmacenamientoNoDisponible as error:
        raise AlmacenamientoFallido(
            "No pudimos verificar el comprobante. Volvé a intentarlo."
        ) from error

    try:
        mime = validar_contenido(contenido)
    except (ArchivoInvalido, ArchivoDemasiadoGrande):
        _descartar(session, almacen, comprobante)
        raise

    sha256 = hashlib.sha256(contenido).hexdigest()
    if _duplicado(session, comprobante, sha256):
        _descartar(session, almacen, comprobante)
        raise ComprobanteDuplicado(
            "Ya enviaste este mismo comprobante y sigue pendiente de revisión."
        )

    comprobante.archivo_mime = mime
    comprobante.archivo_bytes = len(contenido)
    comprobante.archivo_sha256 = sha256
    comprobante.estado = ESTADO_PENDIENTE
    comprobante.enviado_at = datetime.now(ZONA_ACADEMIA)
    session.add(
        AuditLog(
            usuario_id=usuario.id,
            accion="comprobante.enviado",
            entidad="comprobante_alumno",
            entidad_id=comprobante.id,
            detalle=json.dumps(
                {
                    "inscripcion_id": comprobante.inscripcion_id,
                    "fecha_pago": comprobante.fecha_pago.isoformat(),
                    "importe": str(comprobante.importe),
                    "medio": comprobante.medio,
                    "archivo_bytes": comprobante.archivo_bytes,
                    "archivo_sha256": sha256,
                },
                ensure_ascii=False,
            ),
        )
    )

    try:
        session.commit()
    except (IntegrityError, DataError) as error:
        session.rollback()
        almacen.eliminar(comprobante.archivo_clave)
        raise ComprobanteInvalido("No pudimos registrar el comprobante.") from error

    session.refresh(comprobante)
    return comprobante


def listar_de_alumno(session: Session, usuario: Usuario) -> list[ComprobanteAlumnoOut]:
    """Los comprobantes enviados por el alumno autenticado, del más reciente al más viejo."""
    alumno = alumno_de(usuario)
    filas = session.scalars(
        select(ComprobanteAlumno)
        .where(
            ComprobanteAlumno.alumno_id == alumno.id,
            ComprobanteAlumno.estado == ESTADO_PENDIENTE,
        )
        .options(
            selectinload(ComprobanteAlumno.inscripcion)
            .selectinload(Inscripcion.comision)
            .selectinload(Comision.curso)
        )
        .order_by(ComprobanteAlumno.enviado_at.desc(), ComprobanteAlumno.id.desc())
    ).all()
    return [serializar(fila) for fila in filas]


def listar_pendientes(session: Session) -> list[ComprobantePendienteOut]:
    """Bandeja de Secretaría: solo los comprobantes pendientes de revisión."""
    filas = session.scalars(
        select(ComprobanteAlumno)
        .where(ComprobanteAlumno.estado == ESTADO_PENDIENTE)
        .options(
            selectinload(ComprobanteAlumno.alumno),
            selectinload(ComprobanteAlumno.inscripcion)
            .selectinload(Inscripcion.comision)
            .selectinload(Comision.curso),
        )
        .order_by(ComprobanteAlumno.enviado_at.desc(), ComprobanteAlumno.id.desc())
    ).all()
    return [_serializar_pendiente(fila) for fila in filas]


def obtener_archivo(
    session: Session,
    usuario: Usuario,
    comprobante_id: int,
    almacen: Almacenamiento,
) -> ArchivoParaDescargar:
    """Resuelve el adjunto para su dueño o para Secretaría. Otro alumno recibe 404."""
    comprobante = session.get(ComprobanteAlumno, comprobante_id)
    if comprobante is None or comprobante.estado != ESTADO_PENDIENTE:
        raise ComprobanteNoEncontrado("No encontré ese comprobante.")
    if usuario.rol == Rol.ALUMNO.value and comprobante.alumno_id != usuario.alumno_id:
        # Mismo 404 que uno inexistente: la respuesta no sirve para enumerar comprobantes ajenos.
        raise ComprobanteNoEncontrado("No encontré ese comprobante.")

    try:
        url = almacen.url_descarga(comprobante.archivo_clave)
    except AlmacenamientoNoDisponible as error:
        raise AlmacenamientoFallido(
            "El archivo del comprobante no está disponible."
        ) from error

    if url is not None:
        return ArchivoParaDescargar(
            nombre=comprobante.archivo_nombre or "comprobante",
            mime=comprobante.archivo_mime or "application/octet-stream",
            url=url,
        )

    try:
        contenido = almacen.leer(comprobante.archivo_clave)
    except AlmacenamientoNoDisponible as error:
        raise AlmacenamientoFallido(
            "El archivo del comprobante no está disponible."
        ) from error

    return ArchivoParaDescargar(
        nombre=comprobante.archivo_nombre or "comprobante",
        mime=comprobante.archivo_mime or "application/octet-stream",
        contenido=contenido,
    )


def _propio(
    session: Session, usuario: Usuario, comprobante_id: int, *, bloquear: bool = False
) -> ComprobanteAlumno:
    alumno = alumno_de(usuario)
    consulta = select(ComprobanteAlumno).where(
        ComprobanteAlumno.id == comprobante_id,
        ComprobanteAlumno.alumno_id == alumno.id,
    )
    if bloquear:
        consulta = consulta.with_for_update()
    comprobante = session.scalar(consulta)
    if comprobante is None:
        raise ComprobanteNoEncontrado("No encontré ese comprobante entre los que enviaste.")
    return comprobante


def _exigir_en_carga(comprobante: ComprobanteAlumno) -> None:
    if comprobante.estado != ESTADO_EN_CARGA:
        raise ComprobanteNoEditable("Ese comprobante ya fue enviado.")


def _duplicado(session: Session, comprobante: ComprobanteAlumno, sha256: str) -> bool:
    existente = session.scalar(
        select(ComprobanteAlumno.id).where(
            ComprobanteAlumno.id != comprobante.id,
            ComprobanteAlumno.alumno_id == comprobante.alumno_id,
            ComprobanteAlumno.inscripcion_id == comprobante.inscripcion_id,
            ComprobanteAlumno.fecha_pago == comprobante.fecha_pago,
            ComprobanteAlumno.importe == comprobante.importe,
            ComprobanteAlumno.medio == comprobante.medio,
            ComprobanteAlumno.archivo_sha256 == sha256,
            ComprobanteAlumno.estado == ESTADO_PENDIENTE,
        )
    )
    return existente is not None


def _descartar(
    session: Session, almacen: Almacenamiento, comprobante: ComprobanteAlumno
) -> None:
    """Borra el objeto y la fila técnica: un envío rechazado no deja rastros."""
    almacen.eliminar(comprobante.archivo_clave)
    session.delete(comprobante)
    try:
        session.commit()
    except (IntegrityError, DataError):
        session.rollback()


def serializar(comprobante: ComprobanteAlumno) -> ComprobanteAlumnoOut:
    inscripcion = comprobante.inscripcion
    return ComprobanteAlumnoOut(
        id=comprobante.id,
        estado=comprobante.estado,
        fecha_pago=comprobante.fecha_pago,
        importe=comprobante.importe,
        medio=comprobante.medio,
        titular=comprobante.titular,
        factura_a_solicitada=comprobante.factura_a_solicitada,
        cuit=comprobante.cuit,
        archivo_nombre=comprobante.archivo_nombre,
        archivo_mime=comprobante.archivo_mime,
        archivo_bytes=comprobante.archivo_bytes,
        enviado_at=comprobante.enviado_at,
        inscripcion=InscripcionComprobanteOut(
            id=inscripcion.id,
            codigo=inscripcion.comision.codigo,
            nombre_curso=inscripcion.comision.curso.nombre,
        ),
    )


def _serializar_pendiente(comprobante: ComprobanteAlumno) -> ComprobantePendienteOut:
    base = serializar(comprobante)
    return ComprobantePendienteOut(
        **base.model_dump(),
        alumno=comprobante.alumno.nombre,
        alumno_email=comprobante.alumno.email,
        alumno_documento=comprobante.alumno.documento,
    )
