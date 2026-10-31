"""Autoservicio del docente: su perfil y sus datos de contacto (HU 90).

**El router es `/docente`, en singular, y ninguna ruta recibe el identificador del docente.** El
legajo sale de `usuario.docente` de la cuenta autenticada, así que no hay ningún parámetro que se
pueda cambiar para pedir o modificar el perfil de otro docente (D60 y D63).

**El rol se exige con `require_roles`**, que además devuelve `403` a una cuenta con cambio de
contraseña pendiente (D45): el docente recién dado de alta entra a cambiar su contraseña y nada más.

La lógica está en `app/services/docente.py`; esta capa solo traduce a códigos HTTP (D1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.docente import PerfilDocenteOut, PerfilDocenteUpdate
from app.services import docente
from app.services.emails import EmailAlreadyRegistered

router = APIRouter(prefix="/docente", tags=["docente"])

_solo_docente = require_roles(Rol.DOCENTE)


@router.get("/mi-perfil", response_model=PerfilDocenteOut, summary="Consultar mi perfil")
def obtener_perfil(
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_docente)],
) -> PerfilDocenteOut:
    """Nombre, apellido, DNI, CUIL, email, teléfono y comisiones del docente autenticado."""
    try:
        return docente.obtener_perfil(session, usuario)
    except docente.SinDocenteAsociado as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error)) from error


@router.put("/mi-perfil", response_model=PerfilDocenteOut, summary="Editar mis datos de contacto")
def actualizar_perfil(
    cuerpo: PerfilDocenteUpdate,
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_docente)],
) -> PerfilDocenteOut:
    """Guarda el email y el teléfono del docente en su cuenta y en el padrón.

    Solo esos dos campos: nombre, apellido, DNI y CUIL no están en el contrato, así que un cuerpo
    que los intente mandar es un `422` (`extra="forbid"`). El email repetido es un `409` que no
    modifica nada, y un email o un teléfono con forma inválida es un `422` que conserva lo que
    había.
    """
    try:
        return docente.actualizar_perfil(session, usuario, cuerpo)
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except docente.SinDocenteAsociado as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error)) from error
