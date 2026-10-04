"""3.4 — `GET /health` sin autenticación y sin datos sensibles."""

from __future__ import annotations

import json

from app.core.config import get_settings


def test_health_responde_exito_sin_token(client) -> None:
    respuesta = client.get("/health")
    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "ok"


def test_health_no_requiere_autenticacion(client) -> None:
    """Sin token, sin cookie y sin encabezado de autorización."""
    respuesta = client.get("/health", headers={"Authorization": ""})
    assert respuesta.status_code == 200


def test_health_no_expone_datos_sensibles(client) -> None:
    """La respuesta es pública y la consulta el healthcheck del contenedor en cada tick,
    así que su cuerpo es lo primero que ve cualquiera que alcance el puerto."""
    cuerpo = client.get("/health").text
    assert len(cuerpo) < 200, f"la respuesta de salud es más grande de lo necesario: {cuerpo}"

    datos = json.loads(cuerpo)
    assert set(datos) == {"status", "service"}

    settings = get_settings()
    for secreto in (
        settings.jwt_secret_key,
        settings.database_url,
        settings.smtp_password,
        settings.smtp_user,
        "postgres",
        "password",
        "secret",
    ):
        if not secreto:
            continue
        assert secreto not in cuerpo, f"la respuesta de salud expone {secreto!r}"


def test_health_es_sensible_a_mayusculas_minusculas(client) -> None:
    """FastAPI enruta por mayúsculas, así que la ruta real es `/health`. El healthcheck
    del compose consulta exactamente esa."""
    assert client.get("/HEALTH").status_code == 404
    assert client.get("/health").status_code == 200


def test_health_responde_exito_tambien_con_el_prefijo_api(client) -> None:
    """Vercel sirve el backend bajo `/api` y le entrega el path completo (D14). Por eso la
    aplicación se declara con `root_path="/api"`: sin eso, `/api/health` no matchea nada.

    Las dos rutas tienen que responder lo mismo, porque el healthcheck del compose consulta
    `/health` sin prefijo y el navegador consulta `/api/health`.
    """
    con_prefijo = client.get("/api/health")
    sin_prefijo = client.get("/health")

    assert con_prefijo.status_code == 200, "/api/health tiene que matchear la ruta del router"
    assert sin_prefijo.status_code == 200, "el prefijo no puede romper la ruta sin prefijo"
    assert con_prefijo.json() == sin_prefijo.json()
