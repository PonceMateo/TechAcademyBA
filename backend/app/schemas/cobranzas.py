"""Contrato de entrada y salida de cobranzas manuales (HU 21).

Las reglas de negocio se validan acá para que el error llegue como 422 con un texto de interfaz,
y la base las vuelve a sostener con sus CHECKs. El CUIT solo se exige cuando se solicita
Factura A: un pago normal no necesita documento del titular.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import EstadoCobranza, MedioPago
from app.services.normalization import cuit_es_valido

#: La fecha del pago se interpreta en la zona de la academia, no en la del servidor.
ZONA_ACADEMIA = ZoneInfo("America/Argentina/Buenos_Aires")


class CobranzaCreate(BaseModel):
    """Cuerpo de `POST /cobranzas`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fecha: date
    importe: Decimal
    medio: MedioPago
    titular: str = Field(min_length=1, max_length=160)
    estado: EstadoCobranza = EstadoCobranza.ACREDITADO
    causa: str | None = None
    alumno_id: int | None = Field(default=None, gt=0)
    inscripcion_id: int | None = Field(default=None, gt=0)
    factura_a_solicitada: bool = False
    cuit_titular: str | None = Field(default=None, max_length=20)

    @field_validator("fecha")
    @classmethod
    def _fecha_no_futura(cls, valor: date) -> date:
        if valor > datetime.now(ZONA_ACADEMIA).date():
            raise ValueError("La fecha del pago no puede ser futura.")
        return valor

    @field_validator("importe")
    @classmethod
    def _importe_positivo(cls, valor: Decimal) -> Decimal:
        if valor <= 0:
            raise ValueError("El importe cobrado tiene que ser mayor a cero.")
        return valor

    @field_validator("causa")
    @classmethod
    def _causa_vacia_es_nula(cls, valor: str | None) -> str | None:
        if valor is None or valor.strip() == "":
            return None
        return valor

    @model_validator(mode="after")
    def _coherencia(self) -> CobranzaCreate:
        if self.estado != EstadoCobranza.ACREDITADO and self.causa is None:
            raise ValueError(
                "La causa es obligatoria cuando el comprobante no está acreditado."
            )
        if self.factura_a_solicitada:
            if self.cuit_titular is None or not cuit_es_valido(self.cuit_titular):
                raise ValueError("La Factura A requiere un CUIT válido del titular.")
        elif self.cuit_titular is not None and not cuit_es_valido(self.cuit_titular):
            raise ValueError("El CUIT del titular no es válido.")
        return self


class PagadorCobranzaOut(BaseModel):
    """Titular del comprobante tal como quedó guardado."""

    id: int
    nombre: str
    documento: str | None


class ComisionCobranzaOut(BaseModel):
    """Comisión de la inscripción imputada."""

    codigo: str
    nombre: str


class ImputacionCobranzaOut(BaseModel):
    """Destino de la imputación resuelto para la tabla del historial."""

    id: int
    inscripcion_id: int
    monto: Decimal
    alumno_id: int
    alumno: str
    comision: ComisionCobranzaOut


class CobranzaOut(BaseModel):
    """Fila de `GET /cobranzas` y respuesta de `POST /cobranzas`."""

    id: int
    fecha: date
    importe: Decimal
    medio: str
    origen: str
    estado: str
    causa: str | None
    factura_a_solicitada: bool
    #: `"A"` si se solicitó Factura A; `None` si no se emitió ni se solicitó nada.
    factura: str | None
    pagador: PagadorCobranzaOut
    imputacion: ImputacionCobranzaOut | None
