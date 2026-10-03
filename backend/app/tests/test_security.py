"""5.1 — Hash de contraseñas y emisión y validación del token.

Las dos primitivas de `app/core/security.py`, probadas sin base de datos: son criptografía,
no dominio, y probarlas en aislamiento muestra que no dependen de la capa de arriba (D1).
"""

from __future__ import annotations

import base64
import json
from datetime import timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    MAX_PASSWORD_BYTES,
    TokenInvalido,
    crear_token_acceso,
    hashear_password,
    leer_token_acceso,
    verificar_password,
)
from app.tests import BCRYPT_ROUNDS_EN_LA_SUITE


def test_el_hash_nunca_guarda_la_contraseña_en_claro() -> None:
    """El campo `usuario.password_hash` no puede contener el secreto, ni de paso."""
    contraseña = "Demo2026!"
    hash_ = hashear_password(contraseña)

    assert contraseña not in hash_
    assert hash_.startswith("$2b$")
    assert hash_ != contraseña
    # Y tampoco alcanza con "ofuscarlo": la verificación es la que prueba que el hash es de
    # verdad, no una transformación reversible.
    assert verificar_password(contraseña, hash_)


def test_el_mismo_password_da_hashes_distintos() -> None:
    """bcrypt lleva sal por hash: dos cuentas con la misma contraseña no se parecen."""
    assert hashear_password("Demo2026!") != hashear_password("Demo2026!")


def test_el_hash_usa_el_costo_configurado() -> None:
    rondas = get_settings().bcrypt_rounds
    assert hashear_password("Demo2026!").startswith(f"$2b${rondas:02d}$")


def test_la_suite_no_paga_el_costo_de_produccion() -> None:
    """Guardia del ajuste de `app/tests/__init__.py`.

    Si ese ajuste dejara de aplicarse —porque el orden de importación cambió, o porque
    alguien lo borró sin leer el comentario—, esta prueba falla en vez de dejar que la suite
    se haga tres veces más lenta sin que nadie entienda por qué.
    """
    assert get_settings().bcrypt_rounds == BCRYPT_ROUNDS_EN_LA_SUITE
    assert get_settings().bcrypt_rounds < 12


def test_la_contraseña_correcta_verifica() -> None:
    assert verificar_password("Demo2026!", hashear_password("Demo2026!"))


def test_la_contraseña_equivocada_no_verifica() -> None:
    assert not verificar_password("otra", hashear_password("Demo2026!"))
    assert not verificar_password("demo2026!", hashear_password("Demo2026!"))


def test_un_hash_corrupto_no_tumba_la_peticion() -> None:
    """Una fila con `password_hash` inválido es un problema de datos, no un 500."""
    assert not verificar_password("Demo2026!", "no-es-un-hash")
    assert not verificar_password("Demo2026!", "")
    assert not verificar_password("Demo2026!", "$2b$12$")


def test_una_contraseña_más_larga_que_bcrypt_no_se_hashea() -> None:
    """bcrypt ignora lo que pasa de 72 bytes. Cortar en silencio haría que dos contraseñas
    distintas fueran la misma, así que el alta lo rechaza."""
    larga = "a" * (MAX_PASSWORD_BYTES + 1)
    with pytest.raises(ValueError, match=str(MAX_PASSWORD_BYTES)):
        hashear_password(larga)
    # En la verificación no hay excepción: simplemente no puede coincidir con nada guardado.
    assert not verificar_password(larga, hashear_password("corta"))


def test_el_token_trae_identidad_rol_y_correo() -> None:
    token = crear_token_acceso(usuario_id=42, rol="DOCENTE", email="rita@techacademy.invalid")

    claims = leer_token_acceso(token)

    assert claims.usuario_id == 42
    assert claims.rol == "DOCENTE"
    assert claims.email == "rita@techacademy.invalid"


def test_el_token_no_trae_la_contraseña() -> None:
    """Un JWT es un base64, no un cifrado: su contenido lo lee cualquiera que lo tenga."""
    token = crear_token_acceso(usuario_id=1, rol="ADMIN", email="admin@techacademy.invalid")
    contenido = base64.urlsafe_b64decode(token.split(".")[1] + "==")

    assert b"password" not in contenido
    assert b"Demo2026" not in contenido


def test_un_token_vencido_no_se_lee() -> None:
    token = crear_token_acceso(
        usuario_id=1,
        rol="ADMIN",
        email="admin@techacademy.invalid",
        vigencia=timedelta(seconds=-1),
    )
    with pytest.raises(TokenInvalido):
        leer_token_acceso(token)


def test_un_token_manipulado_no_se_lee() -> None:
    """Se le cambia un carácter de la firma."""
    token = crear_token_acceso(usuario_id=1, rol="ADMIN", email="admin@techacademy.invalid")
    cabecera, cuerpo, firma = token.split(".")
    alterado = f"{cabecera}.{cuerpo}.{firma[:-1]}{'A' if firma[-1] != 'A' else 'B'}"

    with pytest.raises(TokenInvalido):
        leer_token_acceso(alterado)


def test_un_token_firmado_con_otro_secreto_no_se_lee() -> None:
    """Es el caso del que avisa D2: cambiar el secreto invalida todo lo emitido antes."""
    token = jwt.encode(
        {"sub": "1", "rol": "ADMIN", "email": "admin@techacademy.invalid", "exp": 9999999999},
        "un-secreto-distinto",
        algorithm="HS256",
    )

    with pytest.raises(TokenInvalido):
        leer_token_acceso(token)


def test_un_token_sin_algoritmo_no_se_lee() -> None:
    """El ataque clásico del `alg: none`: si la biblioteca confiara en lo que dice el
    token, no haría falta la firma."""
    def _parte(datos: dict[str, object]) -> str:
        crudo = json.dumps(datos).encode()
        return base64.urlsafe_b64encode(crudo).rstrip(b"=").decode()

    token = (
        f"{_parte({'alg': 'none', 'typ': 'JWT'})}."
        f"{_parte({'sub': '1', 'rol': 'ADMIN', 'email': 'x@y.invalid', 'exp': 9999999999})}."
    )

    with pytest.raises(TokenInvalido):
        leer_token_acceso(token)


def test_un_token_sin_vencimiento_no_se_lee() -> None:
    """Un token sin `exp` duraría para siempre, y un token eterno es una puerta abierta."""
    token = jwt.encode(
        {"sub": "1", "rol": "ADMIN", "email": "admin@techacademy.invalid"},
        get_settings().jwt_secret_key,
        algorithm="HS256",
    )

    with pytest.raises(TokenInvalido):
        leer_token_acceso(token)


def test_un_token_que_no_es_un_token_no_se_lee() -> None:
    for basura in ("", "no-es-un-jwt", "a.b.c"):
        with pytest.raises(TokenInvalido):
            leer_token_acceso(basura)
