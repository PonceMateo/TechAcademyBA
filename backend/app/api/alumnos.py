"""Padrón de alumnos: consulta, búsqueda, alta, edición, baja y reactivación (HUs #13, #16 y #17).

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
from app.schemas.alumnos import (
    AlumnoCreadoOut,
    AlumnoCreate,
    AlumnoOut,
    AlumnoUpdate,
    RestablecerPasswordRequest,
)
from app.services import alumnos
from app.services.auth import PasswordInvalida
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


@router.get(
    "/reactivable",
    response_model=AlumnoOut | None,
    summary="Consultar si un alta corresponde a un alumno dado de baja",
)
def consultar_alumno_reactivable(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
    documento: str = Query(min_length=1, max_length=20),
    email: str = Query(min_length=3, max_length=255),
) -> AlumnoOut | None:
    """Devuelve el alumno inactivo reactivable para ese DNI y email, o `null` (HU #17).

    Solo devuelve un registro si el DNI o el email pertenecen al mismo alumno inactivo y no hay
    conflicto con un registro activo, otro padrón ni otra cuenta. La pantalla usa esta consulta
    después de un `409` del alta para ofrecer **Reactivar alumno** sin crear un duplicado.
    """
    alumno = alumnos.buscar_alumno_reactivable(session, documento, email)
    return AlumnoOut.model_validate(alumno) if alumno is not None else None


@router.put(
    "/{alumno_id}",
    response_model=AlumnoOut,
    summary="Editar los datos de un alumno",
)
def editar_alumno(
    alumno_id: int,
    cuerpo: AlumnoUpdate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AlumnoOut:
    """Edita DNI, nombre, email y teléfono conservando el `id` y el legajo (HU #17).

    Las validaciones son las del alta. Un documento o email que ya pertenece a otro registro
    responde 409 nombrando el campo; un `id` inexistente responde 404.
    """
    try:
        actualizado = alumnos.editar_alumno(
            session, alumnos.obtener_alumno(session, alumno_id), cuerpo
        )
    except alumnos.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except alumnos.AlumnoDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="La edición chocó con un dato ya existente."
        ) from error

    return AlumnoOut.model_validate(actualizado)


@router.post(
    "/{alumno_id}/reactivar",
    response_model=AlumnoCreadoOut,
    summary="Reactivar un alumno dado de baja",
)
def reactivar_alumno(
    alumno_id: int,
    cuerpo: AlumnoCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AlumnoCreadoOut:
    """Reactiva el mismo registro y le entrega una nueva contraseña inicial (HU #17).

    El DNI, el legajo, las inscripciones, los pagos y el historial se conservan. La cuenta vuelve
    a estar activa y con `must_change_password = true`. 409 si el alumno ya está activo o si el
    DNI/email choca con otro registro; 404 si el alumno no existe.
    """
    try:
        reactivado = alumnos.reactivar_alumno(
            session, alumnos.obtener_alumno(session, alumno_id), cuerpo
        )
    except alumnos.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except alumnos.AlumnoYaActivo as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except alumnos.AlumnoDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La reactivación chocó con un dato ya existente.",
        ) from error

    return AlumnoCreadoOut(
        **AlumnoOut.model_validate(reactivado.alumno).model_dump(),
        password_inicial=reactivado.password_inicial,
    )


@router.post(
    "/{alumno_id}/password",
    response_model=AlumnoOut,
    summary="Restablecer la contraseña de un alumno",
)
def restablecer_password(
    alumno_id: int,
    cuerpo: RestablecerPasswordRequest,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AlumnoOut:
    """Define una nueva contraseña y exige su cambio en el próximo ingreso (HU #17).

    La contraseña anterior deja de ser válida; la base guarda solo el hash y la respuesta no
    incluye la contraseña en claro. 409 si el alumno no tiene cuenta de acceso, 422 si la nueva
    no cumple la regla y 404 si el alumno no existe.
    """
    try:
        actualizado = alumnos.restablecer_password(
            session, alumnos.obtener_alumno(session, alumno_id), cuerpo.new_password
        )
    except alumnos.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except alumnos.AlumnoSinCuenta as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except PasswordInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return AlumnoOut.model_validate(actualizado)


@router.delete(
    "/{alumno_id}",
    response_model=AlumnoOut,
    summary="Dar de baja lógica a un alumno",
)
def eliminar_alumno(
    alumno_id: int,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> AlumnoOut:
    """Baja lógica: desactiva el alumno y su cuenta sin borrar filas ni relaciones (HU #17).

    Devuelve el alumno con `activo = false`. 409 si ya estaba dado de baja y 404 si no existe.
    """
    try:
        dado_de_baja = alumnos.dar_de_baja(
            session, alumnos.obtener_alumno(session, alumno_id)
        )
    except alumnos.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except alumnos.AlumnoYaDadoDeBaja as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error

    return AlumnoOut.model_validate(dado_de_baja)
