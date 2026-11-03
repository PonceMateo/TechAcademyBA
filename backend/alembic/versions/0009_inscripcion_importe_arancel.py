"""Importe arancelario histórico de una inscripción (HU #50).

Revision ID: 0009_inscripcion_arancel_merge
Revises: 0007_inscripcion_importe_arancel, 0008_revision_comprobantes
"""

from __future__ import annotations

from collections.abc import Sequence
from alembic import op

revision: str = "0009_inscripcion_arancel_merge"
down_revision: tuple[str, str] = (
    "0007_inscripcion_importe_arancel",
    "0008_revision_comprobantes",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
