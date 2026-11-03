"""Compatibilidad con la revisión de HU 50 aplicada antes de actualizar la rama.

Esta revisión ya fue aplicada en algunas bases locales antes de que el historial de migraciones
de `main` agregara otra revisión 0007. Se conserva para que Alembic pueda leer esas bases y se
fusiona con la rama de comprobantes en 0009.

Revision ID: 0007_inscripcion_importe_arancel
Revises: 0006_comision_periodo
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_inscripcion_importe_arancel"
down_revision: str | None = "0006_comision_periodo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "inscripcion",
        sa.Column("importe_arancel", sa.Numeric(14, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inscripcion", "importe_arancel")
