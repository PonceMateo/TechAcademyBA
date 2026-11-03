"""Inscripciones: alta y categoría (HU #14 y #15), gestión de inscriptos por comisión (HU 60)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.inscripciones import (
    AccesoDeInscripcionOut,
    HabilitacionForzadaUpdate,
    InscripcionBaja,
    InscripcionCategoriaUpdate,
    InscripcionCreate,
    InscripcionesDeComisionOut,
    InscripcionOut,
)
from app.services import habilitacion, inscripciones

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

_solo_admin = require_roles(Rol.ADMIN)


@router.get(
    "",
    response_model=InscripcionesDeComisionOut,
    summary="Consultar los inscriptos de una comisión",
)
def listar_inscripciones_de_comision(
    comision_id: Annotated[int, Query(gt=0)],
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> InscripcionesDeComisionOut:
    """Listado de la gestión de una comisión (HU 60).

    200 con la comisión, el cupo, los inscriptos activos, las vacantes y todas las inscripciones
    —activas y dadas de baja—; 404 si la comisión no existe.
    """
    try:
        return inscripciones.listar_de_comision(session, comision_id)
    except inscripciones.ComisionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error



@router.post(
    "",
    response_model=InscripcionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Inscribir un alumno a una comisión",
)
def crear_inscripcion(
    cuerpo: InscripcionCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> InscripcionOut:
    try:
        inscripcion = inscripciones.crear_inscripcion(session, cuerpo)
    except inscripciones.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except inscripciones.ComisionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except inscripciones.InscripcionDuplicada as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except inscripciones.CupoLleno as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except inscripciones.ComisionFinalizada as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.CategoriaInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.PorcentajeInvalido as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.EmpresaRequerida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.EmpresaNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except inscripciones.ProrrateoNoDisponible as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return InscripcionOut.model_validate(inscripcion)


@router.patch(
    "/{inscripcion_id}",
    response_model=InscripcionOut,
    summary="Asignar la categoría de una inscripción",
)
def actualizar_categoria(
    inscripcion_id: int,
    cuerpo: InscripcionCategoriaUpdate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> InscripcionOut:
    try:
        inscripcion = inscripciones.actualizar_categoria(session, inscripcion_id, cuerpo)
    except inscripciones.InscripcionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except inscripciones.CategoriaInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.PorcentajeInvalido as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.EmpresaRequerida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except inscripciones.EmpresaNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return InscripcionOut.model_validate(inscripcion)


@router.post(
    "/{inscripcion_id}/baja",
    response_model=InscripcionOut,
    summary="Dar de baja una inscripción",
)
def dar_de_baja(
    inscripcion_id: int,
    cuerpo: InscripcionBaja,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Usuario, Depends(_solo_admin)],
) -> InscripcionOut:
    """Baja lógica de una inscripción (HU 60): cambia el estado a `BAJA` sin borrar la fila.

    200 con la inscripción dada de baja, 404 si no existe o no pertenece a esa comisión, 409 si ya
    no está `ACTIVA`. Los pagos, imputaciones y comprobantes siguen apuntando a la inscripción y no
    se modifica ningún importe.
    """
    try:
        inscripcion = inscripciones.dar_de_baja(
            session, inscripcion_id, cuerpo.comision_id, admin
        )
    except inscripciones.InscripcionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except inscripciones.TransicionDeInscripcionInvalida as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    return InscripcionOut.model_validate(inscripcion)


@router.post(
    "/{inscripcion_id}/habilitacion",
    response_model=AccesoDeInscripcionOut,
    summary="Forzar el estado de habilitación de una inscripción",
)
def forzar_habilitacion(
    inscripcion_id: int,
    cuerpo: HabilitacionForzadaUpdate,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AccesoDeInscripcionOut:
    """Forzaje manual del estado contrario al automático (HU #30 y #27).

    El alcance es la inscripción del camino y el actor sale de la sesión: el cuerpo no lleva
    usuario. 201 no aplica porque no se crea una inscripción; 404 si no existe, 409 si no está
    activa, ya tiene un forzado vigente o el estado pedido es el mismo que el automático, 422 si
    el motivo queda vacío o el estado no es válido.
    """
    try:
        override = habilitacion.forzar_estado(
            session, inscripcion_id, cuerpo.estado, cuerpo.motivo, admin
        )
    except habilitacion.InscripcionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (
        habilitacion.InscripcionNoActiva,
        habilitacion.ForzadoYaVigente,
        habilitacion.ForzadoIgualAlAutomatico,
    ) as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except (habilitacion.EstadoForzadoInvalido, habilitacion.MotivoVacio) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return AccesoDeInscripcionOut(
        estado=override.estado_forzado, causa=override.motivo, forzado=True
    )


@router.delete(
    "/{inscripcion_id}/habilitacion",
    response_model=AccesoDeInscripcionOut,
    summary="Quitar el forzado y volver a la regla automática",
)
def quitar_habilitacion_forzada(
    inscripcion_id: int,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AccesoDeInscripcionOut:
    """Desactiva el forzado vigente y registra la quita en la auditoría (HU #30).

    La fila histórica se conserva. La respuesta trae el estado que vuelve a derivar la regla
    automática con la categoría, la beca y las cobranzas acreditadas del momento. 404 si la
    inscripción no existe, 409 si no está activa o no tiene forzado vigente.
    """
    try:
        inscripcion = habilitacion.quitar_forzado(session, inscripcion_id, admin)
    except habilitacion.InscripcionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (habilitacion.InscripcionNoActiva, habilitacion.SinForzadoVigente) as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error

    estado, causa, forzado = habilitacion.derivar_estado(session, inscripcion)
    return AccesoDeInscripcionOut(estado=estado, causa=causa, forzado=forzado)
