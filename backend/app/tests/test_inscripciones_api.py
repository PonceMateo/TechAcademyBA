"""Inscripciones contra PostgreSQL real (HU #14)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
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


def test_inscripcion_exitosa_descuenta_vacante(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=2)
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "ACTIVA"
    assert cuerpo["categoria"] == "PARTICULAR"

    listado = cliente_admin.get("/comisiones").json()
    fila = next(item for item in listado if item["id"] == comision.id)
    assert fila["vacantes"] == 1


def test_inscripcion_repetida_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=5)
    alumno = crear_alumno(db_session)

    primera = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert primera.status_code == 201

    segunda = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert segunda.status_code == 409


def test_comision_completa_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=1)
    alumno_uno = crear_alumno(db_session, email="uno@techacademy.invalid", documento="11111111")
    alumno_dos = crear_alumno(db_session, email="dos@techacademy.invalid", documento="22222222")

    primera = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno_uno.id, "comision_id": comision.id},
    )
    assert primera.status_code == 201

    segunda = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno_dos.id, "comision_id": comision.id},
    )
    assert segunda.status_code == 409
