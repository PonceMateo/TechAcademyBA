"""Base declarativa y columnas comunes de todas las entidades.

D16: Alembic **no emite** CHECK constraints ni índices sobre columnas normalizadas,
así que la migración inicial se revisa y se completa a mano. Para que esa revisión
manual sea posible, los CHECK se declaran explícitamente en los modelos con
`CheckConstraint` en vez de dejar que los genere el dialecto.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def no_vacio(column_name: str, rule: str) -> CheckConstraint:
    """CHECK de "obligatorio" para una columna de texto.

    `NOT NULL` solo rechaza la ausencia de valor: no rechaza una cadena vacía ni una de
    espacios. Cuando la spec dice que un campo es obligatorio, las dos cosas cuentan
    como no haberlo informado.

    La expresión es una clase de carácter y no `length(btrim(...))` porque `btrim` solo
    recorta espacios: un valor que sea un tabulador o un salto de línea también está
    vacío.
    """
    return CheckConstraint(f"{column_name} ~ '[^[:space:]]'", name=rule)

# Convención de nombres de restricciones: el nombre es siempre
# `uq_<tabla>_<columnas>` o `ck_<tabla>_<regla>`, para que un error de PostgreSQL
# diga de qué restricción se trata sin tener que adivinarlo.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base declarativa. Un solo `MetaData` para que Alembic la use como fuente."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """`created_at` y `updated_at` en toda entidad (spec `domain-schema`,
    "Convenciones transversales del esquema").

    Se emiten como `server_default`/`onupdate` de servidor para que la marca no
    dependa de que el proceso de aplicación esté en la zona horaria correcta: la
    fecha la calcula PostgreSQL en `timestamptz`.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
