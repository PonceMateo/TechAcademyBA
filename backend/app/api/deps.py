"""Dependencias de autenticación y autorización reutilizables (5.3, 5.4, D2).

**Por qué acá y no en `app/core`.** D1 reserva `app/core` para configuración, seguridad y
dependencias, y la parte criptográfica (`app/core/security.py`) está efectivamente ahí.
La parte que resuelve *la cuenta* necesita `app.models.Usuario`, y `app/core` no puede
importar `app.models`: es la base de la pirámide y la prueba de capas de 3.1 lo verifica.
Las dependencias de FastAPI que dependen del dominio van en la capa de API, que es donde
viven los endpoints que las van a usar.

M5 en `docs/decisions.md` registra esta lectura.

**El token no es la autoridad.** `get_current_user` resuelve el `sub` contra la base en
cada request. Es lo que hace que una cuenta dada de baja o a la que le cambiaron el rol
deje de funcionar sin esperar a que venza el token, y que `must_change_password` /
`is_active` sean el valor vigente y no una foto del momento del login. El claim `rol` se
lee, pero no decide: el rol que manda es el de la fila de `usuario`.

**401 y 403 son cosas distintas.** 401 es "no sé quién sos"; 403 es "sé quién sos y no
tenés permiso". El mensaje de 401 es una constante, la misma para toda ruta protegida, y
no menciona ni el camino ni el rol que la ruta declara: una respuesta que dijera "falta
permiso de ADMIN" confirmaría que la ruta existe y qué roles la atraviesan.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenInvalido, leer_token_acceso
from app.models.enums import Rol
from app.models.padron import Usuario

#: Respuesta de 401 para cualquier problema con el token: ausente, mal formado, expirado o
#: firmado con otro secreto. Es una constante para que dos rutas protegidas no puedan
#: decir cosas distintas.
MENSAJE_TOKEN_INVALIDO = "Token inválido o ausente."

#: Respuesta de 403. Solo la ve alguien que ya se autenticó, así que sí puede nombrar el
#: motivo: no hay nada que ocultar y el mensaje es el que le sirve al usuario.
MENSAJE_SIN_PERMISOS = "Tu rol no tiene acceso a esta sección."

#: `auto_error=False` para que la respuesta la arme esta capa: el esquema de autenticación
#: de FastAPI devuelve 403 cuando no encuentra encabezado, y el 401 tiene que ser
#: responsabilidad de `get_current_user`, con su mensaje y su `WWW-Authenticate`.
_esquema_bearer = HTTPBearer(auto_error=False, description="Token devuelto por POST /auth/login")


def get_current_user(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_esquema_bearer)],
    session: Annotated[Session, Depends(get_db)],
) -> Usuario:
    """Devuelve la cuenta del token, o responde 401.

    El orden importa: primero se valida la firma, después se busca la cuenta. Al revés, una
    llamada con un token falso pagaría una consulta a la base antes de descubrir que el
    token no valía.
    """
    if credenciales is None or not credenciales.credentials:
        raise _no_autenticado()

    try:
        claims = leer_token_acceso(credenciales.credentials)
    except TokenInvalido:
        raise _no_autenticado() from None

    usuario = session.get(Usuario, claims.usuario_id)
    if usuario is None or not usuario.is_active:
        # El token es criptográficamente válido pero la cuenta ya no sirve. Misma respuesta
        # que un token roto: si fuera distinta, confirmaría que el token es auténtico.
        raise _no_autenticado()

    return usuario


def require_roles(*roles: Rol | str) -> Callable[[Usuario], Usuario]:
    """Construye una dependencia que admite solo los roles declarados.

    Se usa como `usuario: Annotated[Usuario, Depends(require_roles(Rol.ADMIN))]`. Es
    parametrizable y reutilizable: cualquier endpoint declara los roles que admite y el
    acceso se evalúa siempre con la misma regla.

    Los roles se normalizan a texto acá, así que `require_roles(Rol.ADMIN)` y
    `require_roles("ADMIN")` significan lo mismo.
    """
    admitidos = frozenset(str(rol) for rol in roles)
    if not admitidos:
        raise ValueError("require_roles necesita al menos un rol")

    declarados = ", ".join(sorted(admitidos))

    def dependencia(usuario: Annotated[Usuario, Depends(get_current_user)]) -> Usuario:
        if usuario.rol not in admitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MENSAJE_SIN_PERMISOS,
                headers={"X-Roles-Admitidos": declarados},
            )
        return usuario

    return dependencia


def _no_autenticado() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=MENSAJE_TOKEN_INVALIDO,
        headers={"WWW-Authenticate": "Bearer"},
    )
