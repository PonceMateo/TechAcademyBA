"""Clases, asistencia, override de habilitación y auditoría (4.5).

D9: el override es lo único que guarda un estado de habilitación; el estado en sí se
deriva y no se persiste en `inscripcion`.
Spec `domain-schema`, "Registro de auditoría": el registro es de solo agregado.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import EstadoAsistencia, EstadoHabilitacion, enum_check

if TYPE_CHECKING:
    # Solo para el linter. En tiempo de ejecución, `comision` y `alumno` ya están
    # registrados en el `Base.metadata` cuando se resuelven las relaciones.
    from app.models.catalogo import Comision
    from app.models.padron import Alumno


class Clase(TimestampMixin, Base):
    """Clase de una comisión, con su link virtual (historia #33)."""

    __tablename__ = "clase"
    __table_args__ = (
        CheckConstraint(
            "link_virtual IS NULL OR link_virtual ~ '^https?://[^[:space:]]+$'",
            name="clase_link_virtual_url",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comision_id: Mapped[int] = mapped_column(
        ForeignKey("comision.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    tema: Mapped[str | None] = mapped_column(Text)
    #: Lo carga el docente de la comisión. Solo lo ve el alumno habilitado.
    link_virtual: Mapped[str | None] = mapped_column(Text)

    comision: Mapped[Comision] = relationship()
    asistencias: Mapped[list[Asistencia]] = relationship(back_populates="clase")


class Asistencia(TimestampMixin, Base):
    """Asistencia de un alumno a una clase (historia #34).

    D10: los totales de presentes y ausentes no son columnas, se derivan por consulta.
    """

    __tablename__ = "asistencia"
    __table_args__ = (
        UniqueConstraint("clase_id", "alumno_id", name="uq_asistencia_clase_alumno"),
        enum_check("estado", EstadoAsistencia, "asistencia_estado_valido"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clase_id: Mapped[int] = mapped_column(
        ForeignKey("clase.id", ondelete="RESTRICT"), nullable=False
    )
    alumno_id: Mapped[int] = mapped_column(
        ForeignKey("alumno.id", ondelete="RESTRICT"), nullable=False
    )
    estado: Mapped[str] = mapped_column(String(20), nullable=False)

    clase: Mapped[Clase] = relationship(back_populates="asistencias")
    alumno: Mapped[Alumno] = relationship()


class OverrideHabilitacion(TimestampMixin, Base):
    """Forzaje manual del estado de habilitación de una inscripción (historia #30).

    D9: lo que se guarda es el override, no el estado. Cuando `activo` es falso, el
    estado vuelve a derivarse de la regla automática, y la quita queda registrada en
    `audit_log`.
    """

    __tablename__ = "override_habilitacion"
    __table_args__ = (
        enum_check("estado_forzado", EstadoHabilitacion, "estado_forzado_valido"),
        # Sin motivo no hay forzaje: el motivo es lo que después se muestra al alumno.
        # Clase de carácter y no `btrim`, que solo recorta espacios: un motivo que sea
        # un tabulador o un salto de línea también está vacío.
        CheckConstraint("motivo ~ '[^[:space:]]'", name="override_motivo_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inscripcion_id: Mapped[int] = mapped_column(
        ForeignKey("inscripcion.id", ondelete="RESTRICT"), nullable=False
    )
    estado_forzado: Mapped[str] = mapped_column(String(20), nullable=False)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class AuditLog(Base):
    """Registro de auditoría general: solo agregado e inmutable.

    Solo lleva `created_at`, no `updated_at`: una entrada que se puede modificar ya no
    es una entrada de auditoría. La inmutabilidad la impone un trigger de PostgreSQL
    en la migración inicial, no una convención del código.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True
    )
    accion: Mapped[str] = mapped_column(String(80), nullable=False)
    entidad: Mapped[str] = mapped_column(String(80), nullable=False)
    entidad_id: Mapped[int | None] = mapped_column(Integer)
    detalle: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
