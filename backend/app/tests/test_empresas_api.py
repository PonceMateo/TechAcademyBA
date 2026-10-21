"""Alta y consulta de empresas contra PostgreSQL real (historia #18).

Lo que estos tests afirma por debajo de la respuesta:
- el contrato de alta admite **únicamente** razón social, CUIT e indicador de Factura A
  (`extra="forbid"`), y un campo de otra historia es un 422;
- el CUIT se valida por formato y por dígito verificador, y la base también lo sostiene;
- el duplicado se resuelve sobre `cuit_norm` (D6): `30-12345678-1` y `30123456781` son la
  misma empresa, y el segundo alta la muestra por razón social y CUIT;
- las rutas son de Administración: 401 sin token y 403 con otro rol.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.padron import Usuario
from app.tests.factories import (
    crear_empresa,
    crear_usuario_admin,
    crear_usuario_docente,
    cuit_valido,
    encabezado_de_autorizacion,
    token_de_prueba,
)

#: CUIT de ejemplo con dígito verificador calculado con la regla de AFIP.
CUIT = cuit_valido("3012345678")

ALTA = {"razon_social": "Acme SRL", "cuit": CUIT, "requiere_factura_a": True}


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def test_alta_de_empresa_correcta(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post("/empresas", json=ALTA)

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["razon_social"] == "Acme SRL"
    assert cuerpo["cuit"] == CUIT
    assert cuerpo["requiere_factura_a"] is True
    assert cuerpo["activo"] is True


def test_la_empresa_alta_queda_en_la_consulta(cliente_admin: TestClient) -> None:
    cliente_admin.post("/empresas", json=ALTA)

    listado = cliente_admin.get("/empresas")

    assert listado.status_code == 200, listado.text
    assert [e["razon_social"] for e in listado.json()] == ["Acme SRL"]


def test_cuit_duplicado_muestra_la_empresa_existente(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_empresa(db_session, razon_social="Tech Solutions S.A.", cuit=CUIT)

    respuesta = cliente_admin.post("/empresas", json={**ALTA, "razon_social": "Otra"})

    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"]
    assert "Tech Solutions S.A." in detalle, detalle
    assert CUIT in detalle, detalle


def test_cuit_con_guiones_colisiona_con_el_mismo_sin_guiones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D6: la unicidad es sobre `cuit_norm`, no sobre el texto escrito."""
    crear_empresa(db_session, razon_social="Tech Solutions S.A.", cuit=CUIT)
    con_guiones = f"{CUIT[:2]}-{CUIT[2:10]}-{CUIT[10]}"

    respuesta = cliente_admin.post("/empresas", json={**ALTA, "cuit": con_guiones})

    assert respuesta.status_code == 409, respuesta.text
    assert "Tech Solutions S.A." in respuesta.json()["detail"]


def test_cuit_con_digito_verificador_invalido(cliente_admin: TestClient) -> None:
    malo = f"{CUIT[:10]}{(int(CUIT[10]) + 1) % 10}"

    respuesta = cliente_admin.post("/empresas", json={**ALTA, "cuit": malo})

    assert respuesta.status_code == 422, respuesta.text


def test_cuit_con_letras(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post("/empresas", json={**ALTA, "cuit": "30-abc123456-1"})

    assert respuesta.status_code == 422, respuesta.text


def test_cuit_con_menos_de_once_digitos(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post("/empresas", json={**ALTA, "cuit": CUIT[:10]})

    assert respuesta.status_code == 422, respuesta.text


@pytest.mark.parametrize("razon_social", ["", "   "])
def test_razon_social_obligatoria(cliente_admin: TestClient, razon_social: str) -> None:
    respuesta = cliente_admin.post("/empresas", json={**ALTA, "razon_social": razon_social})

    assert respuesta.status_code == 422, respuesta.text


def test_el_alta_no_admite_campos_de_otras_historias(cliente_admin: TestClient) -> None:
    """La nómina de empleados es la historia #19: un campo suyo hoy es un 422."""
    respuesta = cliente_admin.post("/empresas", json={**ALTA, "nomina_empleados": "Grupo 5"})

    assert respuesta.status_code == 422, respuesta.text


def test_las_rutas_son_de_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    assert api_client.get("/empresas").status_code == 401
    assert api_client.post("/empresas", json=ALTA).status_code == 401

    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert api_client.get("/empresas").status_code == 403
    assert api_client.post("/empresas", json=ALTA).status_code == 403
