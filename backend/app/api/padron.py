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

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.padron import (
    DocenteCreadoOut,
    DocenteCreate,
    DocenteOut,
    DocenteUpdate,
    RestablecerPasswordRequest,
)
from app.services import padron
from app.services.auth import PasswordInvalida
from app.services.emails import EmailAlreadyRegistered

router = APIRouter(prefix="/docentes", tags=["padron"])

#: Todas las rutas del padrón son de Administración.
_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[DocenteOut], summary="Consultar el padrón de docentes")
def listar_docentes(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
    q: str | None = Query(default=None, max_length=100),
) -> list[DocenteOut]:
    """Padrón de docentes activos, con búsqueda opcional por nombre, apellido, DNI o email.

    `q` busca desde el comienzo de las palabras del nombre o del apellido, en orden, y desde el
    comienzo del DNI o del email. Sin `q`, devuelve el listado habitual. La respuesta incluye las
    comisiones reales de cada docente (historia #10).
    """
    return [DocenteOut.model_validate(d) for d in padron.listar_docentes(session, q)]


@router.post(
    "",
    response_model=DocenteCreadoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dar de alta un docente",
)
def crear_docente(
    cuerpo: DocenteCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> DocenteCreadoOut:
    """Alta de docente. El cuerpo admite nombre, apellido, DNI, email, teléfono opcional y
    `cuil` opcional, que se valida contra el DNI del mismo cuerpo (D57): 11 dígitos, prefijo
    permitido y los 8 del medio iguales al DNI. El dígito verificador no se calcula.

    Crea el docente y su cuenta de acceso en una sola transacción. La cuenta nace con una
    contraseña inicial generada —`<primer nombre><DNI>`— y con cambio obligatorio en el primer
    ingreso (HU #66). **No envía ningún correo**: la respuesta trae `password_inicial` para que
    el administrador se la entregue al docente.

    201 con el docente y la contraseña inicial, 409 si el DNI o el email ya están registrados
    —el mensaje dice cuál—, 422 si falta un campo obligatorio o el email no tiene forma, y 409 si
    el correo ya está en el padrón de alumnos.
    """
    try:
        alta = padron.crear_docente(session, cuerpo)
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
    docente = alta.docente
    docente.cantidad_comisiones = 0
    docente.comisiones = []  # type: ignore[attr-defined]
    return DocenteCreadoOut(
        **DocenteOut.model_validate(docente).model_dump(),
        password_inicial=alta.password_inicial,
    )


@router.put("/{docente_id}", response_model=DocenteOut, summary="Editar un docente")
def editar_docente(
    docente_id: int,
    cuerpo: DocenteUpdate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> DocenteOut:
    """Edición de los datos personales del docente (HU #11).

    El cuerpo admite nombre, apellido, DNI, mail, teléfono opcional y `cuil` opcional con las
    mismas validaciones del alta. Omitir `cuil` conserva el que el docente ya tenía y un `null`
    explícito lo borra (D57). Sincroniza el nombre y el email de la cuenta vinculada
    en la misma transacción, así que el docente entra con el correo nuevo.

    200 con el docente actualizado —con sus comisiones—, 404 si no existe, 409 si el DNI o el
    email ya pertenecen a otro registro —el mensaje dice cuál— y 422 si falta un campo
    obligatorio o el email no tiene forma.
    """
    try:
        docente = padron.editar_docente(
            session, padron.obtener_docente(session, docente_id), cuerpo
        )
    except padron.DocenteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except padron.DocenteDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="La edición chocó con un dato ya existente."
        ) from error
    return DocenteOut.model_validate(docente)


@router.post(
    "/{docente_id}/password",
    response_model=DocenteOut,
    summary="Restablecer la contraseña de un docente",
)
def restablecer_password(
    docente_id: int,
    cuerpo: RestablecerPasswordRequest,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> DocenteOut:
    """Define una nueva contraseña y exige su cambio en el próximo ingreso (HU #11).

    La contraseña anterior deja de ser válida; la base guarda solo el hash y la respuesta no
    incluye la contraseña en claro. 409 si el docente no tiene cuenta de acceso, 422 si la nueva
    no cumple la regla y 404 si el docente no existe.
    """
    try:
        actualizado = padron.restablecer_password(
            session, padron.obtener_docente(session, docente_id), cuerpo.new_password
        )
    except padron.DocenteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except padron.DocenteSinCuenta as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except PasswordInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return DocenteOut.model_validate(actualizado)
