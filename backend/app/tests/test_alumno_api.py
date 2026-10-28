"""API de autoservicio del alumno (HUs #38, #42 y #43).

**Lo que estas pruebas cubren es el contrato HTTP y el aislamiento.** El rol se exige con
`require_roles(Rol.ALUMNO)`, así que Administración y Docente no tienen acceso, y una cuenta con
cambio de contraseña pendiente tampoco (D45). Además, ninguna respuesta puede traer datos de otro
alumno: el legajo sale de la cuenta autenticada y el código se busca entre sus inscripciones (D60).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import MENSAJE_CAMBIO_PASSWORD_PENDIENTE, MENSAJE_SIN_PERMISOS
from app.models.enums import CategoriaInscripcion
from app.models.padron import Alumno, Usuario
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_docente,
    crear_inscripcion,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)


def test_las_cuatro_rutas_del_alumno_estan_registradas(client) -> None:
    """El router está incluido en la aplicación y todas sus rutas existen."""
    esquema = client.get("/openapi.json").json()

    assert {
        "/alumno/inscripciones",
        "/alumno/inscripciones/{codigo}",
        "/alumno/mi-perfil",
    } <= set(esquema["paths"])
    assert set(esquema["paths"]["/alumno/mi-perfil"]) == {"get", "put"}


# --- Contrato HTTP: códigos y mensajes ----------------------------------------------------------


@pytest.fixture
def alumna(db_session: Session) -> Alumno:
    return crear_alumno(db_session)


@pytest.fixture
def cuenta_alumna(db_session: Session, alumna: Alumno) -> Usuario:
    return crear_usuario_alumno(db_session, alumno=alumna)


@pytest.fixture
def cliente_alumna(api_client: TestClient, cuenta_alumna: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta_alumna)))
    return api_client


def test_las_cursadas_llegan_con_su_estado_y_su_causa(
    cliente_alumna: TestClient, db_session: Session, alumna: Alumno
) -> None:
    docente = crear_docente(db_session, nombre="Laura", apellido="Benítez")
    comision = crear_comision(db_session, docente=docente)
    crear_inscripcion(
        db_session,
        alumno=alumna,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_TOTAL.value,
    )

    respuesta = cliente_alumna.get("/alumno/inscripciones")

    assert respuesta.status_code == 200, respuesta.text
    (inscripcion,) = respuesta.json()
    assert inscripcion["codigo"] == comision.codigo
    assert inscripcion["nombre_curso"] == comision.curso.nombre
    assert inscripcion["docente_nombre"] == "Laura Benítez"
    assert inscripcion["horario"] == "Lun y Mié 18-20hs"
    assert inscripcion["categoria"] == CategoriaInscripcion.BECADO_TOTAL.value
    assert inscripcion["acceso"] == {"estado": "HABILITADO", "causa": None, "forzado": False}


def test_un_alumno_sin_cursadas_recibe_una_lista_vacia(cliente_alumna: TestClient) -> None:
    respuesta = cliente_alumna.get("/alumno/inscripciones")

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_el_detalle_de_una_comision_ajena_es_un_404_sin_pistas(
    cliente_alumna: TestClient, db_session: Session
) -> None:
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    curso = crear_curso(db_session)
    propia = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    otro = crear_alumno(
        db_session,
        nombre="Otro Alumno",
        documento="39999888",
        email="otro.detalle@techacademy.invalid",
    )
    crear_inscripcion(db_session, alumno=otro, comision=propia)

    de_otro = cliente_alumna.get(f"/alumno/inscripciones/{propia.codigo}")
    inexistente = cliente_alumna.get("/alumno/inscripciones/CUR999-9")

    assert de_otro.status_code == 404
    assert inexistente.status_code == 404
    assert de_otro.json()["detail"] == inexistente.json()["detail"]
    assert de_otro.json()["detail"] == "No encontré esa cursada entre tus inscripciones."


def test_el_detalle_propio_trae_el_cronograma_y_los_encuentros(
    cliente_alumna: TestClient, db_session: Session, alumna: Alumno
) -> None:
    comision = crear_comision(db_session)
    comision.fecha_inicio = None
    crear_inscripcion(db_session, alumno=alumna, comision=comision)

    respuesta = cliente_alumna.get(f"/alumno/inscripciones/{comision.codigo}")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["cronograma"] == {"inicio": None, "fin": None}
    assert len(cuerpo["proximos_encuentros"]) == 4
    assert cuerpo["proximos_encuentros"][0]["horario"] == "18:00-20:00"
    assert cuerpo["proximos_encuentros"][0]["tema"] is None
    assert "link" not in cuerpo
    assert "link_virtual" not in cuerpo["comision"]


def test_editar_el_contacto_devuelve_lo_guardado(cliente_alumna: TestClient) -> None:
    respuesta = cliente_alumna.put(
        "/alumno/mi-perfil",
        json={"email": "agustina.nueva@techacademy.invalid", "telefono": "+5491140000009"},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["email"] == "agustina.nueva@techacademy.invalid"
    assert respuesta.json()["telefono"] == "+5491140000009"


def test_un_email_de_otra_cuenta_es_un_409_y_no_cambia_nada(
    cliente_alumna: TestClient, db_session: Session, alumna: Alumno
) -> None:
    otro = crear_alumno(
        db_session, nombre="Otro Alumno", documento="39999888", email="ocupado@techacademy.invalid"
    )

    respuesta = cliente_alumna.put(
        "/alumno/mi-perfil", json={"email": otro.email, "telefono": None}
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == (
        f"El email {otro.email} ya está registrado en el padrón de alumnos."
    )
    assert alumna.email == "agustina.benitez@techacademy.invalid"


@pytest.mark.parametrize("campo", ["documento", "nombre", "id"])
def test_los_campos_no_editables_son_un_422(cliente_alumna: TestClient, campo: str) -> None:
    respuesta = cliente_alumna.put(
        "/alumno/mi-perfil",
        json={
            "email": "agustina.nueva@techacademy.invalid",
            "telefono": None,
            campo: "otro valor",
        },
    )

    assert respuesta.status_code == 422


def test_un_email_o_un_telefono_con_forma_invalida_es_un_422(cliente_alumna: TestClient) -> None:
    sin_forma_de_email = cliente_alumna.put(
        "/alumno/mi-perfil", json={"email": "agustina", "telefono": None}
    )
    sin_forma_de_telefono = cliente_alumna.put(
        "/alumno/mi-perfil",
        json={"email": "agustina.nueva@techacademy.invalid", "telefono": "011 4788-1122"},
    )

    assert sin_forma_de_email.status_code == 422
    assert sin_forma_de_telefono.status_code == 422


# --- Autorización y aislamiento -----------------------------------------------------------------


@pytest.mark.parametrize("cuenta", ["admin", "docente"])
def test_solo_el_rol_alumno_entra_al_panel(
    api_client: TestClient, db_session: Session, cuenta: str
) -> None:
    usuario = (
        crear_usuario_admin(db_session) if cuenta == "admin" else crear_usuario_docente(db_session)
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(usuario)))

    for ruta in ("/alumno/inscripciones", "/alumno/mi-perfil"):
        respuesta = api_client.get(ruta)
        assert respuesta.status_code == 403
        assert respuesta.json()["detail"] == MENSAJE_SIN_PERMISOS


def test_una_cuenta_con_cambio_pendiente_solo_puede_cambiar_la_contrasena(
    api_client: TestClient, db_session: Session
) -> None:
    """D45: el alumno recién dado de alta no llega al panel hasta cambiar la contraseña."""
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno, must_change_password=True)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(usuario)))

    respuesta = api_client.get("/alumno/inscripciones")

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == MENSAJE_CAMBIO_PASSWORD_PENDIENTE
    assert respuesta.headers["X-Cambio-Password-Pendiente"] == "true"


def test_ninguna_respuesta_trae_datos_de_otro_alumno(
    cliente_alumna: TestClient, db_session: Session, alumna: Alumno
) -> None:
    """Sin identificador en la URL, el único camino es leer la propia cuenta (D60)."""
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    curso = crear_curso(db_session)
    propia = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=alumna, comision=propia)

    otro = crear_alumno(
        db_session,
        nombre="Alumno Ajeno",
        documento="35555666",
        email="ajeno@techacademy.invalid",
    )
    ajena = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=otro, comision=ajena)

    listado = cliente_alumna.get("/alumno/inscripciones").json()
    detalle_ajeno = cliente_alumna.get(f"/alumno/inscripciones/{ajena.codigo}")
    perfil = cliente_alumna.get("/alumno/mi-perfil").json()

    assert [inscripcion["codigo"] for inscripcion in listado] == [propia.codigo]
    assert detalle_ajeno.status_code == 404
    assert perfil["nombre"] == alumna.nombre
    assert perfil["email"] == alumna.email
    assert "documento" not in listado[0]
