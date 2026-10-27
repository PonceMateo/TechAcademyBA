"""Edición de un docente y restablecimiento de su contraseña (HU #11).

Corre contra PostgreSQL real (D15). Lo que se afirma:

- la edición conserva el `id`, las comisiones y el historial, y sincroniza nombre y email de la
  cuenta de acceso en la misma transacción;
- el DNI se compara solo dentro del padrón de docentes y el email contra los tres padrones,
  excluyendo al propio docente y a su cuenta;
- el CUIL es opcional: omitirlo conserva el actual, `null` lo borra, un valor nuevo lo reemplaza
  y uno inválido responde `422` sin tocar el anterior (D57);
- el restablecimiento guarda solo el hash, invalida la contraseña anterior y deja la cuenta con
  cambio obligatorio;
- un docente sin cuenta se edita igual y el restablecimiento responde `409`;
- las dos rutas son solo de Administración.
"""

from __future__ import annotations

import itertools
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verificar_password
from app.models.catalogo import Comision
from app.models.padron import Docente, Usuario
from app.schemas.padron import DocenteUpdate
from app.services import auth, padron
from app.services.emails import EmailAlreadyRegistered
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

#: Secuencia de DNI y correos: las fábricas tienen valores por defecto, así que un test que crea
#: más de un docente o un alumno necesita distinguirlos.
_SECUENCIA = itertools.count(1)

PASSWORD_NUEVA = "Docente2026!"


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _docente(session: Session, **cambios: object) -> Docente:
    numero = next(_SECUENCIA)
    datos = {
        "dni": f"31{numero:06d}",
        "email": f"docente{numero}@techacademy.invalid",
    }
    datos.update(cambios)
    return crear_docente(session, **datos)


def _docente_con_cuenta(session: Session, **cambios: object) -> tuple[Docente, Usuario]:
    """Docente con su cuenta de acceso, con el mismo email en las dos filas como en el alta."""
    docente = _docente(session, **cambios)
    usuario = crear_usuario_docente(session, docente=docente, email=docente.email)
    return docente, usuario


def _datos(docente: Docente, **cambios: object) -> dict:
    datos = {
        "nombre": docente.nombre,
        "apellido": docente.apellido,
        "dni": docente.dni,
        "email": docente.email,
        # E.164 y no el teléfono de la fábrica, que es legacy a propósito (D57).
        "telefono": "+5491140000001",
    }
    datos.update(cambios)
    return datos


# ------------------------------------------------------------------- servicio


def test_editar_docente_actualiza_los_datos_y_conserva_las_comisiones(
    db_session: Session,
) -> None:
    """HU #11: corregir un dato no reasigna las comisiones ni pierde el historial."""
    docente, usuario = _docente_con_cuenta(db_session)
    comision = crear_comision(db_session)
    comision.docente_id = docente.id
    db_session.flush()
    id_original = docente.id

    actualizado = padron.editar_docente(
        db_session,
        docente,
        DocenteUpdate(
            nombre="Rita",
            apellido="Molina Gómez",
            dni="31.111.222",
            email="rita.gomez@techacademy.invalid",
            telefono="+5491155550000",
        ),
    )

    assert actualizado.id == id_original
    assert actualizado.apellido == "Molina Gómez"
    assert actualizado.dni == "31.111.222"
    assert actualizado.dni_norm == "31111222"
    assert actualizado.email == "rita.gomez@techacademy.invalid"
    assert actualizado.telefono == "+5491155550000"
    assert db_session.get(Comision, comision.id).docente_id == docente.id
    db_session.refresh(usuario)
    assert usuario.nombre == "Rita Molina Gómez"
    assert usuario.email == "rita.gomez@techacademy.invalid"


def test_editar_docente_con_los_mismos_datos_es_aceptado(db_session: Session) -> None:
    """La comparación excluye al propio docente y a su propia cuenta."""
    docente, _ = _docente_con_cuenta(db_session)

    actualizado = padron.editar_docente(
        db_session, docente, DocenteUpdate(**_datos(docente))
    )

    assert actualizado.email == docente.email


def test_dni_de_otro_docente_es_rechazado(db_session: Session) -> None:
    otro = _docente(db_session)
    docente, _ = _docente_con_cuenta(db_session)

    with pytest.raises(padron.DocenteDuplicado) as error:
        padron.editar_docente(
            db_session, docente, DocenteUpdate(**_datos(docente, dni=otro.dni))
        )

    assert error.value.campo == "DNI"
    assert "DNI" in str(error.value)


def test_email_de_otro_docente_es_rechazado(db_session: Session) -> None:
    otro = _docente(db_session)
    docente, _ = _docente_con_cuenta(db_session)

    with pytest.raises(EmailAlreadyRegistered) as error:
        padron.editar_docente(
            db_session, docente, DocenteUpdate(**_datos(docente, email=otro.email))
        )

    assert error.value.padrón == "docentes"


def test_email_de_un_alumno_nombra_el_padron(db_session: Session) -> None:
    alumno = crear_alumno(db_session, email="alumna@techacademy.invalid")
    docente, _ = _docente_con_cuenta(db_session)

    with pytest.raises(EmailAlreadyRegistered) as error:
        padron.editar_docente(
            db_session, docente, DocenteUpdate(**_datos(docente, email=alumno.email))
        )

    assert "alumnos" in str(error.value)


def test_editar_un_docente_sin_cuenta_no_crea_una(db_session: Session) -> None:
    """Solo hay docentes sin `Usuario` por datos históricos; la edición no inventa la cuenta."""
    docente = _docente(db_session)

    actualizado = padron.editar_docente(
        db_session, docente, DocenteUpdate(**_datos(docente, telefono="+5491144441111"))
    )

    assert actualizado.telefono == "+5491144441111"
    assert db_session.scalar(select(Usuario).where(Usuario.docente_id == docente.id)) is None


def test_restablecer_password_guarda_el_hash_y_exige_el_cambio(db_session: Session) -> None:
    docente, usuario = _docente_con_cuenta(db_session)
    hash_anterior = usuario.password_hash

    actualizado = padron.restablecer_password(db_session, docente, PASSWORD_NUEVA)

    db_session.refresh(usuario)
    assert actualizado.id == docente.id
    assert usuario.password_hash != hash_anterior
    assert PASSWORD_NUEVA not in usuario.password_hash
    assert verificar_password(PASSWORD_NUEVA, usuario.password_hash)
    assert not verificar_password(PASSWORD_DE_PRUEBA, usuario.password_hash)
    assert usuario.must_change_password is True


def test_restablecer_password_de_un_docente_sin_cuenta(db_session: Session) -> None:
    docente = _docente(db_session)

    with pytest.raises(padron.DocenteSinCuenta):
        padron.restablecer_password(db_session, docente, PASSWORD_NUEVA)


@pytest.mark.parametrize("nueva", ["corta", "1234567"])
def test_restablecer_password_corta_es_rechazada(db_session: Session, nueva: str) -> None:
    docente, usuario = _docente_con_cuenta(db_session)
    hash_anterior = usuario.password_hash

    with pytest.raises(auth.PasswordInvalida):
        padron.restablecer_password(db_session, docente, nueva)

    db_session.refresh(usuario)
    assert usuario.password_hash == hash_anterior


def test_obtener_un_docente_inexistente(db_session: Session) -> None:
    with pytest.raises(padron.DocenteNoEncontrado):
        padron.obtener_docente(db_session, 999999)


# ----------------------------------------------------------------------- API


def test_edicion_exitosa_devuelve_el_docente_con_sus_comisiones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente, usuario = _docente_con_cuenta(db_session)
    comision = crear_comision(db_session)
    comision.docente_id = docente.id
    db_session.flush()

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": docente.dni,
            "email": usuario.email,
            "telefono": "+5491143210000",
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == docente.id
    assert cuerpo["telefono"] == "+5491143210000"
    assert cuerpo["cantidad_comisiones"] == 1
    assert cuerpo["comisiones"][0]["codigo"] == comision.codigo


def test_el_email_nuevo_sirve_para_entrar(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """La cuenta queda sincronizada: el login usa el correo nuevo, no el viejo."""
    docente, usuario = _docente_con_cuenta(db_session)
    email_viejo = docente.email
    email_nuevo = "docente.renombrado@techacademy.invalid"

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json={
            "nombre": docente.nombre,
            "apellido": docente.apellido,
            "dni": docente.dni,
            "email": email_nuevo,
            "telefono": None,
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    assert auth.autenticar(db_session, email_nuevo, PASSWORD_DE_PRUEBA).id == usuario.id
    with pytest.raises(auth.CredencialesInvalidas):
        auth.autenticar(db_session, email_viejo, PASSWORD_DE_PRUEBA)


def _cuerpo_edicion(docente: Docente, usuario: Usuario, **cambios: object) -> dict:
    cuerpo = {
        "nombre": docente.nombre,
        "apellido": docente.apellido,
        "dni": docente.dni,
        "email": usuario.email,
    }
    cuerpo.update(cambios)
    return cuerpo


def test_la_edicion_guarda_un_cuil_valido_en_11_digitos(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D57: el CUIL forma parte del contrato de la edición y se devuelve sin guiones."""
    docente, usuario = _docente_con_cuenta(db_session, dni="30111222")

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json=_cuerpo_edicion(docente, usuario, cuil="27-30111222-5"),
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["cuil"] == "27301112225"
    db_session.expire_all()
    assert db_session.get(Docente, docente.id).cuil == "27301112225"


def test_la_edicion_sin_cuil_conserva_el_actual(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D57: omitir `cuil` en el `PUT` no borra el que el docente ya tenía."""
    docente, usuario = _docente_con_cuenta(db_session, dni="30111222", cuil="27301112225")

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}", json=_cuerpo_edicion(docente, usuario, nombre="Rita")
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["cuil"] == "27301112225"
    db_session.expire_all()
    assert db_session.get(Docente, docente.id).cuil == "27301112225"


def test_la_edicion_con_cuil_en_null_lo_borra(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D57: `null` explícito es la única forma de vaciar el CUIL desde la edición."""
    docente, usuario = _docente_con_cuenta(db_session, dni="30111222", cuil="27301112225")

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}", json=_cuerpo_edicion(docente, usuario, cuil=None)
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["cuil"] is None
    db_session.expire_all()
    assert db_session.get(Docente, docente.id).cuil is None


def test_la_edicion_reemplaza_el_cuil_anterior(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente, usuario = _docente_con_cuenta(db_session, dni="30111222", cuil="27301112225")

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json=_cuerpo_edicion(docente, usuario, cuil="20301112229"),
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["cuil"] == "20301112229"


@pytest.mark.parametrize("cuil", ["2730111222", "30301112225", "27999888776"])
def test_un_cuil_invalido_en_la_edicion_da_422_y_no_cambia_el_anterior(
    cliente_admin: TestClient, db_session: Session, cuil: str
) -> None:
    """D57: la edición rechaza lo mismo que el alta y el CUIL guardado queda intacto."""
    docente, usuario = _docente_con_cuenta(db_session, dni="30111222", cuil="27301112225")

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}", json=_cuerpo_edicion(docente, usuario, cuil=cuil)
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.expire_all()
    assert db_session.get(Docente, docente.id).cuil == "27301112225"


def test_dni_duplicado_da_409_y_dice_cual(
    cliente_admin: TestClient, db_session: Session
) -> None:
    otro = _docente(db_session)
    docente, usuario = _docente_con_cuenta(db_session)

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json={
            "nombre": docente.nombre,
            "apellido": docente.apellido,
            "dni": otro.dni,
            "email": usuario.email,
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "DNI" in respuesta.json()["detail"]


def test_email_de_otro_padron_da_409_y_lo_nombra(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session, email="alumna@techacademy.invalid")
    docente, _ = _docente_con_cuenta(db_session)

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json={
            "nombre": docente.nombre,
            "apellido": docente.apellido,
            "dni": docente.dni,
            "email": alumno.email,
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "alumnos" in respuesta.json()["detail"]


def test_docente_inexistente_da_404(cliente_admin: TestClient, db_session: Session) -> None:
    docente = _docente(db_session)

    respuesta = cliente_admin.put("/docentes/999999", json=_datos(docente))

    assert respuesta.status_code == 404, respuesta.text


def test_restablecer_password_permite_entrar_y_obliga_el_cambio(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente, usuario = _docente_con_cuenta(db_session)

    respuesta = cliente_admin.post(
        f"/docentes/{docente.id}/password", json={"new_password": PASSWORD_NUEVA}
    )

    assert respuesta.status_code == 200, respuesta.text
    assert "new_password" not in respuesta.json()
    assert PASSWORD_NUEVA not in respuesta.text

    db_session.refresh(usuario)
    assert usuario.must_change_password is True
    assert auth.autenticar(db_session, usuario.email, PASSWORD_NUEVA).id == usuario.id
    with pytest.raises(auth.CredencialesInvalidas):
        auth.autenticar(db_session, usuario.email, PASSWORD_DE_PRUEBA)


def test_restablecer_password_corta_da_422_y_no_cambia_nada(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente, usuario = _docente_con_cuenta(db_session)
    hash_anterior = usuario.password_hash

    respuesta = cliente_admin.post(
        f"/docentes/{docente.id}/password", json={"new_password": "corta"}
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.refresh(usuario)
    assert usuario.password_hash == hash_anterior


def test_restablecer_password_sin_cuenta_da_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    docente = _docente(db_session)

    respuesta = cliente_admin.post(
        f"/docentes/{docente.id}/password", json={"new_password": PASSWORD_NUEVA}
    )

    assert respuesta.status_code == 409, respuesta.text
    assert db_session.scalar(select(Usuario).where(Usuario.docente_id == docente.id)) is None


def test_restablecer_password_de_un_docente_inexistente_da_404(
    cliente_admin: TestClient,
) -> None:
    respuesta = cliente_admin.post(
        "/docentes/999999/password", json={"new_password": PASSWORD_NUEVA}
    )

    assert respuesta.status_code == 404, respuesta.text


def test_las_dos_rutas_sin_token_son_401(api_client: TestClient, db_session: Session) -> None:
    docente, _ = _docente_con_cuenta(db_session)

    assert api_client.put(f"/docentes/{docente.id}", json=_datos(docente)).status_code == 401
    assert (
        api_client.post(
            f"/docentes/{docente.id}/password", json={"new_password": PASSWORD_NUEVA}
        ).status_code
        == 401
    )


@pytest.mark.parametrize("rol", ["docente", "alumno"])
def test_las_dos_rutas_exigen_rol_de_administracion(
    api_client: TestClient, db_session: Session, rol: str
) -> None:
    docente, usuario = _docente_con_cuenta(db_session)
    cuenta = (
        crear_usuario_docente(db_session)
        if rol == "docente"
        else crear_usuario_alumno(db_session)
    )
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))
    nombre_original = docente.nombre

    edicion = api_client.put(
        f"/docentes/{docente.id}", json=_datos(docente, nombre="Nombre Ajeno")
    )
    password = api_client.post(
        f"/docentes/{docente.id}/password", json={"new_password": PASSWORD_NUEVA}
    )

    assert edicion.status_code == 403
    assert edicion.headers["X-Roles-Admitidos"] == "ADMIN"
    assert password.status_code == 403
    db_session.expire_all()
    assert db_session.get(Docente, docente.id).nombre == nombre_original
    db_session.refresh(usuario)
    assert usuario.must_change_password is False


def test_la_edicion_no_toca_las_comisiones_ni_las_inscripciones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """El historial queda asociado al mismo `docente_id`, que es lo que pide la historia."""
    docente, usuario = _docente_con_cuenta(db_session)
    comision = crear_comision(db_session, arancel=Decimal("52000.00"))
    comision.docente_id = docente.id
    db_session.flush()
    id_comision = comision.id

    respuesta = cliente_admin.put(
        f"/docentes/{docente.id}",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": docente.dni,
            "email": usuario.email,
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    db_session.expire_all()
    guardada = db_session.get(Comision, id_comision)
    assert guardada.docente_id == docente.id
    assert guardada.arancel == Decimal("52000.00")
