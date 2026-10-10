"""Catálogo: cursos, sedes y comisiones (4.1).

Restricciones que vienen de las historias #1, #2, #3, #4, #5 y #8, y de D6 (unicidad
tolerante a formato sobre columnas normalizadas).
"""

from __future__ import annotations

from datetime import date
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
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, no_vacio
from app.models.enums import Modalidad, enum_check

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
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    curso: Mapped[Curso] = relationship(back_populates="comisiones")
    sede: Mapped[Sede] = relationship()
    docente: Mapped[Docente] = relationship()

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
    def sede_nombre(self) -> str | None:
        """Nombre de la sede de la comisión, o `None` si no tiene ninguna asignada.

        Desde la historia #8 la sede es opcional en toda modalidad, así que el `None` ya no dice
        que la comisión sea virtual: una `Presencial` o una `Híbrido` sin sede también lo devuelven,
        y es el caso común. En `Virtual` el CHECK `modalidad_virtual_sin_sede` garantiza que siempre
        sea `None`, porque es la única combinación que la base prohíbe.
        """
        return self.sede.nombre if self.sede is not None else None
