"""Códigos autogenerados y CUIL opcional (historias #1, #2 y #9).

**Por qué tres cosas del esquema cambian y no son un refactor.** El código del curso deja de
ser un dato que el operador carga y pasa a derivarse del identificador de la fila; el código
de la comisión deja de existir como columna y pasa a componerse del código del curso más un
número incremental por curso; y el CUIL del docente deja de ser obligatorio. Las tres cosas
están justificadas en `docs/decisions.md` (D32, D33 y D34) y en el change
`altas-catalogo-docentes`, y las tres **rompen** el contrato de `domain-schema`, por eso hay
migración y no una edición del modelo.

**El `greatest` de la expresión del código no es cosmético.** `lpad(texto, largo, relleno)`
**trunca** cuando el texto ya es más largo que el largo pedido: `lpad('1000', 3, '0')`
devuelve `'100'`. Con la expresión sin `greatest`, el curso con identificador 1000 recibiría
`CUR100`, que ya pertenece al identificador 100, y su alta fallaría contra `uq_curso_codigo`
con un error que no señala la causa. `greatest(3, length(id::text))` mantiene `CUR001` hasta
el 999 y no trunca del 1000 en adelante.

**La expresión vive en la base y no en el servicio**, para que no haya dos verdadades que
puedan desincronizarse: si el `Computed(...)` del modelo y este `GENERATED ALWAYS AS` se
difieren, **nadie se entera**, porque `alembic check` ignora las columnas generadas. La única
red real es `test_codigo_curso.py`, que inserta identificadores 999, 1000 y 1001 y comprueba
que los tres códigos salen distintos.

**El `downgrade` copia los datos antes de perder las columnas.** Reconstruir `curso.codigo`
desde el identificador y `comision.codigo` desde el curso y el número son reconstrucciones
exactas, porque en esa dirección no hay información que perder. Al revés, volver de la
columna `codigo` al identificador sí la perdería: por eso `codigo_norm` se reconstruye
copiando el código, que ya viene en forma canónica y por lo tanto se normaliza a sí mismo.

**El `downgrade` no puede volver a hacer obligatorio el CUIL si hay docentes sin CUIL**, y
falla con el error de la base. Es correcto: una restricción que los datos incumplen no se
puede restaurar. La base de pruebas nunca llega a ese estado porque cada test descarta su
transacción.

Revision ID: 0002_altas_catalogo
Revises: 0001_initial
Create Date: 2026-10-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_altas_catalogo"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Expresión del código del curso: prefijo fijo más el identificador con al menos tres
#: dígitos. `greatest` es lo que evita que `lpad` trunque de 1000 en adelante.
EXPRESION_CODIGO_CURSO = "'CUR' || lpad(id::text, greatest(3, length(id::text)), '0')"

#: CHECK de "obligatorio" de `app/models/base.py`: rechaza la cadena vacía y la de espacios,
#: que `NOT NULL` no rechaza. Se conservan los de `curso.codigo` y `docente` donde aplicar.
NO_VACIO = "~ '[^[:space:]]'"


def upgrade() -> None:
    """Curso: el código pasa a ser generado y se cae la columna normalizada."""
    op.drop_constraint(op.f("uq_curso_codigo_norm"), "curso", type_="unique")
    op.drop_constraint(op.f("ck_curso_curso_codigo_obligatorio"), "curso", type_="check")
    op.drop_column("curso", "codigo_norm")
    op.drop_column("curso", "codigo")
    op.add_column(
        "curso",
        sa.Column(
            "codigo",
            sa.String(length=50),
            sa.Computed(EXPRESION_CODIGO_CURSO, persisted=True),
            nullable=False,
        ),
    )
    # Un valor generado no tiene dos representaciones que puedan diferir, así que el único
    # va directo sobre la columna: la normalizada solo agregaba una superficie donde el
    # INSERT podría escribir una forma y dejar la otra desincronizada (D32).
    op.create_unique_constraint(op.f("uq_curso_codigo"), "curso", ["codigo"])
    op.create_check_constraint(
        op.f("ck_curso_curso_codigo_obligatorio"), "curso", f"codigo {NO_VACIO}"
    )

    """Comisión: se cae el código y entra un número incremental por curso."""
    op.drop_constraint(op.f("uq_comision_codigo"), "comision", type_="unique")
    op.drop_constraint(op.f("ck_comision_comision_codigo_obligatorio"), "comision", type_="check")
    op.drop_column("comision", "codigo")
    # `server_default` solo está para que la columna pueda ser NOT NULL con filas en la
    # tabla; el backfill de abajo la reemplaza y el default se saca enseguida.
    op.add_column(
        "comision",
        sa.Column("numero", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute(
        """
        UPDATE comision SET numero = renumerado.siguiente
        FROM (
            SELECT id, row_number() OVER (PARTITION BY curso_id ORDER BY id) AS siguiente
            FROM comision
        ) AS renumerado
        WHERE comision.id = renumerado.id
        """
    )
    op.alter_column("comision", "numero", server_default=None)
    op.create_check_constraint(
        op.f("ck_comision_numero_positivo"), "comision", "numero > 0"
    )
    op.create_unique_constraint(
        op.f("uq_comision_curso_numero"), "comision", ["curso_id", "numero"]
    )

    """Docente: el CUIL deja de ser obligatorio. El índice único se queda (D33)."""
    op.drop_constraint(op.f("ck_docente_docente_cuil_obligatorio"), "docente", type_="check")
    op.alter_column("docente", "cuil", existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    """Vuelve al esquema de `0001`. Falla si hay docentes sin CUIL, y es lo correcto."""
    op.alter_column("docente", "cuil", existing_type=sa.String(length=20), nullable=False)
    op.create_check_constraint(
        op.f("ck_docente_docente_cuil_obligatorio"), "docente", f"cuil {NO_VACIO}"
    )

    op.drop_constraint(op.f("uq_comision_curso_numero"), "comision", type_="unique")
    op.drop_constraint(op.f("ck_comision_numero_positivo"), "comision", type_="check")
    # El código se reconstruye desde el curso y el número antes de perder el número.
    op.add_column(
        "comision",
        sa.Column("codigo", sa.String(length=50), nullable=False, server_default=""),
    )
    op.execute(
        """
        UPDATE comision SET codigo = curso.codigo || '-' || comision.numero::text
        FROM curso
        WHERE curso.id = comision.curso_id
        """
    )
    op.alter_column("comision", "codigo", server_default=None)
    op.drop_column("comision", "numero")
    op.create_unique_constraint(op.f("uq_comision_codigo"), "comision", ["codigo"])
    op.create_check_constraint(
        op.f("ck_comision_comision_codigo_obligatorio"), "comision", f"codigo {NO_VACIO}"
    )

    op.drop_constraint(op.f("uq_curso_codigo"), "curso", type_="unique")
    op.drop_constraint(op.f("ck_curso_curso_codigo_obligatorio"), "curso", type_="check")
    # El código generado se copia a una columna temporal porque la que se va es la única
    # fuente del valor.
    op.add_column("curso", sa.Column("codigo_previo", sa.String(length=50), nullable=True))
    op.execute("UPDATE curso SET codigo_previo = codigo")
    op.drop_column("curso", "codigo")
    op.add_column("curso", sa.Column("codigo", sa.String(length=50), nullable=False))
    op.add_column("curso", sa.Column("codigo_norm", sa.String(length=50), nullable=False))
    # `CUR001` no tiene separadores ni acentos, así que normaliza a sí mismo: copiar es
    # normalizar, y evita traer la regla de D6 a SQL.
    op.execute("UPDATE curso SET codigo = codigo_previo, codigo_norm = codigo_previo")
    op.drop_column("curso", "codigo_previo")
    op.create_unique_constraint(op.f("uq_curso_codigo_norm"), "curso", ["codigo_norm"])
    op.create_check_constraint(
        op.f("ck_curso_curso_codigo_obligatorio"), "curso", f"codigo {NO_VACIO}"
    )
