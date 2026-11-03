"""Comprobantes de pago enviados por alumnos (HU 52).

Tabla nueva, aditiva: no toca `cobranza`, `pagador` ni `imputacion`, y no agrega valores al enum
de cobranza (D12). El envío de un comprobante no acredita el pago: es una declaración pendiente de
revisión de Secretaría.

`PENDIENTE_CARGA` es el estado técnico mientras se sube el archivo; `PENDIENTE_REVISION` es el
estado inicial visible y se alcanza recién después de verificar el contenido almacenado.

La expresión del CUIT es la misma que `EXPRESION_CUIT_VALIDO` de `app/models/inscripciones.py`:
si divergen, `alembic check` no lo detecta (no compara CHECK) y la base rechazaría un valor que el
modelo cree válido.

Revision ID: 0007_comprobante_alumno
Revises: 0006_comision_periodo
Create Date: 2026-11-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_comprobante_alumno"
down_revision: str | None = "0006_comision_periodo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MEDIOS_PAGO = (
    "TRANSFERENCIA",
    "EFECTIVO",
    "CHEQUE",
    "TARJETA",
    "BILLETERA",
    "OTRO",
)

_CUIT_PESOS = (
    "substr(cuit_norm, 1, 1)::int * 5 + substr(cuit_norm, 2, 1)::int * 4"
    " + substr(cuit_norm, 3, 1)::int * 3 + substr(cuit_norm, 4, 1)::int * 2"
    " + substr(cuit_norm, 5, 1)::int * 7 + substr(cuit_norm, 6, 1)::int * 6"
    " + substr(cuit_norm, 7, 1)::int * 5 + substr(cuit_norm, 8, 1)::int * 4"
    " + substr(cuit_norm, 9, 1)::int * 3 + substr(cuit_norm, 10, 1)::int * 2"
)
_CUIT_CIFRA = (
    f"CASE mod({_CUIT_PESOS}, 11)"
    " WHEN 0 THEN 0"
    " WHEN 1 THEN 9"
    f" ELSE 11 - mod({_CUIT_PESOS}, 11) END"
)
_CUIT_DIGITO = (
    f"CASE WHEN cuit_norm ~ '^[0-9]{{11}}$'"
    f" THEN {_CUIT_CIFRA} = substr(cuit_norm, 11, 1)::int"
    " ELSE false END"
)
EXPRESION_CUIT_VALIDO = f"cuit_norm IS NULL OR ({_CUIT_DIGITO})"


def upgrade() -> None:
    op.create_table(
        "comprobante_alumno",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("alumno_id", sa.Integer(), nullable=False),
        sa.Column("inscripcion_id", sa.Integer(), nullable=False),
        sa.Column("fecha_pago", sa.Date(), nullable=False),
        sa.Column("importe", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("medio", sa.String(length=20), nullable=False),
        sa.Column("titular", sa.String(length=160), nullable=True),
        sa.Column(
            "factura_a_solicitada", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column("cuit", sa.String(length=20), nullable=True),
        sa.Column("cuit_norm", sa.String(length=20), nullable=True),
        sa.Column("archivo_clave", sa.String(length=120), nullable=False),
        sa.Column("archivo_nombre", sa.String(length=200), nullable=True),
        sa.Column("archivo_mime", sa.String(length=100), nullable=True),
        sa.Column("archivo_bytes", sa.Integer(), nullable=True),
        sa.Column("archivo_sha256", sa.String(length=64), nullable=True),
        sa.Column(
            "estado",
            sa.String(length=30),
            server_default="PENDIENTE_CARGA",
            nullable=False,
        ),
        sa.Column("enviado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_comprobante_alumno_alumno_id_alumno"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inscripcion_id"],
            ["inscripcion.id"],
            name=op.f("fk_comprobante_alumno_inscripcion_id_inscripcion"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comprobante_alumno")),
        sa.UniqueConstraint(
            "archivo_clave", name=op.f("uq_comprobante_alumno_archivo_clave")
        ),
    )

    op.create_check_constraint(
        op.f("ck_comprobante_alumno_medio_pago_valido"),
        "comprobante_alumno",
        "medio IN (" + ", ".join(f"'{medio}'" for medio in MEDIOS_PAGO) + ")",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_estado_valido"),
        "comprobante_alumno",
        "estado IN ('PENDIENTE_CARGA', 'PENDIENTE_REVISION')",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_importe_positivo"), "comprobante_alumno", "importe > 0"
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_fecha_no_futura"),
        "comprobante_alumno",
        "fecha_pago <= CURRENT_DATE",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_cuit_solo_con_factura_a"),
        "comprobante_alumno",
        "factura_a_solicitada = (cuit_norm IS NOT NULL)",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_cuit_formato"),
        "comprobante_alumno",
        "cuit_norm IS NULL OR cuit_norm ~ '^[0-9]{11}$'",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_cuit_digito"), "comprobante_alumno", EXPRESION_CUIT_VALIDO
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_archivo_tamano_valido"),
        "comprobante_alumno",
        "archivo_bytes IS NULL OR archivo_bytes BETWEEN 1 AND 5242880",
    )
    op.create_check_constraint(
        op.f("ck_comprobante_alumno_enviado_at_coherente"),
        "comprobante_alumno",
        "(estado = 'PENDIENTE_CARGA') = (enviado_at IS NULL)",
    )


def downgrade() -> None:
    op.drop_table("comprobante_alumno")
