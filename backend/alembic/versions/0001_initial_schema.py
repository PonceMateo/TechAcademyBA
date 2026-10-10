"""Esquema de dominio inicial de TechAcademy BA.

Es la migración inicial del proyecto: construye el esquema completo del dominio sobre
una base vacía.

**Cómo se hizo (D16).** El esqueleto salió de `alembic revision --autogenerate` y
después esta migración se **revisó y se editó a mano**. Vale la pena ser honesto sobre
qué se editeda realmente hoy: Alembic 1.20 sí detecta `CheckConstraint` y
`UniqueConstraint` del metadata, así que el CHECKs y los índices sobre columnas
normalizadas llegan solos. Lo que el autogenerate **no** puede emitir, y que está
escrito a mano acá, es:

1. El trigger de inmutabilidad de `audit_log`. Un CHECK no puede impedir un `UPDATE`,
   y la spec exige que el registro de auditoría sea de solo agregado.
2. El orden de creación de las tablas y el `downgrade`, revisados para que la
   reversión sea completa.
3. La decisión de qué columnas normalizadas llevan índice único, que es una decisión
   de dominio (D6) y no un reflejo del metadata.

El modelo de `app/models` sigue siendo la fuente: este archivo se regenera con
`alembic revision --autogenerate` y después se corrige, nunca al revés.

**Lo que este esquema NO tiene, a propósito (D11):** ninguna tabla de cuotas ni del
esquema de cobro. El equipo tiene que definirlo con el cliente antes de implementar la
historia #27, y la entidad de cuotas se agrega después como columna nula más un CHECK
relajado en `imputacion` (D7). La prueba `test_migration.py::test_no_hay_esquema_de_cuotas`
falla si alguien la agrega sin revisar el alcance.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-02
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Nombres de tipos y funciones del dominio, agrupados para que el `downgrade` los
# pueda soltar sin repetir cadenas.
_AUDIT_LOG_GUARD_FN = "audit_log_solo_agregado"
_AUDIT_LOG_GUARD_TRIGGER = "trg_audit_log_solo_agregado"


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Padrón de alumnos y docentes, y la identidad única de acceso.
    # El orden importa: `comision` referencia `docente`, y `usuario` referencia a
    # ambos.
    # ------------------------------------------------------------------
    op.create_table(
        "alumno",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=160), nullable=False),
        # D30: el documento puede ser nulo porque el instituto inscribe alumnos del
        # exterior, que entran con pasaporte y sin DNI.
        sa.Column("documento", sa.String(length=20), nullable=True),
        # D6: el índice único va sobre la columna normalizada, no sobre la cruda.
        sa.Column("documento_norm", sa.String(length=20), nullable=True),
        sa.Column("tipo_documento", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("telefono", sa.String(length=40), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.CheckConstraint(
            "tipo_documento IN ('DNI', 'PASAPORTE')", name=op.f("ck_alumno_tipo_documento_valido")
        ),
        sa.CheckConstraint(
            "(documento IS NULL) = (tipo_documento IS NULL)",
            name=op.f("ck_alumno_documento_y_tipo_juntos"),
        ),
        sa.CheckConstraint(
            "nombre ~ '[^[:space:]]'", name=op.f("ck_alumno_alumno_nombre_obligatorio")
        ),
        sa.CheckConstraint(
            "email ~ '[^[:space:]]'", name=op.f("ck_alumno_alumno_email_obligatorio")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alumno")),
        sa.UniqueConstraint("documento_norm", name="uq_alumno_documento_norm"),
        sa.UniqueConstraint("email", name="uq_alumno_email"),
    )
    op.create_table(
        "docente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("apellido", sa.String(length=80), nullable=False),
        sa.Column("dni", sa.String(length=20), nullable=False),
        sa.Column("dni_norm", sa.String(length=20), nullable=False),
        # D27: acá el CUIL es obligatorio. Es el identificador con el que el instituto
        # liquida, así que en este esquema un docente sin CUIL no existe. D33 revierte la
        # obligatoriedad y `0002` la afloja; el dígito verificador no se valida: pendiente P7.
        sa.Column("cuil", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("telefono", sa.String(length=40), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_docente")),
        sa.UniqueConstraint("cuil", name="uq_docente_cuil"),
        sa.UniqueConstraint("dni_norm", name="uq_docente_dni_norm"),
        sa.UniqueConstraint("email", name="uq_docente_email"),
        # D27: obligatorio de verdad en este esquema. `NOT NULL` no alcanza: un CUIL vacío
        # no identifica a nadie para liquidar. `0002` lo elimina (D33).
        sa.CheckConstraint(
            "cuil ~ '[^[:space:]]'", name=op.f("ck_docente_docente_cuil_obligatorio")
        ),
        sa.CheckConstraint(
            "email ~ '[^[:space:]]'", name=op.f("ck_docente_docente_email_obligatorio")
        ),
        sa.CheckConstraint(
            "nombre ~ '[^[:space:]]'", name=op.f("ck_docente_docente_nombre_obligatorio")
        ),
        sa.CheckConstraint(
            "apellido ~ '[^[:space:]]'", name=op.f("ck_docente_docente_apellido_obligatorio")
        ),
    )
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        # D5: `usuario.email` es único de forma global. Es la tabla de identidad, así
        # que una dirección identifica a una sola persona.
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("nombre", sa.String(length=160), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("must_change_password", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("docente_id", sa.Integer(), nullable=True),
        sa.Column("alumno_id", sa.Integer(), nullable=True),
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
        sa.CheckConstraint(
            "rol IN ('ADMIN', 'DOCENTE', 'ALUMNO')", name=op.f("ck_usuario_rol_valido")
        ),
        # D4: correspondencia entre rol y vínculo.
        sa.CheckConstraint(
            "(rol = 'ADMIN' AND docente_id IS NULL AND alumno_id IS NULL)"
            " OR (rol = 'DOCENTE' AND docente_id IS NOT NULL AND alumno_id IS NULL)"
            " OR (rol = 'ALUMNO' AND docente_id IS NULL AND alumno_id IS NOT NULL)",
            name=op.f("ck_usuario_rol_vinculo_coherente"),
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_usuario_alumno_id_alumno"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["docente_id"],
            ["docente.id"],
            name=op.f("fk_usuario_docente_id_docente"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuario")),
        sa.UniqueConstraint("email", name="uq_usuario_email"),
        sa.CheckConstraint(
            "email ~ '[^[:space:]]'", name=op.f("ck_usuario_usuario_email_obligatorio")
        ),
        sa.CheckConstraint(
            "nombre ~ '[^[:space:]]'", name=op.f("ck_usuario_usuario_nombre_obligatorio")
        ),
    )

    # ------------------------------------------------------------------
    # Catálogo: sedes, cursos y comisiones.
    # ------------------------------------------------------------------
    op.create_table(
        "sede",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("direccion", sa.String(length=255), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sede")),
        sa.UniqueConstraint("nombre", name="uq_sede_nombre"),
        sa.CheckConstraint(
            "nombre ~ '[^[:space:]]'", name=op.f("ck_sede_sede_nombre_obligatorio")
        ),
    )
    op.create_table(
        "curso",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=50), nullable=False),
        sa.Column("codigo_norm", sa.String(length=50), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("nombre_norm", sa.String(length=200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_curso")),
        # D6: la unicidad va sobre las columnas normalizadas, para que `CUR-101` y
        # `CUR101` colisionen, que es el duplicado que tiene la planilla del cliente.
        sa.UniqueConstraint("codigo_norm", name="uq_curso_codigo_norm"),
        sa.UniqueConstraint("nombre_norm", name="uq_curso_nombre_norm"),
        # Historia #1: el nombre y el código son obligatorios.
        sa.CheckConstraint(
            "codigo ~ '[^[:space:]]'", name=op.f("ck_curso_curso_codigo_obligatorio")
        ),
        sa.CheckConstraint(
            "nombre ~ '[^[:space:]]'", name=op.f("ck_curso_curso_nombre_obligatorio")
        ),
    )
    op.create_table(
        "comision",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("curso_id", sa.Integer(), nullable=False),
        sa.Column("docente_id", sa.Integer(), nullable=True),
        sa.Column("codigo", sa.String(length=50), nullable=False),
        sa.Column("dias_horarios", sa.String(length=255), nullable=False),
        # D10: las vacantes NO son columna. Se derivan por consulta.
        sa.Column("cupo_maximo", sa.Integer(), nullable=False),
        sa.Column("arancel", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("modalidad", sa.String(length=20), nullable=False),
        sa.Column("sede_id", sa.Integer(), nullable=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=True),
        # No hay columna `estado`: `design.md` (Gaps abiertos #14) deja constancia de
        # que los siete estados de comisión de la planilla del cliente no se modelan.
        # La baja lógica va con `activo`.
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.CheckConstraint("cupo_maximo > 0", name=op.f("ck_comision_cupo_maximo_positivo")),
        sa.CheckConstraint(
            "codigo ~ '[^[:space:]]'", name=op.f("ck_comision_comision_codigo_obligatorio")
        ),
        sa.CheckConstraint(
            "dias_horarios ~ '[^[:space:]]'",
            name=op.f("ck_comision_comision_dias_horarios_obligatorio"),
        ),
        sa.CheckConstraint("arancel > 0", name=op.f("ck_comision_arancel_positivo")),
        sa.CheckConstraint(
            "modalidad IN ('VIRTUAL', 'PRESENCIAL', 'HIBRIDO')",
            name=op.f("ck_comision_modalidad_valida"),
        ),
        # Historia #8: Presencial e Híbrido exigen sede; Virtual no la exige.
        sa.CheckConstraint(
            "modalidad = 'VIRTUAL' OR sede_id IS NOT NULL",
            name=op.f("ck_comision_modalidad_presencial_requiere_sede"),
        ),
        sa.ForeignKeyConstraint(
            ["curso_id"],
            ["curso.id"],
            name=op.f("fk_comision_curso_id_curso"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["docente_id"],
            ["docente.id"],
            name=op.f("fk_comision_docente_id_docente"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sede_id"],
            ["sede.id"],
            name=op.f("fk_comision_sede_id_sede"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comision")),
        sa.UniqueConstraint("codigo", name="uq_comision_codigo"),
    )
    op.create_index("ix_comision_curso_id", "comision", ["curso_id"], unique=False)

    # ------------------------------------------------------------------
    # Cuentas corporativas. `empresa` antes que `contrato_corporativo`, que a su vez
    # antes que `nomina_empleado`.
    # ------------------------------------------------------------------
    op.create_table(
        "empresa",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("razon_social", sa.String(length=200), nullable=False),
        sa.Column("cuit", sa.String(length=20), nullable=False),
        sa.Column("cuit_norm", sa.String(length=20), nullable=False),
        sa.Column("requiere_factura_a", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.CheckConstraint(
            "cuit_norm ~ '^[0-9]{11}$'", name=op.f("ck_empresa_cuit_formato")
        ),
        sa.CheckConstraint(
            # Regla de AFIP: pesos 5,4,3,2,7,6,5,4,3,2 sobre los diez primeros
            # dígitos; dv = 11 - (suma mod 11); dv 11 -> 0; dv 10 -> 9.
            # Se usa `mod()` y no `%` porque Alembic escapa el `%` al escribir el
            # CHECK y un `%%` es un error de sintaxis en PostgreSQL.
            # El CASE exterior es lo que hace el CHECK seguro ante un CUIT mal
            # formado: sin él, `substr(cuit_norm, 1, 1)::int` revienta con un error de
            # cast en lugar de rechazar la fila por la restricción, y PostgreSQL no
            # garantiza el orden de evaluación de los operandos de un AND.
            "CASE WHEN cuit_norm ~ '^[0-9]{11}$'"
            " THEN CASE mod("
            "substr(cuit_norm, 1, 1)::int * 5 + substr(cuit_norm, 2, 1)::int * 4"
            " + substr(cuit_norm, 3, 1)::int * 3 + substr(cuit_norm, 4, 1)::int * 2"
            " + substr(cuit_norm, 5, 1)::int * 7 + substr(cuit_norm, 6, 1)::int * 6"
            " + substr(cuit_norm, 7, 1)::int * 5 + substr(cuit_norm, 8, 1)::int * 4"
            " + substr(cuit_norm, 9, 1)::int * 3 + substr(cuit_norm, 10, 1)::int * 2"
            ", 11) WHEN 0 THEN 0 WHEN 1 THEN 9 ELSE 11 - mod("
            "substr(cuit_norm, 1, 1)::int * 5 + substr(cuit_norm, 2, 1)::int * 4"
            " + substr(cuit_norm, 3, 1)::int * 3 + substr(cuit_norm, 4, 1)::int * 2"
            " + substr(cuit_norm, 5, 1)::int * 7 + substr(cuit_norm, 6, 1)::int * 6"
            " + substr(cuit_norm, 7, 1)::int * 5 + substr(cuit_norm, 8, 1)::int * 4"
            " + substr(cuit_norm, 9, 1)::int * 3 + substr(cuit_norm, 10, 1)::int * 2"
            ", 11) END = substr(cuit_norm, 11, 1)::int"
            " ELSE false END",
            name=op.f("ck_empresa_cuit_digito"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_empresa")),
        # D6: único sobre la columna normalizada, para que `30-71665544-9` y
        # `30716655449` sean la misma empresa.
        sa.UniqueConstraint("cuit_norm", name="uq_empresa_cuit_norm"),
    )
    op.create_table(
        "contrato_corporativo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("comision_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("monto", sa.Numeric(precision=14, scale=2), server_default="0", nullable=False),
        sa.Column("estado", sa.String(length=20), server_default="ACTIVO", nullable=False),
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
        sa.CheckConstraint(
            "tipo IN ('CHARLA', 'CURSO_FORMAL')",
            name=op.f("ck_contrato_corporativo_tipo_contrato_valido"),
        ),
        sa.CheckConstraint(
            "estado IN ('ACTIVO', 'FINALIZADO')",
            name=op.f("ck_contrato_corporativo_estado_contrato_valido"),
        ),
        sa.CheckConstraint(
            "monto >= 0", name=op.f("ck_contrato_corporativo_contrato_monto_no_negativo")
        ),
        sa.ForeignKeyConstraint(
            ["comision_id"],
            ["comision.id"],
            name=op.f("fk_contrato_corporativo_comision_id_comision"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_contrato_corporativo_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contrato_corporativo")),
        # D26: la nómina se ancla en el contrato, no en la empresa. Esta clave única
        # no es redundante: es el destino que permite el CHECK de "una charla no
        # genera nómina" en `nomina_empleado`.
        sa.UniqueConstraint("id", "tipo", name="uq_contrato_corporativo_id_tipo"),
    )

    # ------------------------------------------------------------------
    # Inscripciones. No tiene columna de estado de habilitación (D9).
    # ------------------------------------------------------------------
    op.create_table(
        "inscripcion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("alumno_id", sa.Integer(), nullable=False),
        sa.Column("comision_id", sa.Integer(), nullable=False),
        sa.Column("categoria", sa.String(length=20), nullable=False),
        sa.Column("porcentaje_beca", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("empresa_id", sa.Integer(), nullable=True),
        sa.Column("estado", sa.String(length=20), server_default="ACTIVA", nullable=False),
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
        sa.CheckConstraint(
            "categoria IN ('PARTICULAR', 'BECADO_PARCIAL', 'BECADO_TOTAL', 'CORPORATIVO')",
            name=op.f("ck_inscripcion_categoria_valida"),
        ),
        sa.CheckConstraint(
            "estado IN ('ACTIVA', 'EN_ESPERA', 'BAJA', 'COMPLETADA')",
            name=op.f("ck_inscripcion_estado_inscripcion_valido"),
        ),
        # Historia #15: el porcentaje solo existe para la beca parcial y va de 1 a 99.
        sa.CheckConstraint(
            "(categoria = 'BECADO_PARCIAL' AND porcentaje_beca IS NOT NULL"
            " AND porcentaje_beca BETWEEN 1 AND 99)"
            " OR (categoria <> 'BECADO_PARCIAL' AND porcentaje_beca IS NULL)",
            name=op.f("ck_inscripcion_porcentaje_beca_solo_para_becado_parcial"),
        ),
        # Historia #14: la categoría Corporativo exige empresa.
        sa.CheckConstraint(
            "categoria <> 'CORPORATIVO' OR empresa_id IS NOT NULL",
            name=op.f("ck_inscripcion_corporativo_requiere_empresa"),
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_inscripcion_alumno_id_alumno"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["comision_id"],
            ["comision.id"],
            name=op.f("fk_inscripcion_comision_id_comision"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_inscripcion_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inscripcion")),
        sa.UniqueConstraint("alumno_id", "comision_id", name="uq_inscripcion_alumno_comision"),
    )
    op.create_table(
        "nomina_empleado",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("contrato_id", sa.Integer(), nullable=False),
        # Columna desnormalizada que existe **para sostener una restricción**: junto
        # con la clave foránea compuesta, impide que una charla cerrada tenga nómina.
        # Historia #19: una charla cerrada no genera alumnos ni pide carga de nómina.
        sa.Column("tipo_contrato", sa.String(length=20), nullable=False),
        sa.Column("alumno_id", sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            "tipo_contrato = 'CURSO_FORMAL'",
            name=op.f("ck_nomina_empleado_solo_curso_formal_tiene_nomina"),
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_nomina_empleado_alumno_id_alumno"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["contrato_id", "tipo_contrato"],
            ["contrato_corporativo.id", "contrato_corporativo.tipo"],
            name="fk_nomina_empleado_contrato_id_tipo_contrato_corporativo",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_nomina_empleado")),
        sa.UniqueConstraint("contrato_id", "alumno_id", name="uq_nomina_contrato_alumno"),
    )

    # ------------------------------------------------------------------
    # Cobranzas, imputaciones y facturas.
    # ------------------------------------------------------------------
    op.create_table(
        "pagador",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=160), nullable=False),
        sa.Column("documento", sa.String(length=20), nullable=True),
        sa.Column("documento_norm", sa.String(length=20), nullable=True),
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
        # Historia #22: un CUIT de pagador con formato incorrecto se rechaza. El
        # pagador no es un alumno ni entra al padrón, y `design.md` deja abierta la
        # pregunta de si se deduplica por documento, así que no lleva índice único.
        sa.CheckConstraint(
            "documento_norm IS NULL OR documento_norm ~ '^[0-9]{7,11}$'",
            name=op.f("ck_pagador_pagador_documento_formato"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pagador")),
    )
    op.create_table(
        "cobranza",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("importe", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("medio", sa.String(length=20), nullable=False),
        sa.Column("origen", sa.String(length=20), server_default="MANUAL", nullable=False),
        sa.Column("estado", sa.String(length=20), server_default="ACREDITADO", nullable=False),
        # D28 / historia #45: por qué el comprobante no está acreditado. Sin la causa,
        # un comprobante ilegible y una mora de tres meses son indistinguibles.
        sa.Column("causa", sa.Text(), nullable=True),
        sa.Column("pagador_id", sa.Integer(), nullable=True),
        # Historia #24: el cambio de estado queda con su autor y su fecha.
        sa.Column("estado_cambiado_por", sa.Integer(), nullable=True),
        sa.Column("estado_cambiado_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("importe > 0", name=op.f("ck_cobranza_cobranza_importe_positivo")),
        # La fecha de una cobranza no puede ser futura (historia #21).
        sa.CheckConstraint(
            "fecha <= CURRENT_DATE", name=op.f("ck_cobranza_cobranza_fecha_no_futura")
        ),
        sa.CheckConstraint(
            "medio IN ('TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA', 'BILLETERA', 'OTRO')",
            name=op.f("ck_cobranza_medio_pago_valido"),
        ),
        sa.CheckConstraint(
            "origen IN ('MANUAL', 'PASARELA')",
            name=op.f("ck_cobranza_origen_cobranza_valido"),
        ),
        sa.CheckConstraint(
            "estado IN ('ACREDITADO', 'OBSERVADO', 'RECHAZADO')",
            name=op.f("ck_cobranza_estado_cobranza_valido"),
        ),
        sa.CheckConstraint(
            "estado = 'ACREDITADO' OR (causa IS NOT NULL AND causa ~ '[^[:space:]]')",
            name=op.f("ck_cobranza_causa_obligatoria_si_no_acreditado"),
        ),
        sa.CheckConstraint(
            "(estado_cambiado_por IS NULL) = (estado_cambiado_at IS NULL)",
            name=op.f("ck_cobranza_estado_cambiado_registro_completo"),
        ),
        sa.ForeignKeyConstraint(
            ["estado_cambiado_por"],
            ["usuario.id"],
            name=op.f("fk_cobranza_estado_cambiado_por_usuario"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["pagador_id"],
            ["pagador.id"],
            name=op.f("fk_cobranza_pagador_id_pagador"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cobranza")),
    )
    op.create_table(
        "imputacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cobranza_id", sa.Integer(), nullable=False),
        sa.Column("inscripcion_id", sa.Integer(), nullable=True),
        sa.Column("empresa_id", sa.Integer(), nullable=True),
        sa.Column("monto", sa.Numeric(precision=14, scale=2), nullable=False),
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
        sa.CheckConstraint("monto > 0", name=op.f("ck_imputacion_imputacion_monto_positivo")),
        # D7: destino único. Cuando llegue `Cuota` se agrega `cuota_id` nula y se relaja
        # a `num_nonnulls(inscripcion_id, empresa_id, cuota_id) = 1`, que es una
        # migración aditiva que no rompe datos ni referencias.
        sa.CheckConstraint(
            "num_nonnulls(inscripcion_id, empresa_id) = 1",
            name=op.f("ck_imputacion_imputacion_destino_unico"),
        ),
        sa.ForeignKeyConstraint(
            ["cobranza_id"],
            ["cobranza.id"],
            name=op.f("fk_imputacion_cobranza_id_cobranza"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_imputacion_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inscripcion_id"],
            ["inscripcion.id"],
            name=op.f("fk_imputacion_inscripcion_id_inscripcion"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_imputacion")),
    )
    op.create_table(
        "factura",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("alumno_id", sa.Integer(), nullable=True),
        sa.Column("empresa_id", sa.Integer(), nullable=True),
        # D29: se registra la factura A y la B.
        sa.Column("tipo", sa.String(length=2), nullable=False),
        sa.Column("requerida", sa.Boolean(), nullable=False),
        sa.Column("emitida", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("numero", sa.String(length=40), nullable=True),
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
        sa.CheckConstraint("tipo IN ('A', 'B')", name=op.f("ck_factura_tipo_factura_valido")),
        sa.CheckConstraint(
            "num_nonnulls(alumno_id, empresa_id) = 1",
            name=op.f("ck_factura_factura_destino_unico"),
        ),
        # Historia #25: si no se requiere Factura A no hay seguimiento pendiente.
        sa.CheckConstraint(
            "requerida OR NOT emitida", name=op.f("ck_factura_factura_no_requerida_no_emitida")
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_factura_alumno_id_alumno"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["empresa_id"],
            ["empresa.id"],
            name=op.f("fk_factura_empresa_id_empresa"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_factura")),
    )

    # ------------------------------------------------------------------
    # Clases, asistencia, override y auditoría.
    # ------------------------------------------------------------------
    op.create_table(
        "clase",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("comision_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("tema", sa.Text(), nullable=True),
        sa.Column("link_virtual", sa.Text(), nullable=True),
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
        # Historia #33: un link que no es URL válida se rechaza.
        sa.CheckConstraint(
            "link_virtual IS NULL OR link_virtual ~ '^https?://[^[:space:]]+$'",
            name=op.f("ck_clase_clase_link_virtual_url"),
        ),
        sa.ForeignKeyConstraint(
            ["comision_id"],
            ["comision.id"],
            name=op.f("fk_clase_comision_id_comision"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clase")),
    )
    op.create_table(
        "asistencia",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("clase_id", sa.Integer(), nullable=False),
        sa.Column("alumno_id", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False),
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
        sa.CheckConstraint(
            "estado IN ('PRESENTE', 'AUSENTE')",
            name=op.f("ck_asistencia_asistencia_estado_valido"),
        ),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
            name=op.f("fk_asistencia_alumno_id_alumno"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["clase_id"],
            ["clase.id"],
            name=op.f("fk_asistencia_clase_id_clase"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_asistencia")),
        sa.UniqueConstraint("clase_id", "alumno_id", name="uq_asistencia_clase_alumno"),
    )
    op.create_table(
        "override_habilitacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inscripcion_id", sa.Integer(), nullable=False),
        sa.Column("estado_forzado", sa.String(length=20), nullable=False),
        # Historia #30: sin motivo no hay forzaje. El motivo es lo que después se
        # muestra al alumno.
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column(
            "fecha",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
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
        sa.CheckConstraint(
            "estado_forzado IN ('HABILITADO', 'BLOQUEADO')",
            name=op.f("ck_override_habilitacion_estado_forzado_valido"),
        ),
        sa.CheckConstraint(
            "motivo ~ '[^[:space:]]'",
            name=op.f("ck_override_habilitacion_override_motivo_obligatorio"),
        ),
        sa.ForeignKeyConstraint(
            ["inscripcion_id"],
            ["inscripcion.id"],
            name=op.f("fk_override_habilitacion_inscripcion_id_inscripcion"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_override_habilitacion_usuario_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_override_habilitacion")),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("accion", sa.String(length=80), nullable=False),
        sa.Column("entidad", sa.String(length=80), nullable=False),
        sa.Column("entidad_id", sa.Integer(), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        # Solo `created_at`: una entrada que se puede modificar ya no es una entrada
        # de auditoría.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_audit_log_usuario_id_usuario"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )

    # ------------------------------------------------------------------
    # Inmutabilidad de la auditoría.
    #
    # Escrito a mano porque el autogenerate no sabe emitir triggers, y porque la
    # spec lo exige como una propiedad del esquema y no como una convención del
    # código: sin esto, cualquier `UPDATE` a `audit_log` pasa.
    # ------------------------------------------------------------------
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION {_AUDIT_LOG_GUARD_FN}() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION
                'audit_log es de solo agregado: % está prohibido', TG_OP
                USING ERRCODE = 'restrict_violation';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {_AUDIT_LOG_GUARD_TRIGGER}
        BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION {_AUDIT_LOG_GUARD_FN}();
        """
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS {_AUDIT_LOG_GUARD_TRIGGER} ON audit_log;")
    op.execute(f"DROP FUNCTION IF EXISTS {_AUDIT_LOG_GUARD_FN}();")

    op.drop_table("override_habilitacion")
    op.drop_table("asistencia")
    op.drop_table("clase")
    op.drop_table("audit_log")
    op.drop_table("factura")
    op.drop_table("imputacion")
    op.drop_table("cobranza")
    op.drop_table("pagador")
    op.drop_table("nomina_empleado")
    op.drop_table("inscripcion")
    op.drop_table("contrato_corporativo")
    op.drop_table("empresa")
    op.drop_index("ix_comision_curso_id", table_name="comision")
    op.drop_table("comision")
    op.drop_table("curso")
    op.drop_table("sede")
    op.drop_table("usuario")
    op.drop_table("docente")
    op.drop_table("alumno")
