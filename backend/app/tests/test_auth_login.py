"""5.2 y 5.5 — `POST /auth/login`: éxito, credenciales inválidas y cuerpo incompleto.

5.5 vive acá y no en su propio archivo porque es una comparación entre dos respuestas de
esta misma ruta: ponerla aparte obligaría a repetir el montaje.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.services.auth import CREDENCIALES_INVALIDAS
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
)


def test_login_exitoso_devuelve_el_token_y_los_datos_de_la_cuenta(api_client, db_session) -> None:
    """Spec `auth-and-roles`, "Credenciales válidas": 200 con token, identificador, rol y
    el indicador de cambio de contraseña."""
    admin = crear_usuario_admin(db_session)

    respuesta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": PASSWORD_DE_PRUEBA},
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["access_token"]
    assert cuerpo["user_id"] == admin.id
    assert cuerpo["rol"] == "ADMIN"
    assert cuerpo["must_change_password"] is False
    assert cuerpo["token_type"] == "bearer"


@pytest.mark.parametrize("rol", ["ADMIN", "DOCENTE", "ALUMNO"])
def test_los_tres_roles_pueden_iniciar_sesion(api_client, db_session, rol: str) -> None:
    """D3: los tres roles existen y los tres entran por la misma puerta."""
    fabrica = {
        "ADMIN": crear_usuario_admin,
        "DOCENTE": crear_usuario_docente,
        "ALUMNO": crear_usuario_alumno,
    }[rol]
    usuario = fabrica(db_session)

    respuesta = api_client.post(
        "/auth/login",
        json={"email": usuario.email, "password": PASSWORD_DE_PRUEBA},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == rol


def test_el_token_emitido_sirve_para_leer_la_sesion(api_client, db_session) -> None:
    """El login no emite un token decorativo: `/auth/me` lo acepta."""
    docente = crear_usuario_docente(db_session)

    login = api_client.post(
        "/auth/login",
        json={"email": docente.email, "password": PASSWORD_DE_PRUEBA},
    )

    sesion = api_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert sesion.status_code == 200
    assert sesion.json()["email"] == docente.email


def test_el_login_no_devuelve_el_hash_de_la_contraseña(api_client, db_session) -> None:
    admin = crear_usuario_admin(db_session)
    respuesta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": PASSWORD_DE_PRUEBA},
    )

    assert admin.password_hash not in respuesta.text
    assert PASSWORD_DE_PRUEBA not in respuesta.text


def test_contrasena_incorrecta_responde_401(api_client, db_session) -> None:
    admin = crear_usuario_admin(db_session)
    respuesta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": "no-es-la-clave"},
    )

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == CREDENCIALES_INVALIDAS


def test_email_inexistente_responde_401(api_client) -> None:
    respuesta = api_client.post(
        "/auth/login",
        json={"email": "nadie@techacademy.invalid", "password": PASSWORD_DE_PRUEBA},
    )

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == CREDENCIALES_INVALIDAS


def test_cuenta_dada_de_baja_responde_el_mismo_401(api_client, db_session) -> None:
    """`is_active = false` no puede tener una respuesta propia: confirmaría que el correo
    existe. Cae en el mismo 401 genérico."""
    admin = crear_usuario_admin(db_session, is_active=False)

    respuesta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": PASSWORD_DE_PRUEBA},
    )

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == CREDENCIALES_INVALIDAS


def test_el_correo_se_busca_exacto_como_está_escrito(api_client, db_session) -> None:
    """El índice único de `usuario.email` está sobre el valor crudo y no hay columna
    normalizada para el correo, así que `Admin@...` es otra cuenta que no existe."""
    admin = crear_usuario_admin(db_session)

    respuesta = api_client.post(
        "/auth/login",
        json={"email": admin.email.upper(), "password": PASSWORD_DE_PRUEBA},
    )

    assert respuesta.status_code == 401


@pytest.mark.parametrize(
    "cuerpo",
    [
        {},
        {"email": "admin@techacademy.invalid"},
        {"password": PASSWORD_DE_PRUEBA},
        {"usuario": "admin@techacademy.invalid", "password": PASSWORD_DE_PRUEBA},
    ],
    ids=["vacio", "sin_password", "sin_email", "campo_renombrado"],
)
def test_cuerpo_incompleto_responde_422(api_client, cuerpo: dict[str, str]) -> None:
    """Spec, "Datos de acceso incompletos": 422 indicando los campos que faltan."""
    respuesta = api_client.post("/auth/login", json=cuerpo)

    assert respuesta.status_code == 422
    faltantes = {error["loc"][-1] for error in respuesta.json()["detail"]}
    assert "email" in faltantes or "password" in faltantes


def test_un_correo_vacio_responde_422(api_client) -> None:
    """Un correo vacío es un campo obligatorio no informado (M4), no un correo."""
    respuesta = api_client.post("/auth/login", json={"email": "", "password": "algo"})

    assert respuesta.status_code == 422
    assert "email" in respuesta.text


# --------------------------------------------------------------------------------------
# 5.5 — El mensaje es idéntico en los dos casos
# --------------------------------------------------------------------------------------


def test_el_mensaje_es_identico_para_email_inexistente_y_para_password_incorrecta(
    api_client, db_session: Session
) -> None:
    """5.5. La comparación es entre las dos respuestas, no contra una constante: si mañana
    alguien cambia el mensaje en un solo camino, esta prueba lo dice."""
    admin = crear_usuario_admin(db_session, email="rita.molina@techacademy.invalid")

    inexistente = api_client.post(
        "/auth/login",
        json={"email": "nadie@techacademy.invalid", "password": PASSWORD_DE_PRUEBA},
    )
    incorrecta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": "no-es-la-clave"},
    )

    assert inexistente.status_code == incorrecta.status_code == 401
    assert inexistente.json() == incorrecta.json()
    assert inexistente.text == incorrecta.text


def test_el_mensaje_no_nombra_el_dato_que_fallo(api_client, db_session: Session) -> None:
    admin = crear_usuario_admin(db_session)
    incorrecta = api_client.post(
        "/auth/login",
        json={"email": admin.email, "password": "no-es-la-clave"},
    )
    inexistente = api_client.post(
        "/auth/login",
        json={"email": "nadie@techacademy.invalid", "password": PASSWORD_DE_PRUEBA},
    )

    for respuesta in (incorrecta, inexistente):
        detalle = respuesta.json()["detail"].lower()
        assert admin.email not in detalle
        assert "contraseña incorrecta" not in detalle
        assert "correo" not in detalle
        assert "no existe" not in detalle
        assert "no registrado" not in detalle


def test_un_correo_inexistente_tambien_verifica_un_hash(api_client, monkeypatch) -> None:
    """Igualar el trabajo, no solo el mensaje.

    Sin verificar un hash cuando el correo no existe, un login fallido con correo
    inexistente respondería en microsegundos y uno con contraseña incorrecta en ~250 ms. La
    diferencia ya revela qué correos existen aunque las respuestas sean idénticas.
    """
    from app.services import auth as servicio_auth

    verificaciones: list[str] = []
    original = servicio_auth.verificar_password

    def espia(password: str, password_hash: str) -> bool:
        verificaciones.append(password_hash)
        return original(password, password_hash)

    monkeypatch.setattr(servicio_auth, "verificar_password", espia)

    api_client.post(
        "/auth/login",
        json={"email": "nadie@techacademy.invalid", "password": PASSWORD_DE_PRUEBA},
    )

    assert verificaciones, "con un correo inexistente no se verificó ningún hash"
    assert len(verificaciones) == 1
