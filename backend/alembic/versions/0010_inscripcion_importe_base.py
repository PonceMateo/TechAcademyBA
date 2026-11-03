"""Importe de la inscripción como base sin descuento de beca (issue #111).

La H/U 50 guardó en `importe_arancel` el importe final ya descontado. Desde este change la columna
guarda el **base prorrateado sin descuento**, y el descuento se aplica al derivar el monto requerido
(D77). Esta revisión des-aplica el descuento a las filas `BECADO_PARCIAL` que ya lo tienen.

Es una migración de datos, sin cambio de esquema: no agrega ni borra columnas. El redondeo del alta
puede dejar hasta un centavo de diferencia en el base reconstruido, que es menor que dejar el
importe viejo y duplicar el descuento.

Revision ID: 0010_inscripcion_importe_base
Revises: 0009_inscripcion_arancel_merge
Create Date: 2026-11-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_inscripcion_importe_base"
down_revision: str | None = "0009_inscripcion_arancel_merge"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Des-aplica el descuento de beca al importe guardado."""
    op.execute(
        sa.text(
            """
            UPDATE inscripcion
            SET importe_arancel = round(importe_arancel * 100 / (100 - porcentaje_beca), 2)
            WHERE categoria = 'BECADO_PARCIAL'
              AND importe_arancel IS NOT NULL
              AND porcentaje_beca IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    """Vuelve a aplicar el descuento, para que el código anterior lea el mismo monto."""
    op.execute(
        sa.text(
            """
            UPDATE inscripcion
            SET importe_arancel = round(importe_arancel * (100 - porcentaje_beca) / 100, 2)
            WHERE categoria = 'BECADO_PARCIAL'
              AND importe_arancel IS NOT NULL
              AND porcentaje_beca IS NOT NULL
            """
        )
    )
