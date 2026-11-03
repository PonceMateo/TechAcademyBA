"""Padrón de alumnos: búsqueda (HU #16)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_inscripcion,
    crear_usuario_admin,
    encabezado_de_autorizacion,
    token_de_prueba,
)


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def test_buscar_por_dni_devuelve_la_ficha(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso)
    alumno = crear_alumno(db_session, documento="12345678", email="buscado@techacademy.invalid")
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    respuesta = cliente_admin.get("/alumnos", params={"q": "12345678"})
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["id"] == alumno.id
    assert cuerpo[0]["comision"]["codigo"] == comision.codigo
    assert cuerpo[0]["categoria"] == "PARTICULAR"


def test_buscar_por_email_devuelve_la_ficha(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session, documento="87654321", email="unico@techacademy.invalid")

    respuesta = cliente_admin.get("/alumnos", params={"q": "unico@techacademy.invalid"})
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["id"] == alumno.id


def test_buscar_inexistente_devuelve_lista_vacia(
    cliente_admin: TestClient, db_session: Session
) -> None:
    respuesta = cliente_admin.get("/alumnos", params={"q": "99999999"})
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == []


def test_sin_consulta_lista_todos(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_alumno(db_session, documento="11111111", email="a@techacademy.invalid")
    crear_alumno(db_session, documento="22222222", email="b@techacademy.invalid")

    respuesta = cliente_admin.get("/alumnos")
    assert respuesta.status_code == 200, respuesta.text
    assert len(respuesta.json()) >= 2
