"""5.4 — La dependencia de autorización por rol, aplicada a las rutas de cada rol.

Las cuatro situaciones de la spec: rol admitido, rol no admitido, sin autenticar, y la
garantía de que el 401 no revela si el recurso existe.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated

import pytest
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import MENSAJE_SIN_PERMISOS, MENSAJE_TOKEN_INVALIDO, require_roles
from app.main import app
from app.models.enums import Rol
from app.models.padron import Usuario
from app.tests.factories import (
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

#: Las cuatro rutas protegidas que expone `app/api/authorization_probe.py`.
RUTAS_PROTEGIDAS = [
    "/auth/probe/admin",
    "/auth/probe/docente",
    "/auth/probe/alumno",
    "/auth/probe/personal",
]


@pytest.fixture
def cuentas(db_session: Session) -> dict[str, Usuario]:
    return {
        "ADMIN": crear_usuario_admin(db_session),
        "DOCENTE": crear_usuario_docente(db_session),
        "ALUMNO": crear_usuario_alumno(db_session),
    }


@pytest.mark.parametrize(
    ("ruta", "rol_admitido"),
    [
        ("/auth/probe/admin", "ADMIN"),
        ("/auth/probe/docente", "DOCENTE"),
        ("/auth/probe/alumno", "ALUMNO"),
    ],
)
def test_cada_rol_accede_a_su_ruta(api_client, cuentas, ruta: str, rol_admitido: str) -> None:
    """Spec, "Rol admitido"."""
    usuario = cuentas[rol_admitido]
    headers = encabezado_de_autorizacion(token_de_prueba(usuario))

    respuesta = api_client.get(ruta, headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["acceso_concedido"] is True
    assert cuerpo["rol_de_la_ruta"] == rol_admitido
    assert cuerpo["rol_del_usuario"] == rol_admitido
    assert cuerpo["usuario_id"] == usuario.id


@pytest.mark.parametrize(
    ("ruta", "rol"),
    [
        ("/auth/probe/admin", "DOCENTE"),
        ("/auth/probe/admin", "ALUMNO"),
        ("/auth/probe/docente", "ADMIN"),
        ("/auth/probe/docente", "ALUMNO"),
        ("/auth/probe/alumno", "ADMIN"),
        ("/auth/probe/alumno", "DOCENTE"),
    ],
)
def test_un_rol_no_admitido_recibe_403(api_client, cuentas, ruta: str, rol: str) -> None:
    """Spec, "Rol no admitido": 403 sin procesar la operación."""
    headers = encabezado_de_autorizacion(token_de_prueba(cuentas[rol]))

    respuesta = api_client.get(ruta, headers=headers)

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == MENSAJE_SIN_PERMISOS
    assert respuesta.json().get("usuario_id") is None


def test_una_ruta_puede_admitir_varios_roles(api_client, cuentas) -> None:
    """La dependencia es parametrizable: la ruta declara a quién deja pasar."""
    def _intentar(rol: str):
        headers = encabezado_de_autorizacion(token_de_prueba(cuentas[rol]))
        return api_client.get("/auth/probe/personal", headers=headers).status_code

    assert _intentar("DOCENTE") == 200
    assert _intentar("ADMIN") == 200
    assert _intentar("ALUMNO") == 403


def test_el_403_dice_que_roles_admite_la_ruta(api_client, cuentas) -> None:
    """Solo lo ve alguien que ya se autenticó, así que nombrarlo ayuda y no filtra."""
    headers = encabezado_de_autorizacion(token_de_prueba(cuentas["ALUMNO"]))

    respuesta = api_client.get("/auth/probe/admin", headers=headers)

    assert respuesta.headers["X-Roles-Admitidos"] == "ADMIN"


@pytest.mark.parametrize("ruta", RUTAS_PROTEGIDAS)
def test_sin_token_responde_401(api_client, ruta: str) -> None:
    """Spec, "Sin autenticar": 401 en toda ruta protegida."""
    respuesta = api_client.get(ruta)

    assert respuesta.status_code == 401
    assert respuesta.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("ruta", RUTAS_PROTEGIDAS)
def test_el_401_es_identico_en_todas_las_rutas(api_client, ruta: str) -> None:
    """Spec, "Sin autenticar": la respuesta **nunca** revela si el recurso existe.

    Si el mensaje dependiera de la ruta —"falta permiso de ADMIN", la longitud del camino,
    el nombre de la ruta—, un 401 confirmaría qué rutas existen y qué roles las atraviesan.
    Por eso se comparan las cuatro entre sí, no contra una constante.
    """
    primera = api_client.get("/auth/probe/admin")
    otra = api_client.get(ruta)

    assert otra.status_code == primera.status_code == 401
    assert otra.json() == primera.json()
    assert otra.text == primera.text
    assert otra.json()["detail"] == MENSAJE_TOKEN_INVALIDO


@pytest.mark.parametrize("ruta", RUTAS_PROTEGIDAS)
def test_el_401_no_nombra_la_ruta_ni_los_roles(api_client, ruta: str) -> None:
    respuesta = api_client.get(ruta)
    cuerpo = respuesta.text

    assert ruta not in cuerpo
    for rol in ("ADMIN", "DOCENTE", "ALUMNO"):
        assert rol not in cuerpo


def test_sin_token_tampoco_distingue_de_un_token_invalido(api_client, cuentas) -> None:
    """Un token manipulado, uno vencido y la ausencia de token son la misma respuesta."""
    admin = cuentas["ADMIN"]
    manipulado = encabezado_de_autorizacion(token_de_prueba(admin) + "x")
    vencido = encabezado_de_autorizacion(
        token_de_prueba(admin, vigencia=timedelta(minutes=-1))
    )

    sin_token = api_client.get("/auth/probe/admin")
    invalido = api_client.get("/auth/probe/admin", headers=manipulado)
    expirado = api_client.get("/auth/probe/admin", headers=vencido)

    assert sin_token.json() == invalido.json() == expirado.json()


def _montar_rutas_de_prueba() -> list:
    """Agrega rutas que declaran la dependencia a mano y devuelve los objetos para poder
    desmontarlas.

    Es la prueba de que `require_roles` es reutilizable y no un caso particular de las
    cuatro rutas de `authorization_probe.py`: si el comportamiento dependiera del módulo
    donde está definida, estas rutas fallarían.
    """
    router = APIRouter()

    @router.get("/prueba/declarada")
    def declarada(
        usuario: Annotated[Usuario, Depends(require_roles(Rol.ALUMNO))],
    ) -> dict[str, int]:
        return {"usuario_id": usuario.id}

    @router.get("/prueba/con_texto")
    def con_texto(
        usuario: Annotated[Usuario, Depends(require_roles("ALUMNO"))],
    ) -> dict[str, int]:
        return {"usuario_id": usuario.id}

    app.include_router(router)
    return router.routes


def test_la_dependencia_es_reutilizable_por_cualquier_endpoint(api_client, cuentas) -> None:
    rutas = _montar_rutas_de_prueba()
    try:
        alumno = encabezado_de_autorizacion(token_de_prueba(cuentas["ALUMNO"]))
        docente = encabezado_de_autorizacion(token_de_prueba(cuentas["DOCENTE"]))

        permitido = api_client.get("/prueba/declarada", headers=alumno)
        prohibido = api_client.get("/prueba/declarada", headers=docente)
        sin_token = api_client.get("/prueba/declarada")
    finally:
        app.router.routes = [ruta for ruta in app.router.routes if ruta not in rutas]

    assert permitido.status_code == 200
    assert permitido.json() == {"usuario_id": cuentas["ALUMNO"].id}
    assert prohibido.status_code == 403
    assert sin_token.status_code == 401


def test_require_roles_acepta_enum_y_texto(api_client, cuentas) -> None:
    """Que el rol se pueda pasar como `Rol.ADMIN` o como `"ADMIN"` evita el error de
    tipografía que volvería una ruta inaccesible sin que nadie se entere."""
    rutas = _montar_rutas_de_prueba()
    try:
        alumno = encabezado_de_autorizacion(token_de_prueba(cuentas["ALUMNO"]))
        docente = encabezado_de_autorizacion(token_de_prueba(cuentas["DOCENTE"]))
        codigos = {
            ruta: [
                api_client.get(ruta, headers=alumno).status_code,
                api_client.get(ruta, headers=docente).status_code,
                api_client.get(ruta).status_code,
            ]
            for ruta in ("/prueba/declarada", "/prueba/con_texto")
        }
    finally:
        app.router.routes = [ruta for ruta in app.router.routes if ruta not in rutas]

    assert codigos["/prueba/declarada"] == codigos["/prueba/con_texto"] == [200, 403, 401]


def test_require_roles_sin_roles_es_un_error_de_programacion() -> None:
    """Una dependencia que no admite a nadie no es una política, es un error."""
    with pytest.raises(ValueError, match="require_roles"):
        require_roles()


def test_el_control_de_acceso_no_depende_del_frontend(api_client, cuentas) -> None:
    """La UI oculta rutas, pero la API es la que las protege: ocultar un ítem de menú no es
    autorización."""
    headers = encabezado_de_autorizacion(token_de_prueba(cuentas["ADMIN"]))

    assert api_client.get("/auth/probe/admin").status_code == 401
    assert api_client.get("/auth/probe/admin", headers=headers).status_code == 200
