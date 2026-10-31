"""Credenciales iniciales propias para docentes (HU #66).

Corre contra PostgreSQL real (D15). Lo que se afirma:

- el alta genera la contraseña `<primer nombre><DNI>` con la misma convención del alumno;
- la respuesta del alta trae `password_inicial` y la base guarda solo su hash bcrypt;
- la cuenta nace con `must_change_password` en `true`, entra con la inicial y no puede usar las
  rutas de su rol hasta cambiarla;
- el cambio de contraseña habilita el acceso e invalida la contraseña inicial;
- los docentes creados antes de la HU 66 conservan su contraseña, su indicador y su sesión;
- fuera del alta, ningún endpoint del padrón expone la contraseña ni el hash.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verificar_password
from app.models.padron import Usuario
from app.services.normalization import generar_password_inicial
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_docente,
    crear_usuario_admin,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

#: Datos del alta. `María González` con `30.111.222` produce `maria30111222`.
ALTA = {
    "nombre": "María",
    "apellido": "González",
    "dni": "30.111.222",
    "email": "maria.gonzalez@techacademy.invalid",
}

#: La contraseña que el docente define en su primer ingreso.
PASSWORD_NUEVA = "Docente2026!"


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _alta(cliente: TestClient, **cambios: object) -> dict:
    respuesta = cliente.post("/docentes", json={**ALTA, **cambios})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _login(cliente: TestClient, email: str, password: str):
    return cliente.post("/auth/login", json={"email": email, "password": password})


def _rutas_del_docente(token: str) -> dict[str, str]:
    return encabezado_de_autorizacion(token)


def test_la_password_inicial_usa_la_convencion_del_alta_de_alumno() -> None:
    """D45 y D62: primer nombre en minúsculas, sin tildes, y el DNI normalizado a dígitos."""
    assert generar_password_inicial("María González", "30.111.222") == "maria30111222"
    assert generar_password_inicial("Ángel", "30111222") == "angel30111222"


def test_el_alta_devuelve_la_password_inicial_y_guarda_solo_el_hash(
    cliente_admin: TestClient, db_session: Session
) -> None:
    cuerpo = _alta(cliente_admin)

    assert cuerpo["password_inicial"] == "maria30111222"

    usuario = db_session.scalar(select(Usuario).where(Usuario.email == ALTA["email"]))
    assert usuario is not None
    assert usuario.rol == "DOCENTE"
    assert usuario.password_hash != cuerpo["password_inicial"], "la base no guarda la clave"
    assert verificar_password(cuerpo["password_inicial"], usuario.password_hash)
    assert usuario.must_change_password is True
    assert usuario.is_active is True


def test_el_docente_nuevo_entra_con_la_inicial_y_no_puede_usar_su_rol(
    cliente_admin: TestClient,
) -> None:
    cuerpo = _alta(cliente_admin)

    ingreso = _login(cliente_admin, ALTA["email"], cuerpo["password_inicial"])
    assert ingreso.status_code == 200, ingreso.text
    assert ingreso.json()["rol"] == "DOCENTE"
    assert ingreso.json()["must_change_password"] is True
    token = ingreso.json()["access_token"]

    sesion = cliente_admin.get("/auth/me", headers=_rutas_del_docente(token))
    assert sesion.status_code == 200, sesion.text
    assert sesion.json()["must_change_password"] is True

    bloqueado = cliente_admin.get("/auth/probe/docente", headers=_rutas_del_docente(token))
    assert bloqueado.status_code == 403, bloqueado.text
    assert bloqueado.headers["X-Cambio-Password-Pendiente"] == "true"


def test_el_cambio_de_password_habilita_el_acceso_e_invalida_la_inicial(
    cliente_admin: TestClient,
) -> None:
    cuerpo = _alta(cliente_admin)
    token = _login(cliente_admin, ALTA["email"], cuerpo["password_inicial"]).json()["access_token"]

    cambio = cliente_admin.post(
        "/auth/change-password",
        json={"current_password": cuerpo["password_inicial"], "new_password": PASSWORD_NUEVA},
        headers=_rutas_del_docente(token),
    )
    assert cambio.status_code == 200, cambio.text
    assert cambio.json()["must_change_password"] is False

    habilitado = cliente_admin.get("/auth/probe/docente", headers=_rutas_del_docente(token))
    assert habilitado.status_code == 200, habilitado.text

    assert _login(cliente_admin, ALTA["email"], cuerpo["password_inicial"]).status_code == 401
    assert _login(cliente_admin, ALTA["email"], PASSWORD_NUEVA).status_code == 200


def test_los_docentes_creados_antes_conservan_su_password_y_estado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU #66: la entrega no regenera ni desbloquea cuentas históricas."""
    historico = crear_docente(
        db_session, dni="40111222", email="historico.docente@techacademy.invalid"
    )
    anterior = crear_usuario_docente(db_session, docente=historico)
    hash_anterior = anterior.password_hash

    _alta(cliente_admin)

    db_session.expire_all()
    vigente = db_session.get(Usuario, anterior.id)
    assert vigente is not None
    assert vigente.password_hash == hash_anterior
    assert vigente.must_change_password is False

    ingreso = _login(cliente_admin, anterior.email, PASSWORD_DE_PRUEBA)
    assert ingreso.status_code == 200, ingreso.text
    assert ingreso.json()["must_change_password"] is False

    token = ingreso.json()["access_token"]
    habilitado = cliente_admin.get("/auth/probe/docente", headers=_rutas_del_docente(token))
    assert habilitado.status_code == 200


def test_la_password_no_se_expone_fuera_del_alta(cliente_admin: TestClient) -> None:
    cuerpo = _alta(cliente_admin)

    listado = cliente_admin.get("/docentes")
    assert listado.status_code == 200, listado.text
    assert all(
        "password_inicial" not in fila and "password_hash" not in fila
        for fila in listado.json()
    )

    edicion = cliente_admin.put(f"/docentes/{cuerpo['id']}", json=ALTA)
    assert edicion.status_code == 200, edicion.text
    assert "password_inicial" not in edicion.json()
    assert "password_hash" not in edicion.json()

    restablecer = cliente_admin.post(
        f"/docentes/{cuerpo['id']}/password", json={"new_password": PASSWORD_NUEVA}
    )
    assert restablecer.status_code == 200, restablecer.text
    assert "password_inicial" not in restablecer.json()
    assert "password_hash" not in restablecer.json()
