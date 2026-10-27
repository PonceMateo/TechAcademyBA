"""Inscripciones: alta (HU #14)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.inscripciones import (
    InscripcionCategoriaUpdate,
    InscripcionCreate,
    InscripcionOut,
)
from app.services import inscripciones

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

_solo_admin = require_roles(Rol.ADMIN)


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
