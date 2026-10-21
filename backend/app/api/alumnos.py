"""Padrón de alumnos: consulta, búsqueda y alta (historias #13 y #16).

Las rutas son de Administración, igual que las del padrón de docentes: exigen rol `ADMIN` con
`require_roles`, que devuelve 403 a cualquier otro rol y 401 si falta el token. La lógica de
negocio está en `app/services/alumnos.py`; acá solo se traduce a un código HTTP (D1).

**El 409 del alta dice qué dato se repitió y nada más.** No incluye el nombre ni el documento del
alumno existente: es la desviación consciente del criterio «muestra el alumno existente» de la
historia #13, registrada en D44 y pendiente de aprobación del equipo. Si el correo ya pertenece a
otro padrón, el mensaje nombra ese padrón, como pide el escenario correspondiente.

La consulta del padrón acepta `?q=` para buscar por DNI o email (historia #16) y devuelve la
comisión y la categoría de la inscripción del alumno cuando existe.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.alumnos import AlumnoCreadoOut, AlumnoCreate, AlumnoOut
from app.services import alumnos
from app.services.emails import EmailAlreadyRegistered

router = APIRouter(prefix="/alumnos", tags=["padron"])

#: Todas las rutas del padrón de alumnos son de Administración.
_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[AlumnoOut], summary="Consultar el padrón de alumnos")
def listar_alumnos(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
    q: str | None = Query(default=None),
) -> list[AlumnoOut]:
    return [AlumnoOut.model_validate(a) for a in alumnos.listar_alumnos(session, q)]


@router.post(
    "",
    response_model=AlumnoCreadoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dar de alta un alumno",
)
def crear_alumno(
    cuerpo: AlumnoCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AlumnoCreadoOut:
    """Alta de alumno. El cuerpo admite documento, nombre, email y teléfono: **ningún campo de
    tipo de documento**, porque esta entrega registra solo DNI y un `tipo_documento` en el JSON
    es un 422.

    Crea el alumno y su cuenta de acceso en una sola transacción. La cuenta nace con una
    contraseña inicial generada —`<primer nombre><DNI>`— y con cambio obligatorio en el primer
    ingreso. **No envía ningún correo**: la respuesta trae `password_inicial` para que el
    administrador se la entregue al alumno.

    201 con el alumno y la contraseña inicial, 409 si el documento o el email ya están
    registrados —el mensaje dice cuál—, 422 si falta un campo obligatorio, el DNI no tiene 7 u 8
    dígitos o el email no tiene forma, y 409 si el correo ya está en otro padrón.
    """
    try:
        alta = alumnos.crear_alumno(session, cuerpo)
    except alumnos.AlumnoDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El alta chocó con un dato ya existente."
        ) from error

    return AlumnoCreadoOut(
        **AlumnoOut.model_validate(alta.alumno).model_dump(),
        password_inicial=alta.password_inicial,
    )
