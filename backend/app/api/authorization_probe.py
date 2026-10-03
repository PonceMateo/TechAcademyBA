"""Endpoints de prueba de la autorización por rol (5.4).

La spec pide "un endpoint de prueba por cada rol" para demostrar que la dependencia
`require_roles` se aplica y se comporta igual en todas partes. No son pantallas: son la
prueba viva de que el control de acceso está montado, y sus contratos son los que
verifican 5.4.

**Se borran cuando lleguen las pantallas de verdad.** Cada línea de esta tabla es un
`require_roles` real, así que cuando exista la primera ruta de administración, de docente
o de alumno, esa ruta reemplaza a la de acá y este módulo desaparece. No están detrás de
una bandera de entorno a propósito: una ruta de prueba que se puede apagar es una ruta de
prueba que nadie prueba.

Cada ruta declara qué roles admite y nada más. No devuelven datos del dominio: devuelven
quién entró, que es lo que hace falta para ver que la dependencia hizo su trabajo.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.models.enums import Rol
from app.models.padron import Usuario

router = APIRouter(prefix="/auth/probe", tags=["authorization"])


def _eco(usuario: Usuario, rol_de_la_ruta: str) -> dict[str, object]:
    return {
        "acceso_concedido": True,
        "rol_de_la_ruta": rol_de_la_ruta,
        "rol_del_usuario": usuario.rol,
        "usuario_id": usuario.id,
    }


@router.get("/admin", summary="Ruta que solo admite ADMIN")
def probe_admin(
    usuario: Annotated[Usuario, Depends(require_roles(Rol.ADMIN))],
) -> dict[str, object]:
    return _eco(usuario, Rol.ADMIN.value)


@router.get("/docente", summary="Ruta que solo admite DOCENTE")
def probe_docente(
    usuario: Annotated[Usuario, Depends(require_roles(Rol.DOCENTE))],
) -> dict[str, object]:
    return _eco(usuario, Rol.DOCENTE.value)


@router.get("/alumno", summary="Ruta que solo admite ALUMNO")
def probe_alumno(
    usuario: Annotated[Usuario, Depends(require_roles(Rol.ALUMNO))],
) -> dict[str, object]:
    return _eco(usuario, Rol.ALUMNO.value)


@router.get(
    "/personal",
    summary="Ruta que admite dos roles, para probar que la dependencia es parametrizable",
)
def probe_personal(
    usuario: Annotated[Usuario, Depends(require_roles(Rol.ADMIN, Rol.DOCENTE))],
) -> dict[str, object]:
    """Administración y docentes comparten esta ruta: es el caso de "el rol **o los
    roles** admitidos" de la spec, que con tres rutas de un solo rol no quedaría cubierto."""
    return _eco(usuario, "ADMIN,DOCENTE")
