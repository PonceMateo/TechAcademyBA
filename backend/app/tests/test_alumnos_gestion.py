"""Edición, restablecimiento de contraseña y baja lógica de alumnos (HU #17).

Corre contra PostgreSQL real (D15). Lo que se afirma:

- editar conserva el `id`, las inscripciones y las imputaciones, y sincroniza la cuenta;
- un DNI o email de otro registro se rechaza con `409`;
- restablecer la contraseña reemplaza el hash, invalida la anterior y deja el cambio obligatorio;
- la baja es lógica: no borra filas, saca al alumno del listado y le cierra el login;
- las tres rutas son solo de Administración.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cobranza import Imputacion
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.services.auth import CredencialesInvalidas, autenticar
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_imputacion,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

NUEVA_PASSWORD = "NuevaClave2026!"

EDICION = {
    "documento": "39.999.111",
    "nombre": "Agustina Benítez Corregida",
    "email": "agustina.corregida@techacademy.invalid",
    "telefono": "+54 11 4000-9999",
}


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _alumno_con_cuenta(db_session: Session, **kwargs) -> tuple[Alumno, Usuario]:
    alumno = crear_alumno(
        db_session,
        documento="38111222",
        email="agustina.benitez@techacademy.invalid",
        **kwargs,
    )
    usuario = crear_usuario_alumno(
        db_session,
        alumno=alumno,
        email="agustina.login@techacademy.invalid",
    )
    return alumno, usuario


# ------------------------------------------------------------------ edición


def test_editar_conserva_id_inscripciones_e_imputaciones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, usuario = _alumno_con_cuenta(db_session)
    comision = crear_comision(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    imputacion = crear_imputacion(
        db_session, cobranza=crear_cobranza(db_session), inscripcion=inscripcion
    )

    respuesta = cliente_admin.put(f"/alumnos/{alumno.id}", json=EDICION)

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == alumno.id
    assert cuerpo["documento"] == EDICION["documento"]
    assert cuerpo["nombre"] == EDICION["nombre"]
    assert cuerpo["email"] == EDICION["email"]

    db_session.expire_all()
    actualizado = db_session.get(Alumno, alumno.id)
    cuenta = db_session.get(Usuario, usuario.id)
    assert actualizado is not None
    assert actualizado.documento_norm == "39999111"
    assert actualizado.tipo_documento == "DNI"
    assert cuenta is not None
    assert cuenta.nombre == EDICION["nombre"]
    assert cuenta.email == EDICION["email"]
    assert db_session.get(Inscripcion, inscripcion.id).alumno_id == alumno.id
    assert db_session.get(Imputacion, imputacion.id).inscripcion_id == inscripcion.id


def test_editar_con_el_mismo_email_no_choca_con_su_propia_cuenta(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)

    respuesta = cliente_admin.put(
        f"/alumnos/{alumno.id}",
        json={**EDICION, "email": alumno.email},
    )

    assert respuesta.status_code == 200, respuesta.text


def test_editar_rechaza_el_documento_de_otro_alumno(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    crear_alumno(db_session, documento="30111222", email="otro@techacademy.invalid")

    respuesta = cliente_admin.put(
        f"/alumnos/{alumno.id}", json={**EDICION, "documento": "30.111.222"}
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "documento" in respuesta.json()["detail"]


def test_editar_rechaza_el_email_de_otro_alumno(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    crear_alumno(db_session, documento="30111222", email="tomado@techacademy.invalid")

    respuesta = cliente_admin.put(
        f"/alumnos/{alumno.id}", json={**EDICION, "email": "tomado@techacademy.invalid"}
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "email" in respuesta.json()["detail"]


def test_editar_un_alumno_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.put("/alumnos/999999", json=EDICION)

    assert respuesta.status_code == 404, respuesta.text


# --------------------------------------------------------- contraseña


def test_restablecer_password_invalida_la_anterior_y_exige_cambio(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, usuario = _alumno_con_cuenta(db_session)

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/password", json={"new_password": NUEVA_PASSWORD}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert "new_password" not in respuesta.json()
    assert NUEVA_PASSWORD not in respuesta.text

    db_session.expire_all()
    cuenta = db_session.get(Usuario, usuario.id)
    assert cuenta is not None
    assert cuenta.password_hash != PASSWORD_DE_PRUEBA
    assert cuenta.must_change_password is True

    with pytest.raises(CredencialesInvalidas):
        autenticar(db_session, cuenta.email, PASSWORD_DE_PRUEBA)
    assert autenticar(db_session, cuenta.email, NUEVA_PASSWORD).id == usuario.id


def test_login_con_la_password_restablecida_pide_cambio(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, usuario = _alumno_con_cuenta(db_session)
    cliente_admin.post(
        f"/alumnos/{alumno.id}/password", json={"new_password": NUEVA_PASSWORD}
    )

    respuesta = cliente_admin.post(
        "/auth/login", json={"email": usuario.email, "password": NUEVA_PASSWORD}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["must_change_password"] is True


def test_restablecer_password_corta_da_422(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/password", json={"new_password": "corta"}
    )

    assert respuesta.status_code == 422, respuesta.text


def test_restablecer_password_sin_cuenta_da_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session, documento="30111222", email="sin.cuenta@techacademy.invalid")

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/password", json={"new_password": NUEVA_PASSWORD}
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "cuenta" in respuesta.json()["detail"]


# ------------------------------------------------------------------- baja


def test_baja_logica_conserva_el_historial_y_cierra_el_acceso(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, usuario = _alumno_con_cuenta(db_session)
    comision = crear_comision(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    imputacion = crear_imputacion(
        db_session, cobranza=crear_cobranza(db_session), inscripcion=inscripcion
    )

    respuesta = cliente_admin.delete(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["activo"] is False

    db_session.expire_all()
    assert db_session.get(Alumno, alumno.id).activo is False
    assert db_session.get(Usuario, usuario.id).is_active is False
    assert db_session.get(Inscripcion, inscripcion.id) is not None
    assert db_session.get(Imputacion, imputacion.id) is not None

    listado = cliente_admin.get("/alumnos")
    assert alumno.id not in {fila["id"] for fila in listado.json()}

    login = cliente_admin.post(
        "/auth/login",
        json={"email": usuario.email, "password": PASSWORD_DE_PRUEBA},
    )
    assert login.status_code == 401, login.text


def test_baja_no_afecta_a_otros_alumnos(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    otro = crear_alumno(db_session, documento="30111222", email="otro@techacademy.invalid")

    cliente_admin.delete(f"/alumnos/{alumno.id}")

    listado = cliente_admin.get("/alumnos")
    assert {fila["id"] for fila in listado.json()} == {otro.id}
    assert db_session.get(Alumno, otro.id).activo is True


def test_baja_de_un_alumno_ya_dado_de_baja_da_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    cliente_admin.delete(f"/alumnos/{alumno.id}")

    respuesta = cliente_admin.delete(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 409, respuesta.text


def test_baja_de_un_alumno_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.delete("/alumnos/999999")

    assert respuesta.status_code == 404, respuesta.text


# ---------------------------------------------------------------- permisos


def test_solo_administracion_gestiona_alumnos(
    api_client: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    docente = crear_usuario_docente(db_session)
    assert docente.id is not None
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert api_client.put(f"/alumnos/{alumno.id}", json=EDICION).status_code == 403
    assert (
        api_client.post(
            f"/alumnos/{alumno.id}/password", json={"new_password": NUEVA_PASSWORD}
        ).status_code
        == 403
    )
    assert api_client.delete(f"/alumnos/{alumno.id}").status_code == 403

    api_client.headers.clear()
    assert api_client.delete(f"/alumnos/{alumno.id}").status_code == 401


def test_el_listado_no_incluye_alumnos_inactivos(
    cliente_admin: TestClient, db_session: Session
) -> None:
    activo = crear_alumno(db_session, documento="30111222", email="activo@techacademy.invalid")
    inactivo = crear_alumno(db_session, documento="30999888", email="inactivo@techacademy.invalid")
    inactivo.activo = False
    db_session.flush()

    ids = {fila["id"] for fila in cliente_admin.get("/alumnos").json()}

    assert ids == {activo.id}
    assert db_session.scalar(select(Alumno.id).where(Alumno.id == inactivo.id)) is not None


# ------------------------------------------------------------ reactivación


def test_reactivar_conserva_el_registro_y_renueva_el_acceso(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, usuario = _alumno_con_cuenta(db_session)
    comision = crear_comision(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    imputacion = crear_imputacion(
        db_session, cobranza=crear_cobranza(db_session), inscripcion=inscripcion
    )
    cliente_admin.delete(f"/alumnos/{alumno.id}")

    consulta = cliente_admin.get(
        "/alumnos/reactivable",
        params={"documento": "38.111.222", "email": alumno.email},
    )
    assert consulta.status_code == 200, consulta.text
    assert consulta.json()["id"] == alumno.id
    assert consulta.json()["activo"] is False

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/reactivar",
        json={
            "documento": "38.111.222",
            "nombre": alumno.nombre,
            "email": alumno.email,
            "telefono": alumno.telefono,
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == alumno.id
    assert cuerpo["activo"] is True
    assert cuerpo["password_inicial"] == "agustina38111222"

    db_session.expire_all()
    reactivado = db_session.get(Alumno, alumno.id)
    cuenta = db_session.get(Usuario, usuario.id)
    assert reactivado is not None
    assert reactivado.activo is True
    assert cuenta is not None
    assert cuenta.is_active is True
    assert cuenta.must_change_password is True
    assert db_session.get(Inscripcion, inscripcion.id) is not None
    assert db_session.get(Imputacion, imputacion.id) is not None

    with pytest.raises(CredencialesInvalidas):
        autenticar(db_session, cuenta.email, PASSWORD_DE_PRUEBA)
    assert autenticar(db_session, cuenta.email, cuerpo["password_inicial"]).id == usuario.id

    ids = {fila["id"] for fila in cliente_admin.get("/alumnos").json()}
    assert alumno.id in ids


def test_reactivar_toma_el_email_aunque_el_dni_sea_nuevo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    email = alumno.email
    cliente_admin.delete(f"/alumnos/{alumno.id}")

    consulta = cliente_admin.get(
        "/alumnos/reactivable",
        params={"documento": "30.000.111", "email": email},
    )
    assert consulta.status_code == 200, consulta.text
    assert consulta.json()["id"] == alumno.id

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/reactivar",
        json={
            "documento": "30.000.111",
            "nombre": "Agustina Reactivada",
            "email": email,
            "telefono": None,
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["id"] == alumno.id
    assert respuesta.json()["documento"] == "30.000.111"
    assert respuesta.json()["nombre"] == "Agustina Reactivada"


def test_no_ofrece_reactivacion_si_el_email_es_de_un_alumno_activo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    activo = crear_alumno(db_session, documento="30111222", email="activo@techacademy.invalid")
    cliente_admin.delete(f"/alumnos/{alumno.id}")

    consulta = cliente_admin.get(
        "/alumnos/reactivable",
        params={"documento": "38.111.222", "email": activo.email},
    )

    assert consulta.status_code == 200, consulta.text
    assert consulta.json() is None


def test_reactivar_con_un_email_activo_da_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    activo = crear_alumno(db_session, documento="30111222", email="activo@techacademy.invalid")
    cliente_admin.delete(f"/alumnos/{alumno.id}")

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/reactivar",
        json={
            "documento": "38.111.222",
            "nombre": alumno.nombre,
            "email": activo.email,
            "telefono": None,
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "email" in respuesta.json()["detail"]


def test_reactivar_un_alumno_activo_da_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)

    respuesta = cliente_admin.post(
        f"/alumnos/{alumno.id}/reactivar",
        json={
            "documento": alumno.documento,
            "nombre": alumno.nombre,
            "email": alumno.email,
            "telefono": None,
        },
    )

    assert respuesta.status_code == 409, respuesta.text


def test_solo_administracion_consulta_y_reactiva(
    api_client: TestClient, db_session: Session
) -> None:
    alumno, _ = _alumno_con_cuenta(db_session)
    cliente = api_client
    docente = crear_usuario_docente(db_session)
    cliente.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert (
        cliente.get(
            "/alumnos/reactivable",
            params={"documento": "38.111.222", "email": alumno.email},
        ).status_code
        == 403
    )
    assert (
        cliente.post(
            f"/alumnos/{alumno.id}/reactivar",
            json={
                "documento": "38.111.222",
                "nombre": alumno.nombre,
                "email": alumno.email,
                "telefono": None,
            },
        ).status_code
        == 403
    )

    cliente.headers.clear()
    assert (
        cliente.get(
            "/alumnos/reactivable",
            params={"documento": "38.111.222", "email": alumno.email},
        ).status_code
        == 401
    )


def test_reactivar_un_alumno_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post(
        "/alumnos/999999/reactivar",
        json={
            "documento": "38.111.222",
            "nombre": "Nadie",
            "email": "nadie@techacademy.invalid",
            "telefono": None,
        },
    )

    assert respuesta.status_code == 404, respuesta.text

