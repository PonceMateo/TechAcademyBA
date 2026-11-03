"""Comprobante de pago que envía el alumno (HU 52).

**No es una cobranza.** Una cobranza es un hecho contable acreditado que impacta en la
habilitación; esto es la declaración del alumno esperando revisión de Secretaría. Por eso vive en
su propia tabla, no tiene clave foránea a `cobranza` y no crea pagador ni imputación.

`titular` nulo significa **no identificado**: no se completa con el nombre del alumno porque el
comprobante puede haberlo pagado un familiar o una empresa.

`PENDIENTE_CARGA` es el estado técnico mientras el archivo se sube; el estado inicial visible es
`PENDIENTE_REVISION` y se alcanza recién después de verificar el contenido almacenado.

**La resolución es de Secretaría (HU 54).** `ACEPTADO` guarda la `cobranza` que se creó, para que
un comprobante no pueda acreditarse dos veces; `OBSERVADO` y `RECHAZADO` guardan el motivo
obligatorio, quién resolvió y cuándo. El reenvío de un observado es una fila nueva que apunta al
original con `comprobante_origen_id`, que también es único: un original se reenvía una sola vez.
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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.catalogo import MONEY
from app.models.enums import EstadoComprobanteAlumno, MedioPago, enum_check
from app.models.inscripciones import EXPRESION_CUIT_VALIDO

if TYPE_CHECKING:
    from app.models.cobranza import Cobranza
    from app.models.inscripciones import Inscripcion
    from app.models.padron import Alumno, Usuario

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
        # Una resolución siempre queda con su autor y su fecha: sin eso no hay auditoría.
        CheckConstraint(
            "(revisado_por IS NULL) = (revisado_at IS NULL)", name="revision_registro_completo"
        ),
        # La misma regla de la causa de la cobranza (D28): observar o rechazar exige decir por qué.
        CheckConstraint(
            "estado NOT IN ('OBSERVADO', 'RECHAZADO')"
            " OR (motivo IS NOT NULL AND motivo ~ '[^[:space:]]')",
            name="motivo_obligatorio",
        ),
        # `ACEPTADO` es el único estado que acredita dinero y, por lo tanto, el único con cobranza.
        CheckConstraint(
            "(estado = 'ACEPTADO') = (cobranza_id IS NOT NULL)", name="cobranza_solo_si_aceptado"
        ),
        # La unicidad es la garantía de que un comprobante no genera dos cobranzas, incluso si dos
        # administradores lo aceptan a la vez.
        UniqueConstraint("cobranza_id", name="uq_comprobante_alumno_cobranza_id"),
        UniqueConstraint(
            "comprobante_origen_id", name="uq_comprobante_alumno_comprobante_origen_id"
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
    #: HU 54: cobranza acreditada que generó la aceptación. Nula en cualquier otro estado.
    cobranza_id: Mapped[int | None] = mapped_column(
        ForeignKey("cobranza.id", ondelete="RESTRICT"), nullable=True
    )
    #: Quién resolvió el comprobante y cuándo. Es la auditoría mínima exigida por la HU.
    revisado_por: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True
    )
    revisado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Por qué se observó o rechazó. Obligatorio en esos estados.
    motivo: Mapped[str | None] = mapped_column(Text)
    #: Reenvío de un comprobante observado: apunta al original, que conserva su historial.
    comprobante_origen_id: Mapped[int | None] = mapped_column(
        ForeignKey("comprobante_alumno.id", ondelete="RESTRICT"), nullable=True
    )

    alumno: Mapped[Alumno] = relationship()
    inscripcion: Mapped[Inscripcion] = relationship()
    cobranza: Mapped[Cobranza | None] = relationship()
    revisor: Mapped[Usuario | None] = relationship(foreign_keys=[revisado_por])
