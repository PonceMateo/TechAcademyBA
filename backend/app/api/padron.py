"""Padrón de docentes: consulta y alta (historias #9 y #10).

Las rutas son de Administración, igual que las del catálogo: exigen rol `ADMIN` con
`require_roles`, que devuelve 403 a cualquier otro rol y 401 si falta el token. La lógica de
negocio está en `app/services/padron.py`; acá solo se traduce a un código HTTP (D1).

**El 409 del alta dice qué dato se repitió.** Los criterios de #9 piden saber si colisionó el
DNI o el email, y un "el docente ya existe" no alcanza para corregir el formulario. El mensaje
sale del servicio, que es el único lugar donde se decide, para que el camino normal y el de la
carrera entre dos altas simultáneas no puedan decir cosas distintas.
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
from app.schemas.padron import DocenteCreate, DocenteOut
from app.services import padron
from app.services.emails import EmailAlreadyRegistered

router = APIRouter(prefix="/docentes", tags=["padron"])

#: Todas las rutas del padrón son de Administración.
_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[DocenteOut], summary="Consultar el padrón de docentes")
def listar_docentes(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[DocenteOut]:
    return [DocenteOut.model_validate(d) for d in padron.listar_docentes(session)]


@router.post(
    "",
    response_model=DocenteOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dar de alta un docente",
)
def crear_docente(
    cuerpo: DocenteCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> DocenteOut:
    """Alta de docente. El cuerpo admite nombre, apellido, DNI, email y teléfono: **ningún
    campo de CUIL**, porque el CUIL es opcional (D33) y un `cuil` en el JSON es un 422.

    Crea el docente y su cuenta de acceso en una sola transacción, con la contraseña de
    demostración y sin cambio pendiente.

    201 con el docente, 409 si el DNI o el email ya están registrados —el mensaje dice cuál—,
    422 si falta un campo obligatorio o el email no tiene forma, y 409 si el correo ya está en
    el padrón de alumnos.
    """
    try:
        docente = padron.crear_docente(session, cuerpo)
    except padron.DocenteDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El alta chocó con un dato ya existente."
        ) from error

    # La respuesta recién creada no tiene nada que contar: el docente todavía no tiene
    # comisiones asignadas.
    docente.cantidad_comisiones = 0
    return DocenteOut.model_validate(docente)
