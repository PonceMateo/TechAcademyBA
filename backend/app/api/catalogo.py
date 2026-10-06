"""Catálogo: cursos, comisiones y sedes (historias #1, #2, #5 y #8).

Las rutas son de Administración: exigen rol `ADMIN` con `require_roles`, que devuelve 403 a
cualquier otro rol y 401 si falta el token. Toda la lógica de negocio está en
`app/services/catalogo.py`; acá solo se traduce el resultado a un código HTTP (D1).

**Los mensajes de rechazo son texto de interfaz, en es-AR (D19), y salen del servicio.** No se
arman acá para que la ruta y el camino de la carrera no puedan decir cosas distintas: el
mensaje que ve la secretaría tiene que ser el mismo tanto si el rechazo viene de la
comprobación previa como del índice único.

**Los 409 son dos cosas distintas y el mensaje las distingue.** `CursoDuplicado` y
`DocenteDuplicado` son un dato ya cargado: hay que corregir el formulario. La carrera entre dos
altas simultáneas es una condición interna: hay que reintentar. Un 409 con el mensaje
equivocado hace que la secretaría cambie un nombre que no era el problema.
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
from app.schemas.catalogo import ComisionCreate, ComisionOut, CursoCreate, CursoOut, SedeOut
from app.services import catalogo

router = APIRouter(tags=["catalogo"])

#: Todas las rutas del catálogo son de Administración.
_solo_admin = require_roles(Rol.ADMIN)


@router.get("/cursos", response_model=list[CursoOut], summary="Consultar el catálogo de cursos")
def listar_cursos(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[CursoOut]:
    return [CursoOut.model_validate(curso) for curso in catalogo.listar_cursos(session)]


@router.post(
    "/cursos",
    response_model=CursoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dar de alta un curso",
)
def crear_curso(
    cuerpo: CursoCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> CursoOut:
    """Alta de curso. El cuerpo admite **solo** nombre y descripción: un `codigo` en el JSON
    es un 422, porque el código lo genera el sistema (D32).

    201 con el curso y su código generado, 409 si el nombre ya está registrado, 422 si falta el
    nombre o llega vacío.
    """
    try:
        curso = catalogo.crear_curso(session, cuerpo)
    except catalogo.CursoDuplicado as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise _conflicto_de_restriccion(error) from error
    return CursoOut.model_validate(curso)


@router.get(
    "/comisiones", response_model=list[ComisionOut], summary="Consultar el catálogo de comisiones"
)
def listar_comisiones(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[ComisionOut]:
    return [ComisionOut.model_validate(c) for c in catalogo.listar_comisiones(session)]


@router.post(
    "/comisiones",
    response_model=ComisionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir una comisión de un curso",
)
def crear_comision(
    cuerpo: ComisionCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> ComisionOut:
    """Alta de comisión.

    201 con la comisión y su código derivado, 404 si el curso, el docente o la sede no existen,
    409 si la numeración chocó con otra alta simultánea, 422 si falta un campo obligatorio, si
    el cupo o el arancel no son positivos o si la modalidad exige sede y no vino.
    """
    try:
        comision = catalogo.crear_comision(session, cuerpo)
    except catalogo.CursoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except catalogo.DocenteNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except catalogo.SedeNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except catalogo.NumeracionDeComisionEnConflicto as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        raise _regla_de_alta_rota(error) from error
    return ComisionOut.model_validate(comision)


@router.get("/sedes", response_model=list[SedeOut], summary="Consultar las sedes de cursada")
def listar_sedes(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> list[SedeOut]:
    """Solo lectura: no hay historia que pida el alta de una sede, pero la modalidad de la
    comisión (#8) necesita la lista para que el operador pueda elegir."""
    return [SedeOut.model_validate(sede) for sede in catalogo.listar_sedes(session)]


def _conflicto_de_restriccion(error: IntegrityError) -> HTTPException:
    """Un `IntegrityError` del alta de curso que no se tradujo a un rechazo con nombre.

    Solo llega por la carrera entre dos altas simultáneas con el mismo nombre, que la
    comprobación previa no puede ver. 409 con un mensaje que no culpa a la secretaría de algo
    que hizo mal.
    """
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail="Ese nombre de curso se acaba de registrar. Probá de nuevo.",
    )


def _regla_de_alta_rota(error: IntegrityError) -> HTTPException:
    """Un CHECK de la base que el esquema de Pydantic no cubrió.

    Los CHECK de `comision` —cupo positivo, arancel positivo, sede obligatoria para Presencial e
    Híbrido— se traducen a 422 con el texto de PostgreSQL, que dice qué regla se incumplió.
    """
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error.orig))
