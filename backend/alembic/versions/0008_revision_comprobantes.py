"""Panel administrativo y resolución de comprobantes (HU 54).

Migración aditiva sobre `comprobante_alumno`: agrega el vínculo con la cobranza acreditada, el
registro de quién resolvió y por qué, y el vínculo del reenvío de un comprobante observado. No
borra filas ni columnas y no toca `cobranza`, `pagador` ni `imputacion`.

Los estados `PENDIENTE_CARGA` y `PENDIENTE_REVISION` de la HU 52 se conservan: el CHECK de estado
se reemplaza por una lista más amplia, así que ningún comprobante existente deja de ser válido.

`uq_comprobante_alumno_cobranza_id` es la garantía de que un comprobante no puede generar más de
una cobranza, incluso con dos administradores aceptando a la vez. En PostgreSQL una restricción
única admite varias filas con NULL, que es lo que necesitan los comprobantes sin resolver.

Revision ID: 0008_revision_comprobantes
Revises: 0007_comprobante_alumno
Create Date: 2026-11-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_revision_comprobantes"
down_revision: str | None = "0007_comprobante_alumno"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESTADOS_COMPROBANTE = (
    "PENDIENTE_CARGA",
    "PENDIENTE_REVISION",
    "ACEPTADO",
    "OBSERVADO",
    "RECHAZADO",
)

ESTADOS_COMPROBANTE_ANTERIORES = ("PENDIENTE_CARGA", "PENDIENTE_REVISION")


def _lista(estados: tuple[str, ...]) -> str:
    return "estado IN (" + ", ".join(f"'{estado}'" for estado in estados) + ")"


def upgrade() -> None:
    op.add_column("comprobante_alumno", sa.Column("cobranza_id", sa.Integer(), nullable=True))
    op.add_column("comprobante_alumno", sa.Column("revisado_por", sa.Integer(), nullable=True))
    op.add_column(
        "comprobante_alumno",
        sa.Column("revisado_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("comprobante_alumno", sa.Column("motivo", sa.Text(), nullable=True))
    op.add_column(
        "comprobante_alumno",
        sa.Column("comprobante_origen_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        op.f("fk_comprobante_alumno_cobranza_id_cobranza"),
        "comprobante_alumno",
        "cobranza",
        ["cobranza_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        op.f("fk_comprobante_alumno_revisado_por_usuario"),
        "comprobante_alumno",
        "usuario",
        ["revisado_por"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_comprobante_alumno_comprobante_origen_id_comprobante_alumno"),
        "comprobante_alumno",
        "comprobante_alumno",
        ["comprobante_origen_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.drop_constraint(
        op.f("ck_comprobante_alumno_estado_valido"),
        "comprobante_alumno",
        type_="check",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_estado_valido"),
        "comprobante_alumno",
        _lista(ESTADOS_COMPROBANTE),
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_revision_registro_completo"),
        "comprobante_alumno",
        "(revisado_por IS NULL) = (revisado_at IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_motivo_obligatorio"),
        "comprobante_alumno",
        "estado NOT IN ('OBSERVADO', 'RECHAZADO')"
        " OR (motivo IS NOT NULL AND motivo ~ '[^[:space:]]')",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_cobranza_solo_si_aceptado"),
        "comprobante_alumno",
        "(estado = 'ACEPTADO') = (cobranza_id IS NOT NULL)",
    )

    op.create_unique_constraint(
        op.f("uq_comprobante_alumno_cobranza_id"),
        "comprobante_alumno",
        ["cobranza_id"],
    )
    op.create_unique_constraint(
        op.f("uq_comprobante_alumno_comprobante_origen_id"),
        "comprobante_alumno",
        ["comprobante_origen_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("uq_comprobante_alumno_comprobante_origen_id"),
        "comprobante_alumno",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_comprobante_alumno_cobranza_id"),
        "comprobante_alumno",
        type_="unique",
    )
    op.drop_constraint(
        op.f("ck_comprobante_alumno_cobranza_solo_si_aceptado"),
        "comprobante_alumno",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_comprobante_alumno_motivo_obligatorio"),
        "comprobante_alumno",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_comprobante_alumno_revision_registro_completo"),
        "comprobante_alumno",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_comprobante_alumno_estado_valido"),
        "comprobante_alumno",
        type_="check",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_estado_valido"),
        "comprobante_alumno",
        _lista(ESTADOS_COMPROBANTE_ANTERIORES),
    )

    op.drop_constraint(
        op.f("fk_comprobante_alumno_comprobante_origen_id_comprobante_alumno"),
        "comprobante_alumno",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_comprobante_alumno_revisado_por_usuario"),
        "comprobante_alumno",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_comprobante_alumno_cobranza_id_cobranza"),
        "comprobante_alumno",
        type_="foreignkey",
    )

    op.drop_column("comprobante_alumno", "comprobante_origen_id")
    op.drop_column("comprobante_alumno", "motivo")
    op.drop_column("comprobante_alumno", "revisado_at")
    op.drop_column("comprobante_alumno", "revisado_por")
    op.drop_column("comprobante_alumno", "cobranza_id")
