"""Autoservicio del alumno: sus cursadas, sus pagos y sus datos de contacto (HUs #38, #42 y #43).

**El router es `/alumno`, en singular, y ninguna ruta recibe el identificador del alumno.** El
legajo sale de `usuario.alumno` de la cuenta autenticada, así que no hay ningún parámetro que se
pueda cambiar para pedir los datos de otro alumno (D60).

**Los tres roles están separados por router.** `/alumnos` es de Administración y exige `ADMIN`; acá
se exige `ALUMNO` con `require_roles`, que además devuelve `403` a una cuenta con cambio de
contraseña pendiente (D45): el alumno recién dado de alta entra a cambiar su contraseña y nada más.

La lógica de las cursadas y del perfil está en `app/services/alumno.py` y la de los pagos en
`app/services/cobranzas.py`; esta capa solo traduce a códigos HTTP (D1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.alumno import (
    DetalleCursadaOut,
    InscripcionAlumnoOut,
    PerfilAlumnoOut,
    PerfilAlumnoUpdate,
)
from app.schemas.cobranzas import PagoAlumnoOut
from app.services import alumno, cobranzas
from app.services.emails import EmailAlreadyRegistered

router = APIRouter(prefix="/alumno", tags=["alumno"])

_solo_alumno = require_roles(Rol.ALUMNO)

#: El mensaje del `404` del detalle. Es el mismo para una comisión ajena y para un código que no
#: existe, y no menciona la comisión: la respuesta no puede servir para enumerar el catálogo.
MENSAJE_CURSADA_NO_ENCONTRADA = "No encontré esa cursada entre tus inscripciones."


@router.get(
    "/inscripciones",
    response_model=list[InscripcionAlumnoOut],
    summary="Consultar mis cursadas",
)
def listar_inscripciones(
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> list[InscripcionAlumnoOut]:
    """Las cursadas del alumno autenticado, con el estado de habilitación y su causa.

    Devuelve una lista vacía —no un error— cuando el alumno no tiene inscripciones, y el estado
    derivado es el mismo que ve Administración para esa inscripción (HU 42).
    """
    return alumno.listar_inscripciones(session, usuario)


@router.get(
    "/inscripciones/{codigo}",
    response_model=DetalleCursadaOut,
    summary="Consultar el detalle de una cursada propia",
)
def obtener_detalle(
    codigo: str,
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> DetalleCursadaOut:
    """Docente, horarios, categoría, estado, período y próximos encuentros de la cursada.

    Responde `404` cuando el código no corresponde a una inscripción del alumno que llama, sea
    porque la comisión no existe o porque es de otra persona: el mensaje es el mismo en los dos
    casos. **No incluye el link de la clase**, que llega con la HU 39.
    """
    try:
        return alumno.obtener_detalle(session, usuario, codigo)
    except alumno.CursadaNoEncontrada as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=MENSAJE_CURSADA_NO_ENCONTRADA
        ) from error


@router.get(
    "/pagos",
    response_model=list[PagoAlumnoOut],
    summary="Consultar mis pagos",
)
def listar_mis_pagos(
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> list[PagoAlumnoOut]:
    """Comprobantes imputados al legajo del alumno que entra, del más reciente al más viejo.

    `importe` es lo que se le imputó a él: si el pago se repartió entre varios alumnos, cada uno ve
    su parte. Un comprobante sin imputar a su legajo no aparece. Sin token responde 401 y con otro
    rol, 403.
    """
    return [
        PagoAlumnoOut.model_validate(
            cobranzas.serializar_pago_de_alumno(cobranza, usuario.alumno_id)
        )
        for cobranza in cobranzas.listar_pagos_de_alumno(session, usuario.alumno_id)
    ]


@router.get("/mi-perfil", response_model=PerfilAlumnoOut, summary="Consultar mi perfil")
def obtener_perfil(
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> PerfilAlumnoOut:
    """Nombre, documento, email y teléfono de la cuenta del alumno autenticado."""
    try:
        return alumno.obtener_perfil(usuario)
    except alumno.SinAlumnoAsociado as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error)) from error


@router.put("/mi-perfil", response_model=PerfilAlumnoOut, summary="Editar mis datos de contacto")
def actualizar_perfil(
    cuerpo: PerfilAlumnoUpdate,
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> PerfilAlumnoOut:
    """Guarda el email y el teléfono del alumno en su cuenta y en el padrón.

    Solo esos dos campos: el documento, el nombre y el identificador del sistema no están en el
    contrato, así que un cuerpo que los intente mandar es un `422` (`extra="forbid"`). El email
    repetido es un `409` que no modifica nada, y un email o un teléfono con forma inválida es un
    `422` que conserva lo que había.
    """
    try:
        return alumno.actualizar_perfil(session, usuario, cuerpo)
    except EmailAlreadyRegistered as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except alumno.SinAlumnoAsociado as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error)) from error
