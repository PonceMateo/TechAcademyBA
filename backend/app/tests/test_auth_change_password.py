"""D45 — cambio obligatorio de contraseña en el primer inicio de sesión.

Lo que se prueba, de punta a punta y contra PostgreSQL real:

- una cuenta con `must_change_password` en `true` puede iniciar sesión y leer su sesión, pero
  recibe `403` en las rutas de rol;
- `POST /auth/change-password` es el único camino para salir del estado pendiente;
- la contraseña nueva se guarda como hash, la vieja deja de servir y el indicador queda en
  `false`;
- una contraseña actual equivocada, una nueva corta o una igual a la actual no cambian nada.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import verificar_password
from app.models.padron import Usuario
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_usuario_alumno,
    encabezado_de_autorizacion,
    token_de_prueba,
)

NUEVA_PASSWORD = "ClaveNueva2026!"


@pytest.fixture
def pendiente(db_session: Session) -> Usuario:
    return crear_usuario_alumno(db_session, must_change_password=True)


@pytest.fixture
def cliente_pendiente(api_client: TestClient, pendiente: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(pendiente)))
    return api_client


def test_la_cuenta_pendiente_no_usa_las_rutas_de_rol(cliente_pendiente: TestClient) -> None:
    respuesta = cliente_pendiente.get("/auth/probe/alumno")

    assert respuesta.status_code == 403, respuesta.text
    assert "cambiar tu contraseña" in respuesta.json()["detail"]
    assert respuesta.headers["X-Cambio-Password-Pendiente"] == "true"


def test_la_cuenta_pendiente_puede_leer_su_sesion(cliente_pendiente: TestClient) -> None:
    respuesta = cliente_pendiente.get("/auth/me")

    assert respuesta.status_code == 200
    assert respuesta.json()["must_change_password"] is True


def test_el_cambio_exitoso_habilita_las_rutas_de_rol(
    cliente_pendiente: TestClient, pendiente: Usuario, db_session: Session
) -> None:
    respuesta = cliente_pendiente.post(
        "/auth/change-password",
        json={"current_password": PASSWORD_DE_PRUEBA, "new_password": NUEVA_PASSWORD},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["must_change_password"] is False
    assert cliente_pendiente.get("/auth/probe/alumno").status_code == 200

    db_session.refresh(pendiente)
    assert pendiente.must_change_password is False
    assert pendiente.password_hash != NUEVA_PASSWORD
    assert pendiente.password_hash.startswith("$2b$")
    assert verificar_password(NUEVA_PASSWORD, pendiente.password_hash) is True
    assert verificar_password(PASSWORD_DE_PRUEBA, pendiente.password_hash) is False


def test_despues_del_cambio_se_entra_con_la_nueva_y_no_con_la_vieja(
    cliente_pendiente: TestClient, pendiente: Usuario
) -> None:
    cliente_pendiente.post(
        "/auth/change-password",
        json={"current_password": PASSWORD_DE_PRUEBA, "new_password": NUEVA_PASSWORD},
    )

    vieja = cliente_pendiente.post(
        "/auth/login", json={"email": pendiente.email, "password": PASSWORD_DE_PRUEBA}
    )
    nueva = cliente_pendiente.post(
        "/auth/login", json={"email": pendiente.email, "password": NUEVA_PASSWORD}
    )

    assert vieja.status_code == 401
    assert nueva.status_code == 200
    assert nueva.json()["must_change_password"] is False


def test_la_password_actual_equivocada_no_cambia_nada(
    cliente_pendiente: TestClient, pendiente: Usuario, db_session: Session
) -> None:
    respuesta = cliente_pendiente.post(
        "/auth/change-password",
        json={"current_password": "no-es-la-clave", "new_password": NUEVA_PASSWORD},
    )

    assert respuesta.status_code == 400, respuesta.text
    assert "contraseña actual" in respuesta.json()["detail"]
    db_session.refresh(pendiente)
    assert pendiente.must_change_password is True
    assert verificar_password(PASSWORD_DE_PRUEBA, pendiente.password_hash) is True


@pytest.mark.parametrize("nueva", ["corta", PASSWORD_DE_PRUEBA])
def test_la_password_nueva_invalida_no_cambia_nada(
    cliente_pendiente: TestClient, pendiente: Usuario, db_session: Session, nueva: str
) -> None:
    respuesta = cliente_pendiente.post(
        "/auth/change-password",
        json={"current_password": PASSWORD_DE_PRUEBA, "new_password": nueva},
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.refresh(pendiente)
    assert pendiente.must_change_password is True
    assert verificar_password(PASSWORD_DE_PRUEBA, pendiente.password_hash) is True


def test_el_cambio_sin_token_es_401(api_client: TestClient) -> None:
    respuesta = api_client.post(
        "/auth/change-password",
        json={"current_password": PASSWORD_DE_PRUEBA, "new_password": NUEVA_PASSWORD},
    )

    assert respuesta.status_code == 401
