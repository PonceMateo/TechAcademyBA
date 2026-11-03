"""Comprobante de pago que envía el alumno (HU 52).

**No es una cobranza.** Una cobranza es un hecho contable acreditado que impacta en la
habilitación; esto es la declaración del alumno esperando revisión de Secretaría. Por eso vive en
su propia tabla, no tiene clave foránea a `cobranza` y no crea pagador ni imputación.

`titular` nulo significa **no identificado**: no se completa con el nombre del alumno porque el
comprobante puede haberlo pagado un familiar o una empresa.

`PENDIENTE_CARGA` es el estado técnico mientras el archivo se sube; el estado inicial visible es
`PENDIENTE_REVISION` y se alcanza recién después de verificar el contenido almacenado.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.catalogo import MONEY
from app.models.enums import EstadoComprobanteAlumno, MedioPago, enum_check
from app.models.inscripciones import EXPRESION_CUIT_VALIDO

if TYPE_CHECKING:
    from app.models.inscripciones import Inscripcion
    from app.models.padron import Alumno

#: Tamaño máximo del adjunto: 5 MB. Es el mismo límite que valida la capa de API.
TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024


class ComprobanteAlumno(TimestampMixin, Base):
    """Comprobante enviado por un alumno autenticado (HU 52)."""

    __tablename__ = "comprobante_alumno"
    __table_args__ = (
        enum_check("medio", MedioPago, "medio_pago_valido"),
        enum_check("estado", EstadoComprobanteAlumno, "estado_valido"),
        CheckConstraint("importe > 0", name="importe_positivo"),
        CheckConstraint("fecha_pago <= CURRENT_DATE", name="fecha_no_futura"),
        # El CUIT existe solo cuando se pide Factura A, y con Factura A es obligatorio.
        CheckConstraint(
            "factura_a_solicitada = (cuit_norm IS NOT NULL)", name="cuit_solo_con_factura_a"
        ),
        CheckConstraint("cuit_norm IS NULL OR cuit_norm ~ '^[0-9]{11}$'", name="cuit_formato"),
        CheckConstraint(
            f"cuit_norm IS NULL OR ({EXPRESION_CUIT_VALIDO})", name="cuit_digito"
        ),
        CheckConstraint(
            f"archivo_bytes IS NULL OR archivo_bytes BETWEEN 1 AND {TAMANO_MAXIMO_BYTES}",
            name="archivo_tamano_valido",
        ),
        # El envío existe recién cuando el archivo se verificó: una fila sin `enviado_at` sigue
        # en carga y no se lista como pendiente de revisión.
        CheckConstraint(
            "(estado = 'PENDIENTE_CARGA') = (enviado_at IS NULL)", name="enviado_at_coherente"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alumno_id: Mapped[int] = mapped_column(
        ForeignKey("alumno.id", ondelete="RESTRICT"), nullable=False
    )
    inscripcion_id: Mapped[int] = mapped_column(
        ForeignKey("inscripcion.id", ondelete="RESTRICT"), nullable=False
    )
    fecha_pago: Mapped[date] = mapped_column(Date, nullable=False)
    importe: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    medio: Mapped[str] = mapped_column(String(20), nullable=False)
    titular: Mapped[str | None] = mapped_column(String(160))
    factura_a_solicitada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    cuit: Mapped[str | None] = mapped_column(String(20))
    cuit_norm: Mapped[str | None] = mapped_column(String(20))
    #: Clave generada por el servidor. Nunca se arma con datos del usuario.
    archivo_clave: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    #: Nombre original saneado, solo para la descarga. No se usa como ruta.
    archivo_nombre: Mapped[str | None] = mapped_column(String(200))
    archivo_mime: Mapped[str | None] = mapped_column(String(100))
    archivo_bytes: Mapped[int | None] = mapped_column(Integer)
    archivo_sha256: Mapped[str | None] = mapped_column(String(64))
    estado: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=EstadoComprobanteAlumno.PENDIENTE_CARGA.value
    )
    enviado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    alumno: Mapped[Alumno] = relationship()
    inscripcion: Mapped[Inscripcion] = relationship()
