"""Alta y consulta del padrón de alumnos (historia #13) contra PostgreSQL real.

Lo que estos tests afirman por debajo de la respuesta:

- el alta **no admite un campo de tipo de documento** (`extra="forbid"`), porque esta entrega
  registra solo DNI (D44);
- el DNI se acepta con puntos, espacios o guiones y se guarda crudo, con su forma normalizada en
  `documento_norm` para que `38.456.789` colisione con `38456789`;
- el rechazo del documento repetido dice **documento** y el del email repetido dice **email**,
  sin los datos del alumno existente (D44);
- el correo ya tomado en el padrón de docentes se rechaza, porque la unicidad cruzada la sostiene
  el servicio (M1);
- el alumno y su cuenta se crean juntos: si falla la cuenta no queda el alumno;
- la cuenta entra al sistema con la contraseña de demostración, guardada como hash bcrypt;
- el listado devuelve los huecos de comisión, categoría y acceso en `null`, sin inventarlos.

Corre contra la base de pruebas de verdad (D15): el índice único sobre `documento_norm` y el
CHECK `rol_vinculo_coherente` son los que sostienen media historia, y un doble no los probaría.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import Rol, TipoDocumento
from app.models.padron import Alumno, Usuario
from app.schemas.alumnos import AlumnoCreate
from app.services import alumnos as servicio_alumnos
from app.services.auth import autenticar
from app.tests.factories import (
    crear_alumno,
    crear_docente,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

#: Contraseña de las cuentas de demostración: la misma del seed y del alta de docente.
CONTRASENA = "Demo2026!"

ALTA = {
    "documento": "38.456.789",
    "nombre": "Juan Ignacio Pérez",
    "email": "juan.perez@techacademy.invalid",
    "telefono": "+54 11 4000-0003",
}


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


# ------------------------------------------------------------------- alta


def test_alta_de_alumno_crea_el_alumno_con_tipo_dni(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post("/alumnos", json=ALTA)

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Juan Ignacio Pérez"
    assert cuerpo["documento"] == "38.456.789", "se conserva el formato informado"
    assert cuerpo["tipo_documento"] == TipoDocumento.DNI.value
    assert cuerpo["email"] == ALTA["email"]
    assert cuerpo["telefono"] == ALTA["telefono"]
    assert cuerpo["activo"] is True


def test_el_alta_aparece_en_el_padron(cliente_admin: TestClient) -> None:
    creado = cliente_admin.post("/alumnos", json=ALTA).json()

    respuesta = cliente_admin.get("/alumnos")

    assert respuesta.status_code == 200, respuesta.text
    filas = {fila["id"]: fila for fila in respuesta.json()}
    assert filas[creado["id"]]["documento"] == "38.456.789"


@pytest.mark.parametrize("documento", ["38.456.789", "38 456 789", "38-456-789"])
def test_el_dni_con_puntos_espacios_o_guiones_se_normaliza(
    cliente_admin: TestClient, db_session: Session, documento: str
) -> None:
    respuesta = cliente_admin.post("/alumnos", json={**ALTA, "documento": documento})

    assert respuesta.status_code == 201, respuesta.text
    alumno = db_session.scalar(select(Alumno).where(Alumno.email == ALTA["email"]))
    assert alumno.documento == documento, "la pantalla muestra el documento como se escribió"
    assert alumno.documento_norm == "38456789", "el índice único va sobre la forma normalizada"


@pytest.mark.parametrize("documento", ["38.456.78A", "123456", "123456789", "38.456.789.0"])
def test_el_dni_invalido_es_rechazado(cliente_admin: TestClient, documento: str) -> None:
    respuesta = cliente_admin.post("/alumnos", json={**ALTA, "documento": documento})

    assert respuesta.status_code == 422, respuesta.text
    assert "7 u 8 dígitos" in respuesta.text


@pytest.mark.parametrize("nombre", ["", "   "])
def test_el_nombre_es_obligatorio(cliente_admin: TestClient, nombre: str) -> None:
    respuesta = cliente_admin.post("/alumnos", json={**ALTA, "nombre": nombre})

    assert respuesta.status_code == 422, respuesta.text


def test_el_email_es_obligatorio(cliente_admin: TestClient) -> None:
    cuerpo = {clave: valor for clave, valor in ALTA.items() if clave != "email"}

    respuesta = cliente_admin.post("/alumnos", json=cuerpo)

    assert respuesta.status_code == 422, respuesta.text


@pytest.mark.parametrize("email", ["juan@", "juan.perez", "@example.com", "juan@example.", ""])
def test_el_email_con_forma_invalida_es_rechazado(cliente_admin: TestClient, email: str) -> None:
    respuesta = cliente_admin.post("/alumnos", json={**ALTA, "email": email})

    assert respuesta.status_code == 422, respuesta.text


def test_el_telefono_es_opcional(cliente_admin: TestClient, db_session: Session) -> None:
    cuerpo = {clave: valor for clave, valor in ALTA.items() if clave != "telefono"}

    respuesta = cliente_admin.post("/alumnos", json=cuerpo)

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["telefono"] is None
    assert db_session.scalar(select(Alumno).where(Alumno.email == ALTA["email"])).telefono is None


def test_el_contrato_no_admite_tipo_de_documento(cliente_admin: TestClient) -> None:
    """D44: el alta de esta entrega registra solo DNI. `tipo_documento` en el JSON es un 422."""
    respuesta = cliente_admin.post(
        "/alumnos", json={**ALTA, "tipo_documento": TipoDocumento.PASAPORTE.value}
    )

    assert respuesta.status_code == 422, respuesta.text


# -------------------------------------------------------------- duplicados


def test_documento_duplicado_con_distinto_formato_nombra_el_campo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_alumno(db_session, documento="38456789", email="existente@techacademy.invalid")

    respuesta = cliente_admin.post("/alumnos", json=ALTA)

    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"]
    assert "documento" in detalle.lower(), detalle
    assert "existente@techacademy.invalid" not in detalle, "no expone al alumno existente"
    assert "Agustina Benítez" not in detalle, "no expone al alumno existente"


def test_email_de_alumno_duplicado_nombra_el_campo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_alumno(db_session, documento="30111222", email=ALTA["email"])

    respuesta = cliente_admin.post("/alumnos", json=ALTA)

    assert respuesta.status_code == 409, respuesta.text
    assert "email" in respuesta.json()["detail"].lower()


def test_email_tomado_por_un_docente_se_rechaza(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """M1: un índice único es por tabla, así que la unicidad cruzada la sostiene el servicio."""
    crear_docente(db_session, email=ALTA["email"])

    respuesta = cliente_admin.post("/alumnos", json=ALTA)

    assert respuesta.status_code == 409, respuesta.text
    assert "docentes" in respuesta.json()["detail"]


def test_documento_y_email_repetidos_a_la_vez_informan_el_documento(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_alumno(db_session, documento="38456789", email=ALTA["email"])

    respuesta = cliente_admin.post("/alumnos", json=ALTA)

    assert respuesta.status_code == 409, respuesta.text
    assert "documento" in respuesta.json()["detail"].lower(), respuesta.json()


# --------------------------------------------------- transacción y cuenta


def test_la_cuenta_se_crea_con_la_contrasena_demo_y_sin_cambio_pendiente(
    cliente_admin: TestClient, db_session: Session
) -> None:
    cliente_admin.post("/alumnos", json=ALTA)

    usuario = autenticar(db_session, ALTA["email"], CONTRASENA)

    assert usuario.rol == Rol.ALUMNO.value
    assert usuario.must_change_password is False, "D18: sin cambio pendiente"
    assert usuario.is_active is True
    assert usuario.alumno_id is not None


def test_la_contrasena_se_guarda_como_hash_bcrypt(
    cliente_admin: TestClient, db_session: Session
) -> None:
    cliente_admin.post("/alumnos", json=ALTA)

    usuario = db_session.scalar(select(Usuario).where(Usuario.email == ALTA["email"]))

    assert usuario.password_hash != CONTRASENA
    assert usuario.password_hash.startswith("$2b$"), usuario.password_hash


def test_si_falla_la_cuenta_no_queda_el_alumno(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La transacción es una sola: una cuenta que no se puede crear revierte el alumno."""

    def romper_el_hash(*_argumentos, **_keywords):
        raise RuntimeError("sin hash no hay cuenta")

    monkeypatch.setattr(servicio_alumnos, "hashear_password", romper_el_hash)
    datos = AlumnoCreate(**ALTA)

    with pytest.raises(RuntimeError):
        servicio_alumnos.crear_alumno(db_session, datos)

    assert db_session.scalar(select(Alumno).where(Alumno.email == ALTA["email"])) is None
    assert db_session.scalar(select(Usuario).where(Usuario.email == ALTA["email"])) is None


# --------------------------------------------------------------- listado


def test_el_listado_trae_los_huecos_en_null(cliente_admin: TestClient, db_session: Session) -> None:
    crear_alumno(db_session, documento="30111222", email="sin.inscripcion@techacademy.invalid")

    respuesta = cliente_admin.get("/alumnos")

    assert respuesta.status_code == 200, respuesta.text
    [fila] = respuesta.json()
    assert fila["documento"] == "30111222"
    assert fila["comision"] is None
    assert fila["categoria"] is None
    assert fila["porcentaje_beca"] is None
    assert fila["acceso"] is None


def test_el_padron_vacio_devuelve_una_lista_vacia(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.get("/alumnos")

    assert respuesta.status_code == 200
    assert respuesta.json() == []


# ------------------------------------------------------------- permisos


def test_el_padron_de_alumnos_es_solo_para_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session, documento="30111222", email="alumno.login@invalid")
    cuenta = crear_usuario_alumno(db_session, alumno=alumno, email="alumno.login@invalid")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))

    assert api_client.get("/alumnos").status_code == 403


def test_un_docente_no_lee_ni_escribe_el_padron_de_alumnos(
    api_client: TestClient, db_session: Session
) -> None:
    docente_del_padron = crear_docente(db_session)
    cuenta = crear_usuario_docente(db_session, docente=docente_del_padron)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))

    assert api_client.get("/alumnos").status_code == 403
    respuesta = api_client.post("/alumnos", json=ALTA)
    assert respuesta.status_code == 403
    assert respuesta.headers["X-Roles-Admitidos"] == "ADMIN"
    assert db_session.scalar(select(Alumno).where(Alumno.email == ALTA["email"])) is None


def test_el_alta_sin_token_es_401(api_client: TestClient) -> None:
    assert api_client.post("/alumnos", json=ALTA).status_code == 401


def test_el_listado_sin_token_es_401(api_client: TestClient) -> None:
    assert api_client.get("/alumnos").status_code == 401
