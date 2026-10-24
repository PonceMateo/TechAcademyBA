"""HU 21: solicitud de Factura A asociada a la cobranza.

Es una columna aditiva: no cambia el contrato de las cobranzas existentes y permite que la
HU 25 encuentre la solicitud sin crear una factura en esta historia.

Revision ID: 0004_cobranza_factura_a
Revises: 0003_sede_opcional_comision
Create Date: 2026-10-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0004_cobranza_factura_a"
down_revision: str | None = "0003_sede_opcional_comision"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "cobranza",
        sa.Column(
            "factura_a_solicitada",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("cobranza", "factura_a_solicitada")
