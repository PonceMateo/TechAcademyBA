"""API de autoservicio del docente (HU 90).

**Lo que estas pruebas cubren es el contrato HTTP, la sincronización con la cuenta y el
aislamiento.** El rol se exige con `require_roles(Rol.DOCENTE)`, así que Administración y Alumno no
tienen acceso, y una cuenta con cambio de contraseña pendiente tampoco (D45). El docente sale de
`usuario.docente` de la cuenta autenticada: ninguna ruta recibe un identificador (D63).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import MENSAJE_CAMBIO_PASSWORD_PENDIENTE, MENSAJE_SIN_PERMISOS
from app.models.padron import Docente, Usuario
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_alumno,
    crear_comision,
    crear_docente,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

EMAIL_NUEVO = "rita.nueva@techacademy.invalid"
TELEFONO_NUEVO = "+5491140000099"


def test_las_dos_rutas_del_docente_estan_registradas(client) -> None:
    """El router está incluido y no existe ninguna ruta con identificador de docente."""
    esquema = client.get("/openapi.json").json()

    assert "/docente/mi-perfil" in esquema["paths"]
    assert set(esquema["paths"]["/docente/mi-perfil"]) == {"get", "put"}
    assert not [ruta for ruta in esquema["paths"] if ruta.startswith("/docente/") and "{" in ruta]


@pytest.fixture
def docente(db_session: Session) -> Docente:
    return crear_docente(db_session, cuil="20301112220")


@pytest.fixture
def cuenta_docente(db_session: Session, docente: Docente) -> Usuario:
    return crear_usuario_docente(db_session, docente=docente, email=docente.email)


@pytest.fixture
def cliente_docente(api_client: TestClient, cuenta_docente: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta_docente)))
    return api_client


# --- Consulta -----------------------------------------------------------------------------------


def test_el_perfil_trae_la_identidad_las_comisiones_y_el_contacto(
    cliente_docente: TestClient, db_session: Session, docente: Docente
) -> None:
    comision = crear_comision(db_session, docente=docente)

    respuesta = cliente_docente.get("/docente/mi-perfil")

    assert respuesta.status_code == 200, respuesta.text
    perfil = respuesta.json()
    assert perfil["nombre"] == docente.nombre
    assert perfil["apellido"] == docente.apellido
    assert perfil["dni"] == docente.dni
    assert perfil["cuil"] == "20301112220"
    assert perfil["email"] == docente.email
    assert perfil["telefono"] == docente.telefono
    assert perfil["comisiones"] == [
        {
            "codigo": comision.codigo,
            "nombre_curso": comision.curso.nombre,
            "horario": comision.dias_horarios,
            "estado": "Activa",
        }
    ]


# --- Edición de email y teléfono ----------------------------------------------------------------


def test_guarda_email_y_telefono_en_el_padron_y_en_la_cuenta(
    cliente_docente: TestClient, db_session: Session, docente: Docente, cuenta_docente: Usuario
) -> None:
    respuesta = cliente_docente.put(
        "/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": TELEFONO_NUEVO}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["email"] == EMAIL_NUEVO
    assert respuesta.json()["telefono"] == TELEFONO_NUEVO
    assert docente.email == EMAIL_NUEVO
    assert docente.telefono == TELEFONO_NUEVO
    assert cuenta_docente.email == EMAIL_NUEVO


def test_el_login_pasa_al_email_nuevo_y_el_anterior_deja_de_servir(
    cliente_docente: TestClient, docente: Docente
) -> None:
    anterior = docente.email
    cliente_docente.put(
        "/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": None}
    )

    nuevo = cliente_docente.post(
        "/auth/login", json={"email": EMAIL_NUEVO, "password": PASSWORD_DE_PRUEBA}
    )
    viejo = cliente_docente.post(
        "/auth/login", json={"email": anterior, "password": PASSWORD_DE_PRUEBA}
    )

    assert nuevo.status_code == 200, nuevo.text
    assert viejo.status_code == 401


def test_conservar_el_propio_email_no_es_un_duplicado(
    cliente_docente: TestClient, docente: Docente
) -> None:
    respuesta = cliente_docente.put(
        "/docente/mi-perfil", json={"email": docente.email, "telefono": None}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["email"] == docente.email


@pytest.mark.parametrize("padron", ["docente", "alumno", "cuenta"])
def test_un_email_de_cualquiera_de_los_tres_padrones_es_un_409(
    cliente_docente: TestClient, db_session: Session, docente: Docente, padron: str
) -> None:
    ocupado = "ocupado@techacademy.invalid"
    if padron == "docente":
        crear_docente(db_session, dni="35111222", email=ocupado)
    elif padron == "alumno":
        crear_alumno(db_session, documento="35111222", email=ocupado)
    else:
        crear_usuario_admin(db_session, email=ocupado)

    respuesta = cliente_docente.put(
        "/docente/mi-perfil", json={"email": ocupado, "telefono": None}
    )

    assert respuesta.status_code == 409
    assert ocupado in respuesta.json()["detail"]
    assert "ya está registrado" in respuesta.json()["detail"]
    assert docente.email == "rita.molina@techacademy.invalid"


@pytest.mark.parametrize("campo", ["nombre", "apellido", "dni", "cuil"])
def test_los_datos_de_identidad_no_se_pueden_editar(
    cliente_docente: TestClient, docente: Docente, campo: str
) -> None:
    respuesta = cliente_docente.put(
        "/docente/mi-perfil",
        json={"email": EMAIL_NUEVO, "telefono": None, campo: "otro valor"},
    )

    assert respuesta.status_code == 422
    assert docente.email == "rita.molina@techacademy.invalid"


def test_un_email_o_un_telefono_con_forma_invalida_es_un_422(cliente_docente: TestClient) -> None:
    sin_forma_de_email = cliente_docente.put(
        "/docente/mi-perfil", json={"email": "rita", "telefono": None}
    )
    sin_forma_de_telefono = cliente_docente.put(
        "/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": "011 4788-1122"}
    )

    assert sin_forma_de_email.status_code == 422
    assert sin_forma_de_telefono.status_code == 422


def test_editar_el_propio_perfil_no_toca_a_otro_docente(
    cliente_docente: TestClient, db_session: Session
) -> None:
    otro = crear_docente(
        db_session,
        nombre="Otro",
        apellido="Docente",
        dni="35111222",
        email="otro.docente@techacademy.invalid",
    )

    cliente_docente.put("/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": None})

    assert otro.email == "otro.docente@techacademy.invalid"


# --- Autorización -------------------------------------------------------------------------------


@pytest.mark.parametrize("cuenta", ["admin", "alumno"])
def test_solo_el_rol_docente_entra_a_su_perfil(
    api_client: TestClient, db_session: Session, cuenta: str
) -> None:
    usuario = (
        crear_usuario_admin(db_session)
        if cuenta == "admin"
        else crear_usuario_alumno(db_session)
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(usuario)))

    assert api_client.get("/docente/mi-perfil").status_code == 403
    respuesta = api_client.put(
        "/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": None}
    )
    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == MENSAJE_SIN_PERMISOS


def test_sin_token_responde_401(api_client: TestClient) -> None:
    assert api_client.get("/docente/mi-perfil").status_code == 401
    respuesta = api_client.put(
        "/docente/mi-perfil", json={"email": EMAIL_NUEVO, "telefono": None}
    )
    assert respuesta.status_code == 401


def test_una_cuenta_con_cambio_pendiente_no_llega_al_perfil(
    api_client: TestClient, db_session: Session
) -> None:
    """D45: el docente recién dado de alta cambia la contraseña antes de usar el sistema."""
    docente = crear_docente(db_session, dni="35111222", email="pendiente@techacademy.invalid")
    usuario = crear_usuario_docente(
        db_session, docente=docente, email=docente.email, must_change_password=True
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(usuario)))

    respuesta = api_client.get("/docente/mi-perfil")

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == MENSAJE_CAMBIO_PASSWORD_PENDIENTE
