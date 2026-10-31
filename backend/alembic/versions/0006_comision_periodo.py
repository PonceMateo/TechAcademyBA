"""Período de cursada de la comisión (historia #49).

`comision.fecha_inicio` ya existía desde la migración inicial y nunca se escribió por la API; este
change agrega `fecha_fin` y expone las dos. La columna nace **nula** porque el período se declara
por expand (D56): las comisiones existentes quedan sin fechas hasta que alguien las edite, y no se
les inventa un calendario. El `NOT NULL` no se agrega en este deploy.

El CHECK es la red de seguridad de la regla que valida el contrato: permite un `fecha_inicio` sin
fin —el legado— y prohíbe un fin sin inicio o anterior al inicio. Las expresiones de los CHECK son
**las mismas cadenas** que declara `app/models/catalogo.py`: si divergen, `alembic check` no lo ve
(no compara CHECK) y la base rechazaría un valor que el modelo cree válido.

Revision ID: 0006_comision_periodo
Revises: 0005_comision_horario
Create Date: 2026-10-31
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_comision_periodo"
down_revision: str | None = "0005_comision_horario"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Misma cadena que `EXPRESION_PERIODO` en `app/models/catalogo.py`.
EXPRESION_PERIODO = "fecha_fin IS NULL OR (fecha_inicio IS NOT NULL AND fecha_fin >= fecha_inicio)"


def upgrade() -> None:
    op.add_column("comision", sa.Column("fecha_fin", sa.Date(), nullable=True))
    op.create_check_constraint(
        op.f("ck_comision_periodo_coherente"), "comision", EXPRESION_PERIODO
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_comision_periodo_coherente"), "comision", type_="check")
    op.drop_column("comision", "fecha_fin")
