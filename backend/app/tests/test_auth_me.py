"""5.3 — `GET /auth/me`: identidad de quien llama, y 401 en los tres casos."""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy.orm import Session

from app.api.deps import MENSAJE_TOKEN_INVALIDO
from app.models.padron import Usuario
from app.tests.factories import (
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)


def test_token_valido_devuelve_la_identidad(api_client, db_session: Session) -> None:
    """Spec, "Token válido": 200 con identificador, correo, rol, nombre para mostrar y
    `must_change_password`."""
    docente = crear_usuario_docente(db_session)

    respuesta = api_client.get(
        "/auth/me",
        headers=encabezado_de_autorizacion(token_de_prueba(docente)),
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "id": docente.id,
        "email": docente.email,
        "rol": "DOCENTE",
        "nombre": f"{docente.docente.nombre} {docente.docente.apellido}",
        "must_change_password": True,
    }


def test_se_expone_el_cambio_de_password_pendiente(api_client, db_session: Session) -> None:
    """El indicador se persiste y se expone. Este change no lo cambia: lo advierte."""
    pendiente = crear_usuario_docente(db_session, must_change_password=True)
    al_dia = crear_usuario_admin(db_session)

    con_cambio = api_client.get(
        "/auth/me",
        headers=encabezado_de_autorizacion(token_de_prueba(pendiente)),
    )
    sin_cambio = api_client.get(
        "/auth/me",
        headers=encabezado_de_autorizacion(token_de_prueba(al_dia)),
    )

    assert con_cambio.json()["must_change_password"] is True
    assert sin_cambio.json()["must_change_password"] is False


def test_el_nombre_para_mostrar_viene_de_la_base_y_no_del_token(
    api_client, db_session: Session
) -> None:
    """Si el nombre cambia, el token viejo tiene que devolver el nombre nuevo: el token
    afirma quién es, la base dice cómo está la cuenta."""
    admin = crear_usuario_admin(db_session)
    token = token_de_prueba(admin)

    admin.nombre = "Secretaría BA (turno mañana)"
    db_session.flush()

    respuesta = api_client.get("/auth/me", headers=encabezado_de_autorizacion(token))

    assert respuesta.json()["nombre"] == "Secretaría BA (turno mañana)"


@pytest.mark.parametrize(
    "encabezados",
    [
        {},
        {"Authorization": ""},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic YWRtaW46YWRtaW4="},
        {"Authorization": "Bearer no-es-un-jwt"},
        {"Authorization": "Bearer a.b.c"},
    ],
    ids=["ausente", "vacio", "sin_token", "otro_esquema", "basura", "basura_estructurada"],
)
def test_sin_token_valido_responde_401(api_client, encabezados: dict[str, str]) -> None:
    """Spec, "Token ausente o inválido": 401 y ningún dato de la cuenta."""
    respuesta = api_client.get("/auth/me", headers=encabezados)

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == MENSAJE_TOKEN_INVALIDO


def test_token_vencido_responde_401(api_client, db_session: Session) -> None:
    admin = crear_usuario_admin(db_session)
    vencido = token_de_prueba(admin, vigencia=timedelta(minutes=-1))

    respuesta = api_client.get("/auth/me", headers=encabezado_de_autorizacion(vencido))

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == MENSAJE_TOKEN_INVALIDO


def test_token_manipulado_responde_401(api_client, db_session: Session) -> None:
    admin = crear_usuario_admin(db_session)
    token = token_de_prueba(admin)
    cab, cuerpo, firma = token.split(".")
    manipulado = f"{cab}.{cuerpo}.{firma[:-1]}{'A' if firma[-1] != 'A' else 'B'}"

    respuesta = api_client.get("/auth/me", headers=encabezado_de_autorizacion(manipulado))

    assert respuesta.status_code == 401


def test_el_401_no_expone_ningun_dato_de_la_cuenta(api_client, db_session: Session) -> None:
    admin = crear_usuario_admin(db_session)

    respuesta = api_client.get("/auth/me")

    cuerpo = respuesta.text
    assert respuesta.status_code == 401
    assert admin.email not in cuerpo
    assert admin.nombre not in cuerpo
    assert admin.password_hash not in cuerpo


def test_una_cuenta_dada_de_baja_deja_de_aceptar_su_token(api_client, db_session: Session) -> None:
    """El token es válido criptográficamente, pero la base manda sobre la cuenta. Por eso
    `get_current_user` la consulta en cada request en lugar de confiar en el claim."""
    admin = crear_usuario_admin(db_session)
    token = token_de_prueba(admin)

    assert api_client.get("/auth/me", headers=encabezado_de_autorizacion(token)).status_code == 200

    admin.is_active = False
    db_session.flush()

    respuesta = api_client.get("/auth/me", headers=encabezado_de_autorizacion(token))
    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == MENSAJE_TOKEN_INVALIDO


def test_un_token_de_una_cuenta_borrada_responde_401(api_client, db_session: Session) -> None:
    admin = crear_usuario_admin(db_session)
    token = token_de_prueba(admin)
    db_session.delete(admin)
    db_session.flush()

    respuesta = api_client.get("/auth/me", headers=encabezado_de_autorizacion(token))

    assert respuesta.status_code == 401


def test_el_token_declara_un_rol_pero_manda_el_de_la_base(api_client, db_session: Session) -> None:
    """Se falsifica el claim `rol` del token. La autorización no puede cambiar de opinión:
    `get_current_user` devuelve el rol de la fila."""
    from app.core.security import crear_token_acceso

    alumno: Usuario = crear_usuario_alumno(db_session)
    token = crear_token_acceso(
        usuario_id=alumno.id,
        rol="ADMIN",
        email=alumno.email,
    )

    sesion = api_client.get("/auth/me", headers=encabezado_de_autorizacion(token))
    admin = api_client.get("/auth/probe/admin", headers=encabezado_de_autorizacion(token))

    assert sesion.json()["rol"] == "ALUMNO"
    assert admin.status_code == 403
