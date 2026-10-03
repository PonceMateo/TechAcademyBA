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

    D6: `codigo` y `nombre` guardan el valor tal como lo escribe el operador, que es
    lo que hay que mostrar. `codigo_norm` y `nombre_norm` llevan la forma normalizada
    y son las que tienen el índice único, para que `CUR-101` y `CUR101` colisionen.
    """

    __tablename__ = "curso"
    __table_args__ = (
        UniqueConstraint("codigo_norm", name="uq_curso_codigo_norm"),
        UniqueConstraint("nombre_norm", name="uq_curso_nombre_norm"),
        # Historia #1: el nombre y el código son obligatorios.
        no_vacio("codigo", "curso_codigo_obligatorio"),
        no_vacio("nombre", "curso_nombre_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(50), nullable=False)
    codigo_norm: Mapped[str] = mapped_column(String(50), nullable=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    nombre_norm: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    comisiones: Mapped[list[Comision]] = relationship(back_populates="curso")


class Comision(TimestampMixin, Base):
    """Comisión: un curso que se dicta con un docente, en días y horarios (historias
    #2, #4, #5 y #8).

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
        UniqueConstraint("codigo", name="uq_comision_codigo"),
        # Historia #2: código y días/horarios son parte del alta completa.
        no_vacio("codigo", "comision_codigo_obligatorio"),
        no_vacio("dias_horarios", "comision_dias_horarios_obligatorio"),
        CheckConstraint("cupo_maximo > 0", name="cupo_maximo_positivo"),
        CheckConstraint("arancel > 0", name="arancel_positivo"),
        enum_check("modalidad", Modalidad, "modalidad_valida"),
        # Historia #8: Presencial e Híbrido exigen sede; Virtual no la exige.
        CheckConstraint(
            "modalidad = 'VIRTUAL' OR sede_id IS NOT NULL",
            name="modalidad_presencial_requiere_sede",
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
    codigo: Mapped[str] = mapped_column(String(50), nullable=False)
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
