"""Sede opcional en toda modalidad (historia #8).

**El CHECK de la sede invierte su dirección, no desaparece.** Antes era
`modalidad = 'VIRTUAL' OR sede_id IS NOT NULL`: exigía sede para Presencial e Híbrido. Ahora es
`modalidad <> 'VIRTUAL' OR sede_id IS NULL`: deja de exigirla y pasa a **prohibirla** en Virtual. La
sede es opcional en toda modalidad, y una comisión virtual con `sede_id` es el dato incoherente
que el formulario ni siquiera renderiza. Las dos reglas no son la negación el uno del otro —la
vieja rechazaba `(PRESENCIAL, NULL)`, la nueva rechaza `(VIRTUAL, con sede)`—, así que la
migración no puede ser un `drop` y nada más. La decisión está en `docs/decisions.md` (M35).

**El `UPDATE` va entre el `drop` y el `create` porque el CHECK anterior lo necesitas.** El CHECK
viejo **permitía** virtual con sede, así que sobre cualquier base poblada el
`create_check_constraint` a secas falla: hay una fila que el modelo nuevo no admite. El `UPDATE`
pone en `NULL` la sede de las comisiones `VIRTUAL`, que es exactamente el dato que el CHECK nuevo
prohíbe: no se destruye nada con significado. Hoy la base no tiene datos reales y el `UPDATE` no
toca nada, pero tiene que estar escrito igual, porque la migración tiene que aplicar sobre
cualquier base.

**El `downgrade` falla si los datos no bancan la restricción vieja, y no repara nada a mano.**
Restaura el CHECK anterior, que vuelve a exigir sede para Presencial e Híbrido. Si quedan
comisiones presenciales sin sede —que es lo que este change abre— ese
`create_check_constraint` falla con el error de la base, igual que el `downgrade` del CUIL en
`0002_altas_catalogo`: una restricción que los datos incumplen no se puede restaurar, y un
`downgrade` que rellenara sedes inventadas mentiría sobre el estado del esquema. La base de
pruebas nunca llega a ese estado porque cada test descarta su transacción.

**Es una migración que reescribe filas.** Se aplica antes de desplegar el backend nuevo.

Revision ID: 0003_sede_opcional_comision
Revises: 0002_altas_catalogo
Create Date: 2026-10-07
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003_sede_opcional_comision"
down_revision: str | None = "0002_altas_catalogo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: La sede es opcional en toda modalidad y se prohíbe en Virtual.
SEDE_OPCIONAL = "modalidad <> 'VIRTUAL' OR sede_id IS NULL"

#: La regla anterior: sede obligatoria para Presencial e Híbrido.
SEDE_EXIGIDA = "modalidad = 'VIRTUAL' OR sede_id IS NOT NULL"


def upgrade() -> None:
    """Sede opcional. El orden importa: `drop`, `UPDATE`, `create`."""
    op.drop_constraint(
        op.f("ck_comision_modalidad_presencial_requiere_sede"), "comision", type_="check"
    )
    # Sin este `UPDATE` el `create_check_constraint` de abajo revienta sobre cualquier base que
    # tenga una comisión virtual asignada a una sede, que el CHECK viejo sí permitía.
    op.execute("UPDATE comision SET sede_id = NULL WHERE modalidad = 'VIRTUAL'")
    op.create_check_constraint(
        op.f("ck_comision_modalidad_virtual_sin_sede"), "comision", SEDE_OPCIONAL
    )


def downgrade() -> None:
    """Vuelve a exigir sede para Presencial e Híbrido, y falla si los datos no lo bancan.

    **No hay `UPDATE` que deshaga el de arriba, y no es un olvido.** La sede de una comisión
    `VIRTUAL` que tenía antes del `upgrade` no se puede reconstruir: se puso en `NULL` y no
    quedó registro de cuál era. La única forma de "revertirla" sería inventarle una sede, que
    es justo lo que este `downgrade` no hace. Por eso la reversión es la del `CUIL` en
    `0002_altas_catalogo`: restaura la restricción y deja que la base la rechace si los datos
    no la cumplen.
    """
    op.drop_constraint(
        op.f("ck_comision_modalidad_virtual_sin_sede"), "comision", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_comision_modalidad_presencial_requiere_sede"), "comision", SEDE_EXIGIDA
    )
