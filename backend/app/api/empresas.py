"""Empresas: consulta y alta (historia #18).

Mismo patrón que `app/api/padron.py`: rutas de Administración que exigen rol `ADMIN` con
`require_roles`, y la lógica en `app/services/empresas.py` (D1). El 409 del duplicado trae
en el detalle la razón social y el CUIT de la empresa existente, porque el criterio de #18
pide mostrar con qué empresa colisionó.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.empresas import EmpresaCreate, EmpresaOut
from app.services import empresas

router = APIRouter(prefix="/empresas", tags=["empresas"])

_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[EmpresaOut], summary="Consultar las empresas")
def listar_empresas(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[EmpresaOut]:
    return [EmpresaOut.model_validate(e) for e in empresas.listar_empresas(session)]


@router.post(
    "",
    response_model=EmpresaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dar de alta una empresa",
)
def crear_empresa(
    cuerpo: EmpresaCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> EmpresaOut:
    """Alta de empresa. El cuerpo admite únicamente razón social, CUIT e indicador de
    Factura A: cualquier otro campo es un 422.

    201 con la empresa, 409 si el CUIT ya está registrado —con la empresa existente en el
    detalle— y 422 si falta un obligatorio o el CUIT no tiene dígito verificador válido.
    """
    try:
        empresa = empresas.crear_empresa(session, cuerpo)
    except empresas.EmpresaDuplicada as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El alta chocó con un dato ya existente."
        ) from error

    return EmpresaOut.model_validate(empresa)
