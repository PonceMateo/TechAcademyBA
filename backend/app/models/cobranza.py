"""Pagador, cobranza, imputación y factura (4.4).

D7: `Imputacion` tiene destino único (`num_nonnulls(...) = 1`) y está preparada para
que aparezca `Cuota` en una migración posterior.
D8: el saldo no imputado se valida en servicio, no en base, porque abarca filas de otra
tabla.
D10: ni el saldo ni las vacantes son columnas.
D28: la causa es obligatoria cuando la cobranza no está acreditada.
D29: se registran la factura A y la factura B.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.catalogo import MONEY
from app.models.enums import (
    EstadoCobranza,
    MedioPago,
    OrigenCobranza,
    TipoFactura,
    enum_check,
)

if TYPE_CHECKING:
    # Solo para el linter. En tiempo de ejecución, SQLAlchemy resuelve estas relaciones
    # por nombre de clase dentro del registro de `Base.metadata`.
    from app.models.inscripciones import Empresa, Inscripcion
    from app.models.padron import Alumno


class Pagador(TimestampMixin, Base):
    """Persona o entidad que efectuó el pago (historia #22).

    El pagador **no** es un alumno ni se incorpora al padrón: los comprobantes llegan
    a nombre de padres, familiares o empresas. Por eso no tiene columna `activo` ni
    documento único: `design.md` deja abierta la pregunta de si se deduplica por
    documento o se crea un registro por cobranza, y no se la resuelve acá.
    """

    __tablename__ = "pagador"
    __table_args__ = (
        CheckConstraint(
            "documento_norm IS NULL OR documento_norm ~ '^[0-9]{7,11}$'",
            name="pagador_documento_formato",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    documento: Mapped[str | None] = mapped_column(String(20))
    documento_norm: Mapped[str | None] = mapped_column(String(20))

    cobranzas: Mapped[list[Cobranza]] = relationship(back_populates="pagador")


class Cobranza(TimestampMixin, Base):
    """Cobranza con estado auditado (historias #21, #22, #24 y #45)."""

    __tablename__ = "cobranza"
    __table_args__ = (
        enum_check("medio", MedioPago, "medio_pago_valido"),
        enum_check("origen", OrigenCobranza, "origen_cobranza_valido"),
        enum_check("estado", EstadoCobranza, "estado_cobranza_valido"),
        CheckConstraint("importe > 0", name="cobranza_importe_positivo"),
        # La fecha de una cobranza no puede ser futura (historia #21).
        CheckConstraint("fecha <= CURRENT_DATE", name="cobranza_fecha_no_futura"),
        # D28 / historia #45: un comprobante que no está acreditado dice por qué. Sin
        # la causa, un comprobante ilegible y una mora de tres meses son indistinguibles.
        # La expresión es una clase de carácter y no `btrim` porque `btrim` solo recorta
        # espacios: una causa que sea un tabulador o un salto de línea también está vacía.
        CheckConstraint(
            "estado = 'ACREDITADO' OR (causa IS NOT NULL AND causa ~ '[^[:space:]]')",
            name="causa_obligatoria_si_no_acreditado",
        ),
        # Historia #24: el cambio de estado queda con su autor y su fecha.
        CheckConstraint(
            "(estado_cambiado_por IS NULL) = (estado_cambiado_at IS NULL)",
            name="estado_cambiado_registro_completo",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    importe: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    medio: Mapped[str] = mapped_column(String(20), nullable=False)
    origen: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=OrigenCobranza.MANUAL.value
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=EstadoCobranza.ACREDITADO.value
    )
    #: Por qué el comprobante no está acreditado. Obligatoria si `estado` no es
    #: ACREDITADO. La historia #45 la cubre; la delega es el equipo.
    causa: Mapped[str | None] = mapped_column(Text)
    pagador_id: Mapped[int | None] = mapped_column(
        ForeignKey("pagador.id", ondelete="RESTRICT"), nullable=True
    )
    estado_cambiado_por: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True
    )
    estado_cambiado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    pagador: Mapped[Pagador] = relationship(back_populates="cobranzas")
    imputaciones: Mapped[list[Imputacion]] = relationship(back_populates="cobranza")


class Imputacion(TimestampMixin, Base):
    """Imputación de una cobranza a una inscripción o a una empresa (historia #23).

    D7: el destino es único. Cuando llegue `Cuota` se agrega `cuota_id` nula y se
    relaja el CHECK a `num_nonnulls(inscripcion_id, empresa_id, cuota_id) = 1`, que
    es una migración aditiva que no rompe datos ni referencias.

    El saldo no imputado se deriva de `importe` menos la suma de las imputaciones y
    **no** es una columna (D10). La regla de que la suma no supere el importe se
    valida en el servicio, con lock de fila (D8).
    """

    __tablename__ = "imputacion"
    __table_args__ = (
        CheckConstraint("monto > 0", name="imputacion_monto_positivo"),
        CheckConstraint(
            "num_nonnulls(inscripcion_id, empresa_id) = 1",
            name="imputacion_destino_unico",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cobranza_id: Mapped[int] = mapped_column(
        ForeignKey("cobranza.id", ondelete="RESTRICT"), nullable=False
    )
    inscripcion_id: Mapped[int | None] = mapped_column(
        ForeignKey("inscripcion.id", ondelete="RESTRICT"), nullable=True
    )
    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresa.id", ondelete="RESTRICT"), nullable=True
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    cobranza: Mapped[Cobranza] = relationship(back_populates="imputaciones")
    inscripcion: Mapped[Inscripcion] = relationship()
    empresa: Mapped[Empresa] = relationship()


class Factura(TimestampMixin, Base):
    """Factura emitida, de tipo A o B (historias #25 y D29)."""

    __tablename__ = "factura"
    __table_args__ = (
        enum_check("tipo", TipoFactura, "tipo_factura_valido"),
        # Una factura es a un alumno o a una empresa, nunca a los dos ni a ninguno.
        CheckConstraint(
            "num_nonnulls(alumno_id, empresa_id) = 1",
            name="factura_destino_unico",
        ),
        # Historia #25: si no se requiere Factura A no hay seguimiento pendiente.
        CheckConstraint("requerida OR NOT emitida", name="factura_no_requerida_no_emitida"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alumno_id: Mapped[int | None] = mapped_column(
        ForeignKey("alumno.id", ondelete="RESTRICT"), nullable=True
    )
    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresa.id", ondelete="RESTRICT"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(2), nullable=False)
    requerida: Mapped[bool] = mapped_column(Boolean, nullable=False)
    emitida: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    numero: Mapped[str | None] = mapped_column(String(40))

    alumno: Mapped[Alumno] = relationship()
    empresa: Mapped[Empresa] = relationship()
