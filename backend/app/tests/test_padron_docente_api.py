"""Padrón de una comisión asignada, visto por el docente (10.3).

La fila trae el `acceso` derivado: sin ese dato la pantalla no puede separar habilitados de
bloqueados y rompía al filtrar. La regresión fue de serialización —el esquema del padrón declaraba
`AlumnoOut`, que no tiene `acceso`, y Pydantic lo descartaba—, así que el test mira el JSON.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.padron import Docente, Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_docente,
    crear_inscripcion,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)


def test_el_padron_informa_el_acceso_de_cada_alumno(
    api_client: TestClient, db_session: Session
) -> None:
    docente: Docente = crear_docente(db_session)
    cuenta: Usuario = crear_usuario_docente(db_session, docente=docente, email=docente.email)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))
    comision = crear_comision(db_session, docente=docente)
    alumno = crear_alumno(db_session)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)
    db_session.flush()

    respuesta = api_client.get(f"/comisiones/{comision.codigo}/alumnos")

    assert respuesta.status_code == 200, respuesta.text
    filas = respuesta.json()["alumnos"]
    assert [fila["email"] for fila in filas] == [alumno.email]
    assert filas[0]["acceso"]["estado"] in {"HABILITADO", "BLOQUEADO"}
