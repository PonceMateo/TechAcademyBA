"""Autenticación: `POST /auth/login` y `GET /auth/me` (5.2, 5.3).

D14 decía que estas dos rutas eran las **únicas** llamadas de red que la interfaz iba a hacer.
Eso cambió con el change `altas-catalogo-docentes`, que subió `VITE_API_MODE` a `api` por
omisión: el login ya no es la excepción, es la primera de muchas.

`POST /auth/login` devuelve el mismo cuerpo y el mismo código para un correo inexistente y
para una contraseña incorrecta. El mensaje no se escribe acá: viene de
`app.services.auth`, que es el único lugar donde se decide, para que la igualdad que
comprueba 5.5 no dependa de que dos líneas de esta ruta se mantengan iguales a mano.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import crear_token_acceso
from app.models.padron import Usuario
from app.schemas.auth import CambioPasswordRequest, LoginRequest, LoginResponse, SesionActual
from app.services.auth import (
    CREDENCIALES_INVALIDAS,
    CredencialesInvalidas,
    PasswordActualIncorrecta,
    PasswordInvalida,
    autenticar,
    cambiar_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, summary="Iniciar sesión")
def login(cuerpo: LoginRequest, session: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    """Autentica por email y contraseña y emite el token de acceso.

    422 si el cuerpo no trae email o contraseña, 401 si las credenciales no sirven, 200 con
    el token si sirven. No hay respuesta que distinga "no existe el correo" de "no coincide
    la contraseña".
    """
    try:
        usuario = autenticar(session, cuerpo.email, cuerpo.password)
    except CredencialesInvalidas:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=CREDENCIALES_INVALIDAS,
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    token = crear_token_acceso(
        usuario_id=usuario.id,
        rol=usuario.rol,
        email=usuario.email,
    )
    return LoginResponse(
        access_token=token,
        user_id=usuario.id,
        rol=usuario.rol,
        must_change_password=usuario.must_change_password,
    )


@router.post(
    "/change-password",
    response_model=SesionActual,
    summary="Cambiar la contraseña de la cuenta",
)
def change_password(
    cuerpo: CambioPasswordRequest,
    usuario: Annotated[Usuario, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db)],
) -> SesionActual:
    """Cambia la contraseña y levanta el cambio obligatorio (D45).

    Es la única ruta de negocio que una cuenta pendiente puede usar, junto con `GET /auth/me`:
    el resto responde 403 mientras `must_change_password` siga en `true`.

    200 con la sesión actualizada, 400 si la contraseña actual no coincide, 422 si la nueva es
    corta o igual a la actual y 401 sin token.
    """
    try:
        actualizado = cambiar_password(
            session, usuario, cuerpo.current_password, cuerpo.new_password
        )
    except PasswordActualIncorrecta as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except PasswordInvalida as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return SesionActual.model_validate(actualizado)


@router.get("/me", response_model=SesionActual, summary="Consultar la sesión actual")
def me(usuario: Annotated[Usuario, Depends(get_current_user)]) -> SesionActual:
    """Devuelve la identidad de quien llama.

    401 si falta el token, si no valida o si está vencido, y también si la cuenta dejó de
    estar activa: en los cuatro casos la misma respuesta.
    """
    return SesionActual.model_validate(usuario)
