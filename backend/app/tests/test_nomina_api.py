"""Carga de nómina corporativa (historia #19)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import CategoriaInscripcion
from app.models.inscripciones import Inscripcion
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_empresa,
    crear_usuario_admin,
    encabezado_de_autorizacion,
    token_de_prueba,
)


def cliente_admin(api_client: TestClient, db_session: Session) -> TestClient:
    admin = crear_usuario_admin(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def empleado(documento: str, nombre: str, email: str, **extras) -> dict:
    return {
        "documento": documento,
        "nombre": nombre,
        "email": email,
        "telefono": None,
        **extras,
    }


def test_carga_nomina_crea_y_reutiliza_alumnos(
    api_client: TestClient, db_session: Session
) -> None:
    empresa = crear_empresa(db_session)
    comision = crear_comision(db_session, cupo_maximo=3)
    crear_alumno(
        db_session,
        documento="38111222",
        email="existente@techacademy.invalid",
    )
    cliente = cliente_admin(api_client, db_session)

    respuesta = cliente.post(
        f"/empresas/{empresa.id}/nomina",
        json={
            "comision_id": comision.id,
            "empleados": [
                empleado("38111222", "Agustina Benítez", "otro@techacademy.invalid"),
                empleado("40123456", "Nuevo Alumno", "nuevo@techacademy.invalid"),
            ],
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["alumnos_reutilizados"] == 1
    assert respuesta.json()["alumnos_creados"] == 1
    assert respuesta.json()["inscripciones_creadas"] == 2
    assert respuesta.json()["cantidad"] == 2
    inscripciones = db_session.scalars(select(Inscripcion)).all()
    assert {inscripcion.categoria for inscripcion in inscripciones} == {
        CategoriaInscripcion.CORPORATIVO.value
    }
    assert {inscripcion.empresa_id for inscripcion in inscripciones} == {empresa.id}
    assert all(inscripcion.porcentaje_beca is None for inscripcion in inscripciones)


def test_carga_nomina_rechaza_datos_de_beca(
    api_client: TestClient, db_session: Session
) -> None:
    empresa = crear_empresa(db_session)
    comision = crear_comision(db_session)
    cliente = cliente_admin(api_client, db_session)

    respuesta = cliente.post(
        f"/empresas/{empresa.id}/nomina",
        json={
            "comision_id": comision.id,
            "empleados": [
                empleado(
                    "40123456",
                    "Uno",
                    "uno@techacademy.invalid",
                    categoria=CategoriaInscripcion.BECADO_TOTAL.value,
                )
            ],
        },
    )

    assert respuesta.status_code == 422, respuesta.text


def test_carga_nomina_rechaza_si_supera_las_vacantes(
    api_client: TestClient, db_session: Session
) -> None:
    empresa = crear_empresa(db_session)
    comision = crear_comision(db_session, cupo_maximo=1)
    cliente = cliente_admin(api_client, db_session)

    respuesta = cliente.post(
        f"/empresas/{empresa.id}/nomina",
        json={
            "comision_id": comision.id,
            "empleados": [
                empleado("40123456", "Uno", "uno@techacademy.invalid"),
                empleado("40123457", "Dos", "dos@techacademy.invalid"),
            ],
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "vacantes disponibles" in respuesta.json()["detail"]


def test_carga_nomina_rechaza_documentos_repetidos(
    api_client: TestClient, db_session: Session
) -> None:
    empresa = crear_empresa(db_session)
    comision = crear_comision(db_session)
    cliente = cliente_admin(api_client, db_session)

    respuesta = cliente.post(
        f"/empresas/{empresa.id}/nomina",
        json={
            "comision_id": comision.id,
            "empleados": [
                empleado("40123456", "Uno", "uno@techacademy.invalid"),
                empleado("40.123.456", "Dos", "dos@techacademy.invalid"),
            ],
        },
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "documentos repetidos" in respuesta.json()["detail"]
