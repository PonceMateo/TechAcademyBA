"""Link de clase por comisión (HU #33)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.padron import Usuario
from app.schemas.clases import LinkClaseCreate, LinkClaseOut
from app.services import clases

router = APIRouter(prefix="/clases", tags=["clases"])


@router.get("/link", response_model=LinkClaseOut, summary="Consultar el link de la clase")
def obtener_link(
    session: Annotated[Session, Depends(get_db)],
    _usuario: Annotated[Usuario, Depends(get_current_user)],
    comision: Annotated[str, Query()],
) -> LinkClaseOut:
    try:
        link = clases.obtener_link(session, comision)
    except clases.ComisionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return LinkClaseOut(ok=True, link=link)


@router.post("/link", response_model=LinkClaseOut, summary="Cargar el link de la clase")
def guardar_link(
    cuerpo: LinkClaseCreate,
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(get_current_user)],
) -> LinkClaseOut:
    try:
        link = clases.guardar_link(session, cuerpo.comision, cuerpo.url, usuario)
    except clases.ComisionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except clases.NoAutorizado as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except clases.UrlInvalida as error:
        # Se devuelve 422 con el detalle para que la UI muestre el motivo exacto.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return LinkClaseOut(ok=True, link=link)
