"""Padrón de alumnos: consulta (lectura para inscripción, HU #14).

Las rutas son de Administración: exigen rol `ADMIN`. La lógica está en `app/services/alumnos.py`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.alumnos import AlumnoOut
from app.services import alumnos

router = APIRouter(prefix="/alumnos", tags=["padron"])

_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[AlumnoOut], summary="Consultar el padrón de alumnos")
def listar_alumnos(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[AlumnoOut]:
    resultado = []
    for alumno in alumnos.listar_alumnos(session):
        resultado.append(AlumnoOut.model_validate(alumno))
    return resultado
