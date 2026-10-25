"""Horarios de cursada estructurados por comisión (historia #48).

**`comision.dias_horarios` no se toca.** Sigue siendo la columna de texto que leen los listados;
desde este change su valor lo escribe el backend a partir de las filas. Por eso el `downgrade` es
un `drop_table` y nada más: revertir no puede perder el horario de ninguna comisión, ni siquiera el
de las que esta migración no pudo interpretar.

**La conversión es defensiva y se queda corta a propósito.** El parser acepta los textos que el
formulario permitía escribir —días completos o abreviados, con o sin acento, separados por `y` o
coma, y un rango con `a`, `-` o espacio, con `hs` opcional— y descarta todo lo demás: un texto sin
rango («Sábados intensivo»), uno con dos rangos, un día repetido, minutos fuera de la grilla de 15 o
horas fuera de 6:00–22:00. Descartar no es perder el dato: la comisión se queda con su texto y sin
filas, y el operador carga el horario con el selector.

**La guarda antes de insertar no es paranoia.** La tabla tiene CHECK de minutos, de rango, de
`fin > inicio` y `UNIQUE(comision_id, dia)`. Un solo texto raro del historial que el parser aceptara
sin cumplirlas dejaría el `upgrade head` a mitad de camino en todos los entornos, que es el único
punto de este change donde un dato de entrada puede tumbar un deploy. Por eso el parser valida
contra las mismas reglas antes de devolver una fila.

Las expresiones de los CHECK son **las mismas cadenas** que declara
`app/models/catalogo.py`: si divergen, `alembic check` no lo ve (no compara CHECK), y la base
rechazaría un valor que el modelo cree válido.

Revision ID: 0005_comision_horario
Revises: 0004_cobranza_factura_a
Create Date: 2026-10-24
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from datetime import time

import sqlalchemy as sa
from alembic import op

revision: str = "0005_comision_horario"
down_revision: str | None = "0004_cobranza_factura_a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Mismas cadenas que `app/models/catalogo.py`.
EXPRESION_MINUTOS_EN_PASO = (
    "EXTRACT(minute FROM inicio)::integer IN (0, 15, 30, 45) "
    "AND EXTRACT(minute FROM fin)::integer IN (0, 15, 30, 45)"
)
EXPRESION_HORARIO_EN_RANGO = "inicio >= TIME '06:00' AND fin <= TIME '22:00'"
EXPRESION_DIA_VALIDO = "dia IN ('LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM')"

#: Días con sus formas completa y abreviada, y en plural las que existen («sábados»).
_DIAS = {
    "lun": "LUN",
    "lunes": "LUN",
    "mar": "MAR",
    "martes": "MAR",
    "mie": "MIE",
    "miercoles": "MIE",
    "jue": "JUE",
    "jueves": "JUE",
    "vie": "VIE",
    "viernes": "VIE",
    "sab": "SAB",
    "sabado": "SAB",
    "dom": "DOM",
    "domingo": "DOM",
}

#: Un rango: hora de inicio, dos puntos y minutos opcionales, separador y hora de fin. Las horas
#: pueden venir sin minutos («19 a 21»), que es como las escribía la secretaría.
_PATRON_RANGO = re.compile(
    r"(\d{1,2})(?::(\d{2}))?\s*(?:hs?\.?|hrs?\.?)?\s*(?:a|al|-|–|—|hasta)\s*"
    r"(\d{1,2})(?::(\d{2}))?"
)

#: Separadores entre días: «Lun y Mié», «Lunes, miércoles y viernes», «Lun/Mié». Se separa por
#: cualquier espacio o coma y después se descartan los conectores.
_PATRON_SEPARADOR_DIAS = re.compile(r"[\s,;/]+")

#: Palabras que no son días y no cambian el sentido: «Lunes de 9 a 12», «todos los martes».
#: No son un comodín: un token que no esté acá ni en `_DIAS` descarta la conversión.
_RELLENO = {"y", "e", "de", "del", "los", "las", "todos", "todas", "cada"}

_HORA_MINIMA = time(6, 0)
_HORA_MAXIMA = time(22, 0)
_PASOS_DE_MINUTOS = {0, 15, 30, 45}


def _normalizar(texto: str) -> str:
    """Minúsculas y sin acentos: `Mié` y `Mie` son el mismo día."""
    sin_acentos = unicodedata.normalize("NFD", texto)
    return "".join(letra for letra in sin_acentos if unicodedata.category(letra) != "Mn").lower()


def _dia_del_token(token: str) -> str | None:
    """El código del día, o `None` si el token no es un día de la semana."""
    if token in _DIAS:
        return _DIAS[token]
    # «sábados» y «domingos»: el plural se reconoce sacando la `s` final. «miércoles» y «jueves»
    # ya están contemplados en singular.
    if token.endswith("s") and token[:-1] in _DIAS:
        return _DIAS[token[:-1]]
    return None


def _hora(valor: str, minutos: str | None) -> time | None:
    """La hora del texto, o `None` si no es una hora que la tabla acepte.

    Acá es donde se descarta lo que rompería los CHECK: minutos fuera de la grilla de 15 y horas
    fuera de 6:00–22:00.
    """
    hora = int(valor)
    minuto = int(minutos) if minutos else 0
    if minuto not in _PASOS_DE_MINUTOS or not 0 <= hora <= 23:
        return None
    resultado = time(hora, minuto)
    if resultado < _HORA_MINIMA or resultado > _HORA_MAXIMA:
        return None
    return resultado


def convertir_texto(texto: str) -> list[tuple[str, time, time]]:
    """Las filas de horario que el texto representa, o una lista vacía si no se puede leer.

    Conviene que devuelva la lista vacía en vez de levantar: una comisión con un texto raro no
    puede frenar la migración, y el spec dice que se queda con su texto y sin filas.
    """
    normalizado = _normalizar(texto or "")
    rangos = list(_PATRON_RANGO.finditer(normalizado))
    # Más de un rango en el mismo texto es el caso de «Lun 19 a 21 y Mar 18 a 20»: no hay una
    # forma de adivinar dónde termina un día y empieza el otro sin inventar.
    if len(rangos) != 1:
        return []

    rango = rangos[0]
    parte_dias = normalizado[: rango.start()]
    inicio = _hora(rango.group(1), rango.group(2))
    fin = _hora(rango.group(3), rango.group(4))
    if inicio is None or fin is None or inicio >= fin:
        return []

    tokens = [
        token
        for token in _PATRON_SEPARADOR_DIAS.split(parte_dias)
        if token and token not in _RELLENO
    ]
    dias: list[str] = []
    for token in tokens:
        dia = _dia_del_token(token)
        if dia is None:
            return []
        if dia in dias:
            # Dos veces el mismo día: la tabla solo admite una fila por día y día.
            return []
        dias.append(dia)

    return [(dia, inicio, fin) for dia in dias]


def upgrade() -> None:
    """Crea la tabla y convierte los textos existentes. El texto original nunca cambia."""
    op.create_table(
        "comision_horario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("comision_id", sa.Integer(), nullable=False),
        sa.Column("dia", sa.String(length=3), nullable=False),
        sa.Column("inicio", sa.Time(), nullable=False),
        sa.Column("fin", sa.Time(), nullable=False),
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
            ["comision_id"],
            ["comision.id"],
            name=op.f("fk_comision_horario_comision_id_comision"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comision_horario")),
        sa.UniqueConstraint("comision_id", "dia", name=op.f("uq_comision_horario_comision_id_dia")),
        sa.CheckConstraint(
            EXPRESION_DIA_VALIDO, name=op.f("ck_comision_horario_dia_valido")
        ),
        sa.CheckConstraint(
            EXPRESION_MINUTOS_EN_PASO, name=op.f("ck_comision_horario_minutos_en_paso")
        ),
        sa.CheckConstraint(
            EXPRESION_HORARIO_EN_RANGO, name=op.f("ck_comision_horario_en_rango_horario")
        ),
        sa.CheckConstraint(
            "fin > inicio", name=op.f("ck_comision_horario_fin_despues_del_inicio")
        ),
    )

    conexion = op.get_bind()
    comisiones = conexion.execute(sa.text("SELECT id, dias_horarios FROM comision ORDER BY id"))

    for comision_id, texto in comisiones.all():
        horarios = convertir_texto(texto)
        if not horarios:
            continue
        conexion.execute(
            sa.text(
                """
                INSERT INTO comision_horario (comision_id, dia, inicio, fin)
                VALUES (:comision_id, :dia, :inicio, :fin)
                """
            ),
            [
                {"comision_id": comision_id, "dia": dia, "inicio": inicio, "fin": fin}
                for dia, inicio, fin in horarios
            ],
        )


def downgrade() -> None:
    """Elimina la tabla. `dias_horarios` queda como estaba: la reversión no pierde el horario."""
    op.drop_table("comision_horario")
