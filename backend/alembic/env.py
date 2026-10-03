"""Entorno de Alembic.

La configuración sale de `app.core.config`, no de `alembic.ini`: una sola fuente para
la URL de la base. `target_metadata` es el `MetaData` de `app.models`, que es lo que
permite el autogenerate.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from app.core.config import get_settings
from app.models import Base
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):  # noqa: ANN001, ARG001
    """Deja el autogenerate comparar únicamente el esquema de la aplicación."""
    if type_ == "table":
        return not name.startswith("alembic_version")
    return True


def run_migrations_offline() -> None:
    """Emite el SQL de la migración sin conectarse a la base."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Aplica la migración contra la base configurada."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
