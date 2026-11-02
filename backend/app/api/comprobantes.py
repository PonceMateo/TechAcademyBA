"""Comprobantes que envía el alumno (HU 52).

**Dos routers, dos roles.** El alumno administra sus envíos bajo `/alumno/comprobantes`; Secretaría
consulta y descarga los pendientes bajo `/comprobantes`. Ninguna ruta recibe el alumno por
parámetro: sale de la cuenta autenticada (D60).

**La carga es en tres pasos** (inicio → archivo → confirmar) porque en producción el archivo va
del navegador al storage con una URL firmada y no atraviesa la Function. En desarrollo el paso 2
pega contra `PUT .../archivo`. La verificación del contenido ocurre siempre en el backend.

La lógica vive en `app/services/comprobantes.py`; acá solo se traducen los errores a códigos HTTP.
"""

from __future__ import annotations

import urllib.parse
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.storage import (
    AlmacenamientoLocal,
    AlmacenamientoNoConfigurado,
    AlmacenamientoSupabase,
    construir_almacenamiento,
)
from app.models.comprobantes import TAMANO_MAXIMO_BYTES
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.comprobantes import (
    ComprobanteAlumnoOut,
    ComprobanteCreate,
    ComprobanteIniciadoOut,
    ComprobantePendienteOut,
    SubidaDeArchivoOut,
)
from app.services import comprobantes

router_alumno = APIRouter(prefix="/alumno/comprobantes", tags=["comprobantes"])
router_admin = APIRouter(prefix="/comprobantes", tags=["comprobantes"])

_solo_alumno = require_roles(Rol.ALUMNO)
_solo_admin = require_roles(Rol.ADMIN)


def get_almacenamiento():
    """Backend de storage configurado, o 503 sin fallback insegura."""
    try:
        return construir_almacenamiento(get_settings())
    except AlmacenamientoNoConfigurado as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


AlmacenamientoDep = Annotated[
    AlmacenamientoLocal | AlmacenamientoSupabase, Depends(get_almacenamiento)
]
SessionDep = Annotated[Session, Depends(get_db)]
AlumnoDep = Annotated[Usuario, Depends(_solo_alumno)]
AdminDep = Annotated[Usuario, Depends(_solo_admin)]


@router_alumno.get(
    "",
    response_model=list[ComprobanteAlumnoOut],
    summary="Consultar mis comprobantes enviados",
)
def listar_mis_comprobantes(session: SessionDep, usuario: AlumnoDep) -> list[ComprobanteAlumnoOut]:
    """Comprobantes del alumno autenticado con su estado, del más reciente al más viejo.

    Solo los ya verificados (`PENDIENTE_REVISION`): una carga interrumpida no se muestra como si
    hubiera llegado.
    """
    return comprobantes.listar_de_alumno(session, usuario)


@router_alumno.post(
    "",
    response_model=ComprobanteIniciadoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Iniciar el envío de un comprobante",
)
def iniciar_comprobante(
    cuerpo: ComprobanteCreate,
    session: SessionDep,
    usuario: AlumnoDep,
    almacen: AlmacenamientoDep,
) -> ComprobanteIniciadoOut:
    """Valida los datos y devuelve a dónde subir el archivo.

    422 si la inscripción no es propia o está inactiva, o si un dato no cumple las reglas.
    La respuesta trae `url` y `metodo`: relativa cuando sube el backend, absoluta cuando es una
    URL firmada del storage.
    """
    try:
        comprobante, destino = comprobantes.iniciar(session, usuario, cuerpo, almacen)
    except comprobantes.InscripcionNoDisponible as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except comprobantes.AlmacenamientoFallido as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    subida = (
        SubidaDeArchivoOut(
            metodo="PUT",
            url=f"/alumno/comprobantes/{comprobante.id}/archivo",
            headers={},
            expira_segundos=get_settings().storage_url_expira_segundos,
        )
        if destino is None
        else SubidaDeArchivoOut(
            metodo=destino.metodo,
            url=destino.url,
            headers=destino.headers,
            expira_segundos=destino.expira_segundos,
        )
    )
    return ComprobanteIniciadoOut(
        comprobante=comprobantes.serializar(comprobante),
        subida=subida,
    )


@router_alumno.put(
    "/{comprobante_id}/archivo",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Subir el archivo del comprobante",
)
async def subir_archivo(
    comprobante_id: int,
    request: Request,
    session: SessionDep,
    usuario: AlumnoDep,
    almacen: AlmacenamientoDep,
) -> Response:
    """Guarda el binario en el almacenamiento privado, sin validar todavía su contenido.

    El límite se aplica mientras se lee el cuerpo: un archivo de más de 5 MB se corta con 413 y
    no llega al disco.
    """
    contenido = await _leer_cuerpo(request)
    try:
        comprobantes.guardar_archivo(session, usuario, comprobante_id, contenido, almacen)
    except comprobantes.ComprobanteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except comprobantes.ComprobanteNoEditable as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except comprobantes.ArchivoDemasiadoGrande as error:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(error)
        ) from error
    except comprobantes.ArchivoInvalido as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except comprobantes.AlmacenamientoFallido as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router_alumno.post(
    "/{comprobante_id}/confirmar",
    response_model=ComprobanteAlumnoOut,
    summary="Confirmar el envío del comprobante",
)
def confirmar_comprobante(
    comprobante_id: int,
    session: SessionDep,
    usuario: AlumnoDep,
    almacen: AlmacenamientoDep,
) -> ComprobanteAlumnoOut:
    """Verifica el archivo almacenado y deja el comprobante en `PENDIENTE_REVISION`.

    422 si el contenido no es un PDF, JPG o PNG válido (y borra el objeto), 409 si es un envío
    duplicado, 503 si el storage no responde. No acredita el pago ni modifica la habilitación.
    """
    try:
        comprobante = comprobantes.confirmar(session, usuario, comprobante_id, almacen)
    except comprobantes.ComprobanteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except comprobantes.ComprobanteNoEditable as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except comprobantes.ArchivoDemasiadoGrande as error:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(error)
        ) from error
    except (comprobantes.ArchivoInvalido, comprobantes.ComprobanteInvalido) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except comprobantes.ComprobanteDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except comprobantes.AlmacenamientoFallido as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return comprobantes.serializar(comprobante)


@router_alumno.get(
    "/{comprobante_id}/archivo",
    summary="Descargar el archivo de un comprobante propio",
)
def descargar_mi_archivo(
    comprobante_id: int,
    session: SessionDep,
    usuario: AlumnoDep,
    almacen: AlmacenamientoDep,
):
    """Devuelve el adjunto del alumno autenticado, o redirige a una URL firmada temporal."""
    return _descargar(session, usuario, comprobante_id, almacen)


@router_admin.get(
    "",
    response_model=list[ComprobantePendienteOut],
    summary="Consultar los comprobantes pendientes de revisión",
)
def listar_pendientes(session: SessionDep, _admin: AdminDep) -> list[ComprobantePendienteOut]:
    """Bandeja de Secretaría. No crea cobranzas ni imputaciones: solo lista y permite abrir."""
    return comprobantes.listar_pendientes(session)


@router_admin.get(
    "/{comprobante_id}/archivo",
    summary="Descargar el archivo de un comprobante",
)
def descargar_archivo(
    comprobante_id: int,
    session: SessionDep,
    admin: AdminDep,
    almacen: AlmacenamientoDep,
):
    """Adjunto de un comprobante pendiente, para Secretaría."""
    return _descargar(session, admin, comprobante_id, almacen)


def _descargar(session: Session, usuario: Usuario, comprobante_id: int, almacen) -> Response:
    try:
        archivo = comprobantes.obtener_archivo(session, usuario, comprobante_id, almacen)
    except comprobantes.ComprobanteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except comprobantes.AlmacenamientoFallido as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    if archivo.url is not None:
        # URL firmada de vida corta: el binario no atraviesa la Function.
        return RedirectResponse(archivo.url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    nombre = urllib.parse.quote(archivo.nombre)
    return Response(
        content=archivo.contenido,
        media_type=archivo.mime,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{nombre}"},
    )


async def _leer_cuerpo(request: Request) -> bytes:
    """Lee el cuerpo con el tope de 5 MB aplicado antes de acumularlo entero."""
    trozos: list[bytes] = []
    total = 0
    async for trozo in request.stream():
        total += len(trozo)
        if total > TAMANO_MAXIMO_BYTES:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="El archivo no puede superar los 5 MB.",
            )
        trozos.append(trozo)
    return b"".join(trozos)

