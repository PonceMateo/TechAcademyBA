"""Configuración de la aplicación leída del entorno (3.3).

Todos los valores salen de variables de entorno documentadas en `.env.example`.
`pydantic-settings` las lee por nombre de atributo en minúsculas, así que
`JWT_SECRET_KEY` alimenta `jwt_secret_key` sin necesidad de un alias explícito.

La zona horaria tiene un valor por defecto porque el dominio la exige en todas las
fechas y horas (spec `domain-schema`, "Convenciones transversales del esquema").
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

#: Zona horaria del dominio. No es negociable: la spec la fija para todo el esquema.
DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires"


class Settings(BaseSettings):
    """Configuración de la aplicación.

    `extra="ignore"` evita que una variable de entorno inesperada rompa el arranque:
    el contenedor de la base y el del frontend comparten proceso de configuración con
    este.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Aplicación ---------------------------------------------------------
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    timezone: str = DEFAULT_TIMEZONE

    # --- Base de datos ------------------------------------------------------
    database_url: str = Field(
        default="postgresql+psycopg://techacademy:techacademy@db:5432/techacademy",
        description="URL SQLAlchemy de la base de datos.",
    )

    # --- Autenticación ------------------------------------------------------
    # D2: JWT stateless. El secreto nunca tiene valor por defecto utilizable: si
    # falta, la aplicación no arranca, porque un secreto hardcodeado es peor que
    # un fallo de arranque.
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # --- API ----------------------------------------------------------------
    # `NoDecode` desactiva el parseo JSON que pydantic-settings le hace a los campos
    # complejos: `CORS_ORIGINS=http://localhost:5173` no es JSON, es texto. El
    # validador de abajo lo convierte.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    # --- Correo (D17) -------------------------------------------------------
    # El único backend disponible registra el envío en el log. El proveedor real se
    # elige en el change siguiente; la interfaz no cambia.
    email_backend: str = "log"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    email_from: str = "no-reply@techacademy.invalid"
    email_from_name: str = "TechAcademy BA"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Acepta `CORS_ORIGINS` como lista o como cadena separada por comas.

        En el `.env.example` está como cadena porque es más cómodo de escribir; en el
        código de la aplicación, como lista.
        """
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("app_env")
    @classmethod
    def _normalize_app_env(cls, value: str) -> str:
        return value.strip().lower()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Devuelve la configuración del proceso, construida una sola vez."""
    return Settings()  # type: ignore[call-arg]
