"""Infraestructura de pruebas.

D15: pytest corre contra **PostgreSQL real**, nunca SQLite. El motivo es concreto: el
esquema usa `num_nonnulls`, índices únicos sobre columnas normalizadas, CHECKs con
`CURRENT_DATE` y columnas `timestamptz`. SQLite no tiene nada de eso, así que una suite
en SQLite pasaría y la migración fallaría después.

Estrategia: motor a nivel de sesión y rollback por test (D15). El esquema se aplica una
sola vez por sesión con la migración inicial real de Alembic, y cada test corre dentro de
una transacción que se descarta al terminar.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Generator, Iterator
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import _apply_session_timezone

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"

#: Sufijo de la base de pruebas. La de desarrollo nunca se toca desde acá.
TEST_DB_SUFFIX = "_test"


def _database_name(url: str) -> str:
    return urlsplit(url).path.lstrip("/")


def _with_database_name(url: str, name: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(parts._replace(path=f"/{name}"))


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """URL de la base de pruebas, creada si no existe.

    `TEST_DATABASE_URL` manda si está definida (es lo que usará el job de CI); si no, se
    deriva de `DATABASE_URL` cambiando el nombre de la base. Así la suite nunca escribe
    sobre la base de desarrollo.
    """
    explicit = os.environ.get("TEST_DATABASE_URL")
    url = explicit or _with_database_name(
        get_settings().database_url,
        f"{_database_name(get_settings().database_url)}{TEST_DB_SUFFIX}",
    )

    name = _database_name(url)
    if explicit:
        yield url
        return

    maintenance = _with_database_name(url, "postgres")
    admin_engine = create_engine(maintenance, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as connection:
            exists = connection.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": name}
            ).scalar()
            if not exists:
                # `CREATE DATABASE` no admite parámetro en el identificador, y el
                # nombre sale de la propia configuración, no de la entrada del usuario.
                connection.execute(text(f'CREATE DATABASE "{name}"'))  # noqa: S608
    finally:
        admin_engine.dispose()

    yield url


@pytest.fixture(scope="session")
def engine(test_database_url: str) -> Iterator[object]:
    """Motor de la base de pruebas, con el esquema aplicado por la migración inicial.

    Aplica `downgrade base` primero para que una corrida anterior a medias no ensucie la
    base de pruebas, y `upgrade head` después. Corre como subproceso porque Alembic
    cachea el estado del script directory en el proceso actual.
    """
    _run_alembic(test_database_url, "downgrade", "base", must_succeed=False)
    _run_alembic(test_database_url, "upgrade", "head")

    test_engine = create_engine(test_database_url, pool_pre_ping=True, future=True)
    _apply_session_timezone(test_engine, get_settings().timezone)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    """Sesión de base de datos que se descarta al terminar el test (D15)."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, autoflush=False, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        # Un test que provoca un `IntegrityError` deja la transacción desasociada de la
        # conexión, y `rollback()` sobre una transacción inactiva es un warning. Se
        # descarta solo si sigue viva.
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client() -> Iterator[object]:
    """Cliente HTTP de prueba contra la aplicación, sin autenticación.

    No toca la base. Sirve para las rutas que no la necesitan, como `/health`. Para las que
    sí, está `api_client`.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def api_client(db_session: Session) -> Iterator[object]:
    """Cliente HTTP conectado a la base de pruebas.

    Sin esto, una ruta que recibe `get_db` abre su propia sesión contra `SessionLocal`, que
    apunta a la base de **desarrollo**: la prueba leería y escribiría datos de la máquina
    del equipo. Se sobreescribe la dependencia con la sesión que la prueba ya va a
    descartar, así que el aislamiento de D15 sigue valiendo para las rutas HTTP.
    """
    from fastapi.testclient import TestClient

    from app.core.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def _run_alembic(database_url: str, *args: str, must_succeed: bool = True) -> None:
    """Corre Alembic en un subproceso contra la URL dada."""
    environment = {**os.environ, "DATABASE_URL": database_url}
    # `env.py` lee la configuración de `app.core.config`, que cachea el valor. El
    # subproceso es nuevo, así que alcanza con la variable de entorno.
    environment.setdefault("JWT_SECRET_KEY", "tests-only-not-a-real-secret")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *args],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if must_succeed and result.returncode != 0:
        raise AssertionError(
            f"alembic {' '.join(args)} falló ({result.returncode}).\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


def assert_rechazado(agregar, *args, **kwargs) -> str:
    """Ejecuta `agregar`, que se espera que PostgreSQL rechace, y devuelve el motivo.

    El rechazo tiene que venir de la base. Se aceptan las dos excepciones con las que
    PostgreSQL rechaza una fila: `IntegrityError` cuando es una restricción y `DataError`
    cuando el valor no se puede convertir al tipo de la columna, que es lo que pasa con
    un documento que tiene letras donde la base espera dígitos. En los dos casos es la
    base diciendo que no.
    """
    from sqlalchemy.exc import DataError, IntegrityError

    try:
        agregar(*args, **kwargs)
    except (IntegrityError, DataError) as error:
        return str(error.orig)
    raise AssertionError("La operación debería haber sido rechazada por la base y no lo fue.")
