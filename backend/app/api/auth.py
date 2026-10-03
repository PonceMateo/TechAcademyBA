"""Autenticación: `POST /auth/login` y `GET /auth/me` (5.2, 5.3).

Las dos rutas son las **únicas** llamadas de red que la interfaz va a hacer (D14). El
resto del frontend consume datos de ejemplo hasta que lleguen las historias.

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
from app.schemas.auth import LoginRequest, LoginResponse, SesionActual
from app.services.auth import CREDENCIALES_INVALIDAS, CredencialesInvalidas, autenticar

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


@router.get("/me", response_model=SesionActual, summary="Consultar la sesión actual")
def me(usuario: Annotated[Usuario, Depends(get_current_user)]) -> SesionActual:
    """Devuelve la identidad de quien llama.

    401 si falta el token, si no valida o si está vencido, y también si la cuenta dejó de
    estar activa: en los cuatro casos la misma respuesta.
    """
    return SesionActual.model_validate(usuario)
