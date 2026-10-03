"""Contrato de entrada y salida de autenticación (5.2, 5.3).

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19 y de la convención del equipo (identificadores en inglés, dominio en
español sin tildes). `password` no es una entidad de dominio, es un campo del contrato.

El correo **no** se normaliza a minúsculas ni se recorta. `usuario.email` tiene índice
único sobre el valor crudo y no hay columna normalizada para el correo (D6 normaliza
códigos, nombres, CUIT y documentos, no el correo), así que lowercastear en el login haría
que `Admin@...` no encontrara una cuenta creada como `admin@...`. Acá se busca tal cual se
escribió.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    """Cuerpo de `POST /auth/login`.

    Omitir cualquiera de los dos campos produce 422 de parte de Pydantic, que es lo que
    pide la spec. El límite de la contraseña es el de bcrypt: más de 72 bytes no se puede
    hashear, así que es mejor rechazarlo en la validación que fallar adentro del hash.
    """

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)


class LoginResponse(BaseModel):
    """Respuesta de `POST /auth/login` con credenciales válidas.

    No viaja el hash ni el correo: el identificador, el rol y el indicador de cambio
    pendiente son lo que la spec pide, y `GET /auth/me` completa el resto. `token_type`
    está porque es lo que el cliente HTTP manda después en el encabezado `Authorization`.
    """

    access_token: str
    token_type: str = "bearer"
    user_id: int
    rol: str
    must_change_password: bool


class SesionActual(BaseModel):
    """Respuesta de `GET /auth/me`.

    `nombre` es el nombre para mostrar de la cuenta (`usuario.nombre`), que es el que
    muestra la interfaz. Viene de la base y no del token: si el nombre cambia, el token
    viejo no puede devolver el viejo.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    rol: str
    nombre: str
    must_change_password: bool
