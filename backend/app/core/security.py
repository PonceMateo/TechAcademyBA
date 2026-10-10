"""Hash de contraseñas y emisión y validación del token (5.1).

D2: el acceso es un JWT stateless. Este módulo tiene las dos primitivas criptográficas y
nada más: no importa `app.models` ni ninguna otra capa, así que `app.core` sigue siendo la
base de la pirámide (D1) y la prueba de capas de 3.1 sigue teniendo sentido.

El token lleva **identidad**, no estado. La autoridad sobre la cuenta —el rol vigente, si
está activa, si debe cambiar la contraseña— es siempre la base de datos, y eso lo resuelve
`app/api/deps.py`, no este módulo. Por eso `leer_token_acceso` no devuelve la contraseña
de nadie ni decide si una cuenta puede entrar.

Por qué bcrypt y no argon2: `pyproject.toml` ya lo declara desde el work unit 3 y es lo
que la historia #11 da por hecho. El costo de cómputo es configurable porque bcrypt es
lento **por diseño** y la suite no debe pagar el costo de producción en cada hash.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings

#: bcrypt no mira más allá de 72 bytes de contraseña. Cortar en silencio haría que dos
#: contraseñas distintas fueran la misma, así que el límite se rechaza explícitamente en
#: el alta y se trata como "no coincide" en la verificación.
MAX_PASSWORD_BYTES = 72

#: Claims que un token tiene que traer para ser considerado válido. `require` evita que un
#: token sin `exp` se lea como eternal y que uno sin `rol` llegue hasta la autorización.
CLAIMS_REQUERIDOS = ("exp", "iat", "sub", "rol", "email")

#: Contraseña de las cuentas de demostración, y también de las cuentas que crea el alta de
#: docente durante esta fase. Es pública a propósito: es lo que pide la spec para el entorno de
#: desarrollo y lo que el README documenta.
#:
#: Vive acá y no en `services/seed.py` porque son dos los que la necesitan —el seed y el alta
#: de docente— y en `core` está el resto del manejo de contraseñas. Las cuentas reales nunca
#: se crean con esta contraseña: cuando exista el alta de alumno (historia #13), su cuenta
#: tendrá su propia decisión.
CONTRASEÑA_DEMO = "Demo2026!"


class TokenInvalido(Exception):
    """El token no se puede usar: expiró, está manipulado o lo firmó otro secreto.

    Un solo tipo para los tres casos a propósito. La respuesta al cliente es la misma
    (401) y no dice cuál de las tres cosas pasó, porque decirlo convertiría el login en un
    oráculo de direcciones de correo.
    """


@dataclass(frozen=True)
class ClaimsToken:
    """Lo que se puede leer de un token verificado."""

    usuario_id: int
    rol: str
    email: str


def hashear_password(password: str, *, rondas: int | None = None) -> str:
    """Devuelve el hash bcrypt de la contraseña, listo para `usuario.password_hash`.

    Nunca devuelve la contraseña en claro ni la contiene: bcrypt es un hash con sal y no
    admite recuperación. El resultado empieza con `$2b$<rondas>$`, que es lo que permite
    afirmar en una prueba que el campo no guardó el secreto.
    """
    _verificar_largo(password)
    rondas = get_settings().bcrypt_rounds if rondas is None else rondas
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rondas)).decode("ascii")


def verificar_password(password: str, password_hash: str) -> bool:
    """Indica si la contraseña corresponde al hash. Nunca lanza excepción.

    Un hash que no es un hash de bcrypt viene de una fila corrupta o de un `INSERT` manual.
    Eso es un fallo de datos, no un motivo para tumbar la request con un 500, así que
    devuelve `False` y el login responde con el mensaje genérico de siempre.
    """
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def crear_token_acceso(
    *,
    usuario_id: int,
    rol: str,
    email: str,
    vigencia: timedelta | None = None,
) -> str:
    """Firma el token de acceso de una cuenta.

    `vigencia` existe para poder emitir un token ya vencido en las pruebas. Por defecto usa
    `ACCESS_TOKEN_EXPIRE_MINUTES`, que en el compose son ocho horas: una jornada laboral.
    """
    settings = get_settings()
    ahora = datetime.now(UTC)
    plazo = (
        timedelta(minutes=settings.access_token_expire_minutes) if vigencia is None else vigencia
    )
    payload = {
        "sub": str(usuario_id),
        "rol": rol,
        "email": email,
        "iat": ahora,
        "exp": ahora + plazo,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def leer_token_acceso(token: str) -> ClaimsToken:
    """Verifica la firma y la vigencia del token, y devuelve lo que afirma.

    Lanza `TokenInvalido` ante cualquier problema. La lista de algoritmos se pasa
    explícita: sin eso, un token que diga `alg: none` o que cambie de familia criptográfica
    esquivaría la verificación del secreto.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": list(CLAIMS_REQUERIDOS)},
        )
    except jwt.PyJWTError as error:
        raise TokenInvalido(str(error)) from error

    sujeto = payload.get("sub")
    if not isinstance(sujeto, str) or not sujeto.isdigit():
        raise TokenInvalido("el claim `sub` no es un identificador de usuario")
    rol = payload.get("rol")
    email = payload.get("email")
    if not isinstance(rol, str) or not isinstance(email, str):
        raise TokenInvalido("el token no declara rol ni correo")

    return ClaimsToken(usuario_id=int(sujeto), rol=rol, email=email)


def _verificar_largo(password: str) -> None:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"la contraseña no puede superar los {MAX_PASSWORD_BYTES} bytes que procesa bcrypt"
        )
