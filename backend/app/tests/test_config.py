"""3.3 — Configuración con `pydantic-settings` leída del entorno."""

from __future__ import annotations

import pytest

from app.core.config import DEFAULT_TIMEZONE, Settings


def test_la_zona_horaria_por_defecto_es_la_del_dominio(monkeypatch: pytest.MonkeyPatch) -> None:
    """La zona horaria no se deduce del host: la fija la spec del dominio."""
    monkeypatch.delenv("TIMEZONE", raising=False)
    assert Settings(jwt_secret_key="x").timezone == "America/Argentina/Buenos_Aires"
    assert DEFAULT_TIMEZONE == "America/Argentina/Buenos_Aires"


def test_una_variable_de_entorno_se_refleja_en_la_configuracion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cambia la variable, construye la configuración de nuevo, y lee el valor nuevo."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://otro:otro@otro:5432/otra")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

    settings = Settings(jwt_secret_key="x")

    assert settings.database_url == "postgresql+psycopg://otro:otro@otro:5432/otra"
    assert settings.log_level == "DEBUG"
    assert settings.access_token_expire_minutes == 60


def test_el_nombre_de_la_variable_de_entorno_es_el_del_env_example(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`pydantic-settings` mapea por atributo en minúsculas; se comprueba con una de las
    variables menos obvias del `.env.example`."""
    monkeypatch.setenv("EMAIL_FROM_NAME", "Secretaria BA")
    assert Settings(jwt_secret_key="x").email_from_name == "Secretaria BA"


def test_cors_origins_se_lee_como_lista_desde_una_cadena(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """En el `.env.example` `CORS_ORIGINS` es texto, no JSON."""
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173")
    assert Settings(jwt_secret_key="x").cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_booleanos_se_leen_desde_el_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMTP_STARTTLS", "false")
    assert Settings(jwt_secret_key="x").smtp_starttls is False


def test_el_secreto_de_firma_es_obligatorio(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sin `JWT_SECRET_KEY` la aplicación no arranca: un secreto hardcodeado es peor que
    un fallo de arranque."""
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(Exception, match="jwt_secret_key|JWT_SECRET_KEY"):
        Settings()  # type: ignore[call-arg]
