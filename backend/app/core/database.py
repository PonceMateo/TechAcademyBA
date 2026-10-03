"""Motor, sesión y conexión a la base de datos.

La zona horaria de la sesión se fija en cada conexión porque el dominio exige que
todas las fechas y horas se registren en `America/Argentina/Buenos_Aires`
(spec `domain-schema`, "Convenciones transversales del esquema"). Sin esto,
PostgreSQL usaría la del servidor, que en un contenedor normalmente es UTC.
"""

from __future__ import annotations

import re
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

#: Zona horaria tiene que ser un identificador tipo IANA. El valor viene de la
#: configuración, no de la entrada del usuario, pero `SET TIME ZONE` no acepta parámetro
# en PostgreSQL: hay que interpolarlo, y antes se valida.
_TIMEZONE_VALIDA = re.compile(r"^[A-Za-z0-9_+\-/]+$")


def _apply_session_timezone(engine: Engine, timezone: str) -> None:
    if not _TIMEZONE_VALIDA.fullmatch(timezone):
        raise ValueError(f"zona horaria inválida: {timezone!r}")

    @event.listens_for(engine, "connect")
    def _set_timezone(dbapi_connection, connection_record):  # noqa: ANN001, ARG001
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f"SET TIME ZONE '{timezone}'")  # noqa: S608
        dbapi_connection.commit()


def build_engine(database_url: str) -> Engine:
    """Crea un motor contra la URL dada, con la zona horaria del dominio aplicada."""
    engine = create_engine(database_url, pool_pre_ping=True, future=True)
    _apply_session_timezone(engine, settings.timezone)
    return engine


engine: Engine = build_engine(settings.database_url)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: una sesión por request, con rollback si algo falla."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
