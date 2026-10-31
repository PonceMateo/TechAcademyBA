"""Catálogo: cursos, sedes y comisiones (4.1).

Restricciones que vienen de las historias #1, #2, #3, #4, #5 y #8, y de D6 (unicidad
tolerante a formato sobre columnas normalizadas).
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, time, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, no_vacio
from app.models.enums import DiaSemana, Modalidad, enum_check

if TYPE_CHECKING:
    # Solo para que el linter resuelva las anotaciones de `relationship`. Importarlo en
    # tiempo de ejecución sería un import circular: `docente` referencia `comision`.
    from app.models.padron import Docente

#: Ancho de los montos: pesos argentinos con dos decimales (spec `domain-schema`,
#: "Convenciones transversales del esquema"). 14 dígitos enteros + 2 decimales.
MONEY = Numeric(14, 2)

#: Expresión de la columna generada `curso.codigo` (D32). Tiene que ser **exactamente**
#: la misma cadena que escribe `alembic/versions/0002_altas_catalogo.py`, porque
#: `alembic check` no compara columnas generadas: si divergen, nadie se entera hasta que
#: un curso con identificador de cuatro dígitos falle su alta.
EXPRESION_CODIGO_CURSO = "'CUR' || lpad(id::text, greatest(3, length(id::text)), '0')"

#: Los horarios de cursada van en la grilla de 15 minutos (historia #48). La base es la red de
#: seguridad del validador de Pydantic, igual que `cupo_maximo` y `arancel`.
EXPRESION_MINUTOS_EN_PASO = (
    "EXTRACT(minute FROM inicio)::integer IN (0, 15, 30, 45) "
    "AND EXTRACT(minute FROM fin)::integer IN (0, 15, 30, 45)"
)

#: La cursada va de 6:00 a 22:00, y las 22:00 se pueden usar como fin (no como inicio).
EXPRESION_HORARIO_EN_RANGO = "inicio >= TIME '06:00' AND fin <= TIME '22:00'"

#: Historia #49 (D62): el período se declara con sus dos fechas. El legado con `fecha_inicio`
#: sola se permite; lo que no se permite es un fin sin inicio o anterior al inicio.
EXPRESION_PERIODO = "fecha_fin IS NULL OR (fecha_inicio IS NOT NULL AND fecha_fin >= fecha_inicio)"


class Sede(TimestampMixin, Base):
    """Sede de cursada. La elige la modalidad de la comisión (historias #8 y #46).

    `activo` es la baja lógica: la sede conserva las comisiones que se dictaron ahí.
    """

    __tablename__ = "sede"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_sede_nombre"),
        no_vacio("nombre", "sede_nombre_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    direccion: Mapped[str | None] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class Curso(TimestampMixin, Base):
    """Curso del catálogo (historias #1 y #3).

    D32: el código lo genera el sistema y **no es un dato de entrada**. `codigo` es una
    columna generada y almacenada por la base a partir del identificador de la fila, que
    ya es autoincremental y nunca se reutiliza. El operador no lo carga y el `INSERT` que
    lo informe es rechazado por PostgreSQL.

    El `greatest` de `EXPRESION_CODIGO_CURSO` no es cosmético: `lpad` trunca cuando el texto
    es más largo que el largo pedido, así que sin él el curso 1000 recibiría `CUR100`, que ya
    es del curso 100, y su alta fallaría por una causa que el error no señala.

    D6 y D32: `nombre` guarda el valor tal como lo escribe el operador, que es lo que hay
    que mostrar, y `nombre_norm` lleva la forma normalizada y es la que tiene el índice
    único, para que `"Curso Python"` y `"curso  de  python"` colisionen. El código **no**
    tiene columna normalizada: un valor generado no tiene dos representaciones que puedan
    diferir.
    """

    __tablename__ = "curso"
    __table_args__ = (
        UniqueConstraint("codigo", name="uq_curso_codigo"),
        UniqueConstraint("nombre_norm", name="uq_curso_nombre_norm"),
        # Historia #1: el nombre es obligatorio. El del código se conserva aunque la
        # expresión no pueda producir una cadena vacía: forma parte del conjunto de
        # obligatorios de M4 y `test_migration.py` lo verifica uno por uno.
        no_vacio("codigo", "curso_codigo_obligatorio"),
        no_vacio("nombre", "curso_nombre_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(
        String(50), Computed(EXPRESION_CODIGO_CURSO, persisted=True), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    nombre_norm: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    comisiones: Mapped[list[Comision]] = relationship(back_populates="curso")


class Comision(TimestampMixin, Base):
    """Comisión: un curso que se dicta con un docente, en días y horarios (historias
    #2, #4, #5 y #8).

    D34: **no hay columna `codigo`**. Lo que hay es `numero`, incremental por curso, y el
    código se compone con el del curso a través de la propiedad `codigo`. No es una columna
    porque no hay nada que el operador escriba ni nada que pueda quedar viejo: si el curso
    cambiara de código, el derivado cambiaría solo.

    D10: las vacantes NO son una columna. Se derivan de `cupo_maximo` menos la
    cantidad de inscripciones activas, porque una columna persistida se
    desincroniza apenas alguien inscribe.

    No tiene columna `estado`: `design.md` (Gaps abiertos, #14) deja constancia de que
    los siete estados de comisión que tiene la planilla del cliente no se modelan
    porque ninguna historia Must ni Should los necesita. La baja lógica va con
    `activo`.

    Historia #49 (D62): el período de cursada son `fecha_inicio` y `fecha_fin`, nulas en el
    legado. La cantidad de clases no es una columna: se deriva en `cantidad_clases` con los días
    de cursada, para que el alta, la edición y el prorrateo de la H/U 50 cuenten igual.
    """

    __tablename__ = "comision"
    __table_args__ = (
        # El único real es `(curso_id, numero)`: dos cursos distintos pueden tener ambos el
        # número 1 sin colisionar, porque el código derivado ya incluye el curso.
        UniqueConstraint("curso_id", "numero", name="uq_comision_curso_numero"),
        # Historia #2: los días/horarios son parte del alta completa.
        no_vacio("dias_horarios", "comision_dias_horarios_obligatorio"),
        CheckConstraint("numero > 0", name="numero_positivo"),
        CheckConstraint("cupo_maximo > 0", name="cupo_maximo_positivo"),
        CheckConstraint("arancel > 0", name="arancel_positivo"),
        enum_check("modalidad", Modalidad, "modalidad_valida"),
        # Historia #49: el fin no puede quedar antes del inicio ni sin inicio.
        CheckConstraint(EXPRESION_PERIODO, name="periodo_coherente"),
        # Historia #8: la sede es **opcional en toda modalidad**. Este CHECK no la pide en ningún
        # caso: lo que hace es prohibirla en Virtual, donde una `sede_id` es el dato incoherente
        # que el formulario ni siquiera renderiza.
        CheckConstraint(
            "modalidad <> 'VIRTUAL' OR sede_id IS NULL",
            name="modalidad_virtual_sin_sede",
        ),
        Index("ix_comision_curso_id", "curso_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curso_id: Mapped[int] = mapped_column(
        ForeignKey("curso.id", ondelete="RESTRICT"), nullable=False
    )
    docente_id: Mapped[int | None] = mapped_column(
        ForeignKey("docente.id", ondelete="SET NULL"), nullable=True
    )
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    dias_horarios: Mapped[str] = mapped_column(String(255), nullable=False)
    cupo_maximo: Mapped[int] = mapped_column(Integer, nullable=False)
    arancel: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    modalidad: Mapped[str] = mapped_column(String(20), nullable=False)
    sede_id: Mapped[int | None] = mapped_column(
        ForeignKey("sede.id", ondelete="RESTRICT"), nullable=True
    )
    fecha_inicio: Mapped[date | None] = mapped_column(Date)
    fecha_fin: Mapped[date | None] = mapped_column(Date)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    curso: Mapped[Curso] = relationship(back_populates="comisiones")
    sede: Mapped[Sede] = relationship()
    docente: Mapped[Docente] = relationship()
    # `delete-orphan` para que reemplazar los horarios en la edición borre las filas viejas: la
    # lista que manda el formulario es el estado completo del horario, no un agregado.
    horarios: Mapped[list[ComisionHorario]] = relationship(
        back_populates="comision", cascade="all, delete-orphan"
    )

    @property
    def codigo(self) -> str:
        """El código de la comisión tal como lo ve el operador: `CUR001-1`.

        Vive acá y no en la base porque es una composición del código del curso y del
        número, y las dos cosas ya existen. Lo arma el serializador de la API.
        """
        return f"{self.curso.codigo}-{self.numero}"

    @property
    def docente_nombre(self) -> str | None:
        """Nombre y apellido del docente, o `None` si la comisión todavía no tiene.

        La columna admite docente nulo para poder abrir una comisión antes de que haya
        quién la dicte, así que la tabla de Administración tiene que poder mostrar un guion.
        """
        if self.docente is None:
            return None
        return f"{self.docente.nombre} {self.docente.apellido}"

    @property
    def resumen_horarios(self) -> str:
        """El texto `dias_horarios` derivado de las filas, con el formato del resumen (D2).

        Vive acá y no en el servicio para que el valor que se guarda y el que se devuelve salgan
        de la misma función. Cuando la comisión no tiene filas —una migración que no pudo
        interpretar el texto—, el resumen es el texto original, que es lo que se sigue mostrando.
        """
        if not self.horarios:
            return self.dias_horarios
        return resumen_de_horarios(self.horarios)

    @property
    def cantidad_clases(self) -> int | None:
        """Cuántas clases tiene la comisión en su período (historia #49).

        Es `None` cuando falta alguna de las dos fechas: una comisión heredada no tiene período y
        no se le inventa una cantidad. La cuenta vive en `clases_del_periodo`, la misma función
        que valida el período al guardar y que va a usar el prorrateo de la H/U 50.
        """
        if self.fecha_inicio is None or self.fecha_fin is None:
            return None
        return clases_del_periodo(self.fecha_inicio, self.fecha_fin, self.horarios)

    @property
    def sede_nombre(self) -> str | None:
        """Nombre de la sede de la comisión, o `None` si no tiene ninguna asignada.

        Desde la historia #8 la sede es opcional en toda modalidad, así que el `None` ya no dice
        que la comisión sea virtual: una `Presencial` o una `Híbrido` sin sede también lo devuelven,
        y es el caso común. En `Virtual` el CHECK `modalidad_virtual_sin_sede` garantiza que siempre
        sea `None`, porque es la única combinación que la base prohíbe.
        """
        return self.sede.nombre if self.sede is not None else None


#: Rótulo de cada día tal como se ve en el resumen del horario y en los chips del formulario.
ROTULO_DIA = {
    DiaSemana.LUN: "Lun",
    DiaSemana.MAR: "Mar",
    DiaSemana.MIE: "Mié",
    DiaSemana.JUE: "Jue",
    DiaSemana.VIE: "Vie",
    DiaSemana.SAB: "Sáb",
    DiaSemana.DOM: "Dom",
}

#: El orden de la semana, que es el de los miembros de `DiaSemana`. Se usa para ordenar los
#: grupos del resumen y las filas que devuelve la API.
ORDEN_DIA = {dia: posicion for posicion, dia in enumerate(DiaSemana)}


class ComisionHorario(TimestampMixin, Base):
    """Un día de cursada de una comisión, con su rango horario (historia #48).

    **Una fila por día y por comisión**: dos rangos del mismo día no se modelan porque el
    formulario carga uno solo, y porque sin esa unicidad dos rangos del mismo día podrían pisarse
    y nadie lo notaría hasta que un alumno tuviera dos clases al mismo tiempo.

    `dias_horarios`, en `Comision`, sobrevive como texto **derivado** de estas filas (D2): lo
    escribe el servicio cada vez que guarda horarios, y es lo que siguen leyendo los listados.
    """

    __tablename__ = "comision_horario"
    __table_args__ = (
        UniqueConstraint("comision_id", "dia", name="uq_comision_horario_comision_id_dia"),
        enum_check("dia", DiaSemana, "dia_valido"),
        CheckConstraint(EXPRESION_MINUTOS_EN_PASO, name="minutos_en_paso"),
        CheckConstraint(EXPRESION_HORARIO_EN_RANGO, name="en_rango_horario"),
        CheckConstraint("fin > inicio", name="fin_despues_del_inicio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comision_id: Mapped[int] = mapped_column(
        ForeignKey("comision.id", ondelete="CASCADE"), nullable=False
    )
    dia: Mapped[str] = mapped_column(String(3), nullable=False)
    inicio: Mapped[time] = mapped_column(Time, nullable=False)
    fin: Mapped[time] = mapped_column(Time, nullable=False)

    comision: Mapped[Comision] = relationship(back_populates="horarios")


def _hora_del_resumen(valor: time) -> str:
    """La hora sin minutos cuando valen cero: `19` y no `19:00`, `18:15` cuando no."""
    if valor.minute == 0:
        return f"{valor.hour}"
    return f"{valor.hour}:{valor.minute:02d}"


def resumen_de_horarios(horarios: Iterable[ComisionHorario]) -> str:
    """El texto del horario: días con igual rango agrupados, en orden de semana.

    Es la misma función que usan la columna `HORARIO` de la tabla y los chips del formulario, así
    que el texto guardado no puede decir algo distinto de lo que se ve. Ejemplos:
    `Lun y Mié 19-21hs`, `Mar 18:15-21:30hs`, `Lun 19-21hs, Mié 18:15-21:30hs`.
    """
    grupos: dict[tuple[time, time], list[DiaSemana]] = {}
    for horario in horarios:
        grupos.setdefault((horario.inicio, horario.fin), []).append(DiaSemana(horario.dia))

    partes = []
    for (inicio, fin), dias in sorted(
        grupos.items(), key=lambda grupo: min(ORDEN_DIA[dia] for dia in grupo[1])
    ):
        # `Lun y Mié` con dos días, `Lun, Mié y Vie` con más: encadenar `y` entre siete días se lee
        # peor que la lista.
        nombres = [ROTULO_DIA[dia] for dia in sorted(dias, key=ORDEN_DIA.__getitem__)]
        etiqueta = nombres[0] if len(nombres) == 1 else f"{', '.join(nombres[:-1])} y {nombres[-1]}"
        partes.append(f"{etiqueta} {_hora_del_resumen(inicio)}-{_hora_del_resumen(fin)}hs")
    return ", ".join(partes)


def clases_del_periodo(
    inicio: date, fin: date, horarios: Iterable[ComisionHorario]
) -> int:
    """Cantidad de clases del período: días del rango que caen en un día de cursada.

    El rango se cuenta con sus **dos extremos incluidos**, así que una comisión de un solo día
    que cae en un día de cursada tiene una clase. Se miran los días de la semana de los horarios,
    no las filas: dos rangos del mismo día no se modelan (historia #48). Un fin anterior al inicio
    devuelve 0, y es la validación del período la que lo rechaza antes de guardar.

    Recorre día por día, que para un cuatrimestre son decenas de iteraciones y deja la regla
    legible; si el volumen llegara a importar, se reemplaza por aritmética de semanas sin tocar
    el contrato.
    """
    dias = {ORDEN_DIA[DiaSemana(horario.dia)] for horario in horarios}
    cantidad = 0
    fecha = inicio
    while fecha <= fin:
        if fecha.weekday() in dias:
            cantidad += 1
        fecha += timedelta(days=1)
    return cantidad
