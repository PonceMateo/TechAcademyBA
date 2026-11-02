"""Padrón de alumnos: búsqueda (HU #16)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import CategoriaInscripcion, EstadoInscripcion
from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_empresa,
    crear_inscripcion,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_docente,
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
    # HU 64: el padrón devuelve solo los datos del alumno; la categoría se lee en el detalle.
    assert "comision" not in cuerpo[0]
    assert "categoria" not in cuerpo[0]


def test_el_detalle_trae_una_entrada_por_inscripcion_con_su_categoria(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: un alumno corporativo en un curso y particular en otro muestra las dos."""
    alumno = crear_alumno(db_session)
    sede = crear_sede(db_session)
    comision_particular = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Python Inicial"),
        sede=sede,
        cupo_maximo=5,
    )
    comision_corporativa = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Data Science"),
        sede=sede,
        cupo_maximo=5,
    )
    empresa = crear_empresa(db_session)
    crear_inscripcion(db_session, alumno=alumno, comision=comision_particular)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision_corporativa,
        categoria=CategoriaInscripcion.CORPORATIVO.value,
        empresa_id=empresa.id,
    )

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == alumno.id
    assert [inscripcion["categoria"] for inscripcion in cuerpo["inscripciones"]] == [
        "PARTICULAR",
        "CORPORATIVO",
    ]
    particular, corporativa = cuerpo["inscripciones"]
    assert particular["comision"]["codigo"] == comision_particular.codigo
    assert particular["acceso"]["estado"] == "BLOQUEADO"
    assert corporativa["empresa"]["razon_social"] == empresa.razon_social
    assert corporativa["acceso"]["estado"] == "HABILITADO"


def test_el_detalle_de_un_alumno_sin_inscripciones_trae_la_lista_vacia(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["inscripciones"] == []


def test_el_detalle_no_deriva_acceso_para_una_inscripcion_no_activa(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: una cursada terminada informa su estado de inscripción y ningún acceso."""
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, cupo_maximo=5)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        estado=EstadoInscripcion.COMPLETADA.value,
    )

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    [inscripcion] = respuesta.json()["inscripciones"]
    assert inscripcion["estado"] == "COMPLETADA"
    assert inscripcion["acceso"] is None


def test_el_detalle_de_un_alumno_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.get("/alumnos/999999")

    assert respuesta.status_code == 404, respuesta.text


def test_reactivable_sigue_respondiendo_despues_del_detalle(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """El detalle se declara después de `/reactivable` para no comerse la ruta (HU 64)."""
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.get(
        "/alumnos/reactivable",
        params={"documento": alumno.documento, "email": alumno.email},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() is None


def test_el_detalle_es_solo_para_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert api_client.get(f"/alumnos/{alumno.id}").status_code == 403

    api_client.headers.clear()
    assert api_client.get(f"/alumnos/{alumno.id}").status_code == 401


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
