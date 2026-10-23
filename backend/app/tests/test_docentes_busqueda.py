"""Búsqueda del padrón de docentes (historia #10) contra PostgreSQL real.

La búsqueda se prueba en el servicio y a través de la ruta porque el contrato tiene dos partes:
el orden de prioridad y la forma de la respuesta con comisiones. Las dos salen de la base, no de
un doble: las comisiones son filas reales y el orden se resuelve en Python después de leer los
docentes activos.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.padron import Usuario
from app.services import padron
from app.tests.factories import (
    crear_comision,
    crear_curso,
    crear_docente,
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


def _buscar(cliente: TestClient, consulta: str) -> list[dict]:
    respuesta = cliente.get("/docentes", params={"q": consulta})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_busqueda_por_prefijo_de_palabra_respeta_el_orden_y_prioriza_el_nombre(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """`a` no busca en cualquier parte: solo al comienzo de una palabra del nombre o apellido."""
    ana = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Gómez",
        dni="30000001",
        email="ana.gomez@techacademy.invalid",
    )
    alfonso = crear_docente(
        db_session,
        nombre="Alfonso",
        apellido="Pérez",
        dni="30000002",
        email="alfonso.perez@techacademy.invalid",
    )
    rita = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Alonso",
        dni="30000003",
        email="rita.alonso@techacademy.invalid",
    )
    marcia = crear_docente(
        db_session,
        nombre="Marcia",
        apellido="Sosa",
        dni="30000004",
        email="marcia.sosa@techacademy.invalid",
    )

    filas = _buscar(cliente_admin, "a")

    # Primero las coincidencias en la primera palabra del nombre; después, el apellido.
    # Marcia queda afuera aunque tenga una `a` en el medio.
    assert [fila["id"] for fila in filas] == [ana.id, alfonso.id, rita.id]
    assert marcia.id not in [fila["id"] for fila in filas]


def test_busqueda_por_prefijo_de_apellido_y_sin_tildes(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(
        db_session,
        nombre="Rocío",
        apellido="Álvarez",
        dni="30000005",
        email="rocio.alvarez@techacademy.invalid",
    )

    for consulta in ("alv", "ÁLV", "rocio", "ROCIO"):
        filas = _buscar(cliente_admin, consulta)
        assert [fila["id"] for fila in filas] == [docente.id], consulta


def test_busqueda_de_varias_palabras_respeta_el_orden(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(
        db_session,
        nombre="Ana María",
        apellido="Gómez",
        dni="30000006",
        email="ana.gomez@techacademy.invalid",
    )

    assert [fila["id"] for fila in _buscar(cliente_admin, "ana gom")] == [docente.id]
    assert _buscar(cliente_admin, "gom ana") == []


def test_busqueda_por_dni_con_o_sin_separadores_y_solo_por_prefijo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Molina",
        dni="30111222",
        email="rita.molina@techacademy.invalid",
    )

    for consulta in ("30.111.222", "30-111-222", "30111", "30"):
        filas = _buscar(cliente_admin, consulta)
        assert [fila["id"] for fila in filas] == [docente.id], consulta

    # No es una búsqueda por "contiene": los dígitos del medio no alcanzan.
    assert _buscar(cliente_admin, "111") == []


def test_busqueda_por_prefijo_de_email(cliente_admin: TestClient, db_session: Session) -> None:
    docente = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Molina",
        dni="30111222",
        email="rita.molina@techacademy.invalid",
    )

    assert [fila["id"] for fila in _buscar(cliente_admin, "rita.molina@")] == [docente.id]
    assert _buscar(cliente_admin, "techacademy") == []


def test_el_nombre_gana_al_dni_y_el_dni_gana_al_email(
    cliente_admin: TestClient, db_session: Session
) -> None:
    with_name = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Sosa",
        dni="31000001",
        email="contacto@techacademy.invalid",
    )
    with_name_in_email = crear_docente(
        db_session,
        nombre="Beto",
        apellido="Pérez",
        dni="31000002",
        email="ana.sosa@techacademy.invalid",
    )
    with_dni = crear_docente(
        db_session,
        nombre="Carlos",
        apellido="Ríos",
        dni="30111222",
        email="carlos.rios@techacademy.invalid",
    )
    with_dni_in_email = crear_docente(
        db_session,
        nombre="Daniel",
        apellido="Luna",
        dni="31999999",
        email="30111222@techacademy.invalid",
    )

    assert [fila["id"] for fila in _buscar(cliente_admin, "ana")] == [
        with_name.id,
        with_name_in_email.id,
    ]
    assert [fila["id"] for fila in _buscar(cliente_admin, "30111222")] == [
        with_dni.id,
        with_dni_in_email.id,
    ]


def test_una_sola_letra_dispara_la_busqueda(cliente_admin: TestClient, db_session: Session) -> None:
    docente = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Gómez",
        dni="30000007",
        email="ana.gomez@techacademy.invalid",
    )
    # Su email empieza con `a`, pero su nombre y apellido no: una sola letra no lo arrastra.
    crear_docente(
        db_session,
        nombre="Beto",
        apellido="Pérez",
        dni="30000012",
        email="ana.perez@techacademy.invalid",
    )

    assert [fila["id"] for fila in _buscar(cliente_admin, "a")] == [docente.id]


def test_solo_devuelve_docentes_activos(cliente_admin: TestClient, db_session: Session) -> None:
    activo = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Gómez",
        dni="30000008",
        email="ana.activa@techacademy.invalid",
    )
    inactivo = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Inactiva",
        dni="30000009",
        email="ana.inactiva@techacademy.invalid",
    )
    inactivo.activo = False
    db_session.flush()

    assert [fila["id"] for fila in _buscar(cliente_admin, "ana")] == [activo.id]
    sin_consulta = cliente_admin.get("/docentes")
    assert sin_consulta.status_code == 200, sin_consulta.text
    assert [fila["id"] for fila in sin_consulta.json()] == [activo.id]


def test_sin_coincidencias_devuelve_una_lista_vacia(cliente_admin: TestClient) -> None:
    assert _buscar(cliente_admin, "zzzz") == []


def test_consulta_vacia_o_solo_espacios_devuelve_el_listado_habitual(
    cliente_admin: TestClient, db_session: Session
) -> None:
    primero = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Gómez",
        dni="30000010",
        email="ana.gomez@techacademy.invalid",
    )
    segundo = crear_docente(
        db_session,
        nombre="Beto",
        apellido="Pérez",
        dni="30000011",
        email="beto.perez@techacademy.invalid",
    )

    for consulta in ("", "   "):
        respuesta = cliente_admin.get("/docentes", params={"q": consulta})
        assert respuesta.status_code == 200, respuesta.text
        assert [fila["id"] for fila in respuesta.json()] == [primero.id, segundo.id], consulta


def test_la_respuesta_trae_las_comisiones_reales_y_su_cantidad(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Molina",
        dni="30111222",
        email="rita.molina@techacademy.invalid",
    )
    sede = crear_sede(db_session, nombre="Sede Central")
    comisiones = []
    for indice, nombre_curso in enumerate(("Python Inicial", "Java Backend")):
        comision = crear_comision(
            db_session,
            sede=sede,
            curso=crear_curso(db_session, nombre=nombre_curso),
            numero=indice + 1,
        )
        comision.docente_id = docente.id
        db_session.flush()
        comisiones.append(comision)

    filas = _buscar(cliente_admin, "rita")

    assert len(filas) == 1
    fila = filas[0]
    assert fila["cantidad_comisiones"] == 2
    assert fila["comisiones"] == [
        {"id": comision.id, "codigo": comision.codigo, "nombre": comision.curso.nombre}
        for comision in comisiones
    ]


def test_un_docente_sin_comisiones_trae_la_lista_vacia(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Molina",
        dni="30111222",
        email="rita.molina@techacademy.invalid",
    )

    fila = _buscar(cliente_admin, "rita")[0]

    assert fila["id"] == docente.id
    assert fila["comisiones"] == []
    assert fila["cantidad_comisiones"] == 0


def test_la_busqueda_exige_rol_de_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert api_client.get("/docentes", params={"q": "a"}).status_code == 403
    assert api_client.get("/docentes").status_code == 403


def test_la_busqueda_sin_token_es_401(api_client: TestClient) -> None:
    assert api_client.get("/docentes", params={"q": "a"}).status_code == 401


def test_el_servicio_ordena_por_posicion_y_desempata_por_id(
    db_session: Session,
) -> None:
    """El orden no depende del orden de inserción: el `id` solo desempata."""
    primero = crear_docente(
        db_session,
        nombre="Alfonso",
        apellido="Pérez",
        dni="32000001",
        email="alfonso@techacademy.invalid",
    )
    segundo = crear_docente(
        db_session,
        nombre="Rita",
        apellido="Alonso",
        dni="32000002",
        email="rita@techacademy.invalid",
    )

    filas = padron.listar_docentes(db_session, "al")

    assert [fila.id for fila in filas] == [primero.id, segundo.id]


def test_desempata_por_id_cuando_la_posicion_es_la_misma(db_session: Session) -> None:
    primero = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Pérez",
        dni="32000003",
        email="ana.perez@techacademy.invalid",
    )
    segundo = crear_docente(
        db_session,
        nombre="Ana",
        apellido="Gómez",
        dni="32000004",
        email="ana.gomez@techacademy.invalid",
    )

    filas = padron.listar_docentes(db_session, "ana")

    assert [fila.id for fila in filas] == [primero.id, segundo.id]
