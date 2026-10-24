"""Edición de un curso del catálogo (HU #3).

Corre contra PostgreSQL real (D15). Lo que se afirma:

- la edición conserva el `id`, el código generado y las comisiones del curso;
- el nombre se normaliza y la unicidad excluye al propio curso, así que guardar el mismo
  nombre no choca;
- un nombre de otro curso responde `409` y nombra el curso existente;
- el código no es parte del contrato: mandarlo responde `422`;
- un curso inexistente responde `404` y las tres rutas son solo de Administración.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogo import Comision, Curso
from app.models.padron import Usuario
from app.schemas.catalogo import CursoUpdate
from app.services import catalogo
from app.services.normalization import normalize_name
from app.tests.factories import (
    crear_comision,
    crear_curso,
    crear_usuario_admin,
    crear_usuario_alumno,
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


# ------------------------------------------------------------------- servicio


def test_editar_curso_conserva_codigo_y_comisiones(db_session: Session) -> None:
    """HU #3: cambiar el nombre no reasigna el curso ni toca su historial."""
    curso = crear_curso(db_session, nombre="Python Inicial")
    comision = crear_comision(db_session, curso=curso)
    db_session.refresh(curso)
    codigo = curso.codigo

    actualizado = catalogo.editar_curso(
        db_session,
        curso,
        CursoUpdate(nombre="Categoría Ónica", descripcion="Descripción nueva."),
    )

    assert actualizado.id == curso.id
    assert actualizado.codigo == codigo, "el código generado no cambia (D32)"
    assert actualizado.nombre == "Categoría Ónica"
    assert actualizado.nombre_norm == normalize_name("Categoría Ónica")
    assert actualizado.descripcion == "Descripción nueva."
    assert db_session.get(Comision, comision.id).curso_id == curso.id


def test_editar_curso_con_el_mismo_nombre_no_choca_consigo_mismo(db_session: Session) -> None:
    """La comparación de unicidad excluye el `id` que se está editando."""
    curso = crear_curso(db_session, nombre="Python Inicial")

    actualizado = catalogo.editar_curso(
        db_session, curso, CursoUpdate(nombre="Python Inicial", descripcion="Otra.")
    )

    assert actualizado.nombre == "Python Inicial"
    assert actualizado.descripcion == "Otra."


def test_editar_curso_rechaza_el_nombre_de_otro_y_lo_nombra(db_session: Session) -> None:
    existente = crear_curso(db_session, nombre="Diseño UX/UI Avanzado")
    curso = crear_curso(db_session, nombre="Python Inicial")

    with pytest.raises(catalogo.CursoDuplicado) as error:
        catalogo.editar_curso(
            db_session, curso, CursoUpdate(nombre="diseno ux/ui avanzado")
        )

    assert error.value.existente is not None
    assert existente.codigo in str(error.value)
    assert existente.nombre in str(error.value)


# ----------------------------------------------------------------------- API


def test_edicion_exitosa_devuelve_el_curso_actualizado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session, nombre="Python Inicial")
    comision = crear_comision(db_session, curso=curso)
    db_session.refresh(curso)
    codigo = curso.codigo

    respuesta = cliente_admin.put(
        f"/cursos/{curso.id}",
        json={"nombre": "Python Inicial (2026)", "descripcion": "Actualizado."},
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == curso.id
    assert cuerpo["codigo"] == codigo
    assert cuerpo["nombre"] == "Python Inicial (2026)"
    assert cuerpo["descripcion"] == "Actualizado."
    assert db_session.get(Comision, comision.id).curso_id == curso.id


def test_guardar_el_mismo_nombre_es_aceptado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session, nombre="Python Inicial")

    respuesta = cliente_admin.put(f"/cursos/{curso.id}", json={"nombre": "Python Inicial"})

    assert respuesta.status_code == 200, respuesta.text


def test_nombre_duplicado_da_409_y_nombra_el_curso_existente(
    cliente_admin: TestClient, db_session: Session
) -> None:
    existente = crear_curso(db_session, nombre="Diseño UX/UI Avanzado")
    curso = crear_curso(db_session, nombre="Python Inicial")

    respuesta = cliente_admin.put(
        f"/cursos/{curso.id}", json={"nombre": "diseno ux/ui avanzado"}
    )

    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"]
    assert existente.codigo in detalle, detalle
    assert existente.nombre in detalle, detalle


def test_el_codigo_no_se_edita_y_mandarlo_da_422(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D32: el código es una columna generada y no forma parte del contrato de entrada."""
    curso = crear_curso(db_session, nombre="Python Inicial")
    db_session.refresh(curso)
    codigo = curso.codigo

    respuesta = cliente_admin.put(
        f"/cursos/{curso.id}",
        json={"nombre": "Python Inicial", "codigo": "CUR-999"},
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.expire_all()
    assert db_session.get(Curso, curso.id).codigo == codigo


@pytest.mark.parametrize("nombre", ["", "   "])
def test_nombre_vacio_da_422(
    cliente_admin: TestClient, db_session: Session, nombre: str
) -> None:
    curso = crear_curso(db_session, nombre="Python Inicial")

    respuesta = cliente_admin.put(f"/cursos/{curso.id}", json={"nombre": nombre})

    assert respuesta.status_code == 422, respuesta.text


def test_curso_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.put("/cursos/999999", json={"nombre": "No existe"})

    assert respuesta.status_code == 404, respuesta.text


def test_editar_sin_token_es_401(api_client: TestClient) -> None:
    assert api_client.put("/cursos/1", json={"nombre": "Sin token"}).status_code == 401


@pytest.mark.parametrize("rol", ["docente", "alumno"])
def test_editar_exige_rol_de_administracion(
    api_client: TestClient, db_session: Session, rol: str
) -> None:
    curso = crear_curso(db_session, nombre="Python Inicial")
    cuenta = (
        crear_usuario_docente(db_session)
        if rol == "docente"
        else crear_usuario_alumno(db_session)
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))

    respuesta = api_client.put(f"/cursos/{curso.id}", json={"nombre": "Sin permiso"})

    assert respuesta.status_code == 403
    assert respuesta.headers["X-Roles-Admitidos"] == "ADMIN"
    db_session.expire_all()
    assert db_session.get(Curso, curso.id).nombre == "Python Inicial"
