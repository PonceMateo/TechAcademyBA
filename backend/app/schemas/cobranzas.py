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

#: Titular que guarda la pantalla cuando el comprobante no lo trae. Es el único caso en el que se
#: puede completar el titular después de registrada la cobranza.
TITULAR_SIN_IDENTIFICAR = "Sin identificar"


class ImputacionCreate(BaseModel):
    """Un destino y su monto dentro de una cobranza (HU 23).

    D7: el destino es único. `inscripcion_id` imputa a un alumno y `empresa_id` a la cuenta
    corporativa; nunca los dos ni ninguno. El monto lo valida el servicio contra el saldo.
    """

    model_config = ConfigDict(extra="forbid")

    inscripcion_id: int | None = Field(default=None, gt=0)
    empresa_id: int | None = Field(default=None, gt=0)
    monto: Decimal

    @field_validator("monto")
    @classmethod
    def _monto_positivo(cls, valor: Decimal) -> Decimal:
        if valor <= 0:
            raise ValueError("El importe imputado tiene que ser mayor a cero.")
        return valor

    @model_validator(mode="after")
    def _destino_unico(self) -> ImputacionCreate:
        if (self.inscripcion_id is None) == (self.empresa_id is None):
            raise ValueError("Cada imputación va a una inscripción o a una empresa, no a ambas.")
        return self


def _validar_distribucion(importe: Decimal, imputaciones: list[ImputacionCreate]) -> None:
    """Reglas de la distribución que no dependen de la base: monto total y destinos repetidos."""
    suma = sum((item.monto for item in imputaciones), Decimal("0"))
    if suma > importe:
        raise ValueError("La suma de las imputaciones no puede superar el importe cobrado.")
    destinos = [
        ("inscripcion", item.inscripcion_id)
        if item.inscripcion_id is not None
        else ("empresa", item.empresa_id)
        for item in imputaciones
    ]
    if len(set(destinos)) != len(destinos):
        raise ValueError("No se puede imputar dos veces al mismo destino en una cobranza.")


class CobranzaCreate(BaseModel):
    """Cuerpo de `POST /cobranzas`.

    La imputación tiene tres formas: `alumno_id`/`inscripcion_id` imputa el importe completo a un
    alumno (HU 21); `imputaciones` reparte el importe entre varios destinos (HU 23); sin ninguno
    de los dos la cobranza queda sin imputar y se reparte después.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fecha: date
    importe: Decimal
    medio: MedioPago
    titular: str = Field(min_length=1, max_length=160)
    estado: EstadoCobranza = EstadoCobranza.ACREDITADO
    causa: str | None = None
    alumno_id: int | None = Field(default=None, gt=0)
    inscripcion_id: int | None = Field(default=None, gt=0)
    imputaciones: list[ImputacionCreate] | None = Field(default=None, min_length=1)
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
            raise ValueError("La causa es obligatoria cuando el comprobante no está acreditado.")
        if self.imputaciones is not None:
            if self.alumno_id is not None or self.inscripcion_id is not None:
                raise ValueError(
                    "Elegí una forma de imputar: un alumno o una distribución entre varios."
                )
            _validar_distribucion(self.importe, self.imputaciones)
        if self.factura_a_solicitada:
            if self.cuit_titular is None or not cuit_es_valido(self.cuit_titular):
                raise ValueError("La Factura A requiere un CUIT válido del titular.")
        elif self.cuit_titular is not None and not cuit_es_valido(self.cuit_titular):
            raise ValueError("El CUIT del titular no es válido.")
        return self


class ImputacionesCreate(BaseModel):
    """Cuerpo de `POST /cobranzas/{id}/imputaciones` (HU 23).

    Solo se reparte el saldo que quedó sin imputar; el total se valida en el servicio, con la
    cobranza bloqueada, porque depende de las imputaciones ya guardadas.
    """

    model_config = ConfigDict(extra="forbid")

    imputaciones: list[ImputacionCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def _destinos_repetidos(self) -> ImputacionesCreate:
        destinos = [
            item.inscripcion_id if item.inscripcion_id is not None else item.empresa_id
            for item in self.imputaciones
        ]
        if len(set(destinos)) != len(destinos):
            raise ValueError("No se puede imputar dos veces al mismo destino.")
        return self


class CobranzaEstadoUpdate(BaseModel):
    """Cuerpo de `PATCH /cobranzas/{id}/estado` (HU 21, ampliación).

    El estado nuevo no se restringe acá porque la validez depende del estado actual de la
    cobranza: la matriz de transiciones se valida en el servicio. La justificación es obligatoria
    porque el cambio de estado es una corrección de un dato ya registrado.

    `estado` y `titular` son opcionales, pero hay que mandar al menos uno: el mismo PATCH sirve
    para cambiar el estado, para completar el titular de un comprobante que quedó "Sin
    identificar", o para las dos cosas.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    estado: EstadoCobranza | None = None
    titular: str | None = Field(default=None, max_length=160)
    #: Obligatoria cuando se cambia el estado; opcional si solo se completa el titular.
    justificacion: str | None = Field(default=None, max_length=500)

    @field_validator("titular", "justificacion")
    @classmethod
    def _texto_vacio_es_nulo(cls, valor: str | None) -> str | None:
        if valor is None or valor.strip() == "":
            return None
        return valor

    @model_validator(mode="after")
    def _algo_que_cambiar(self) -> CobranzaEstadoUpdate:
        if self.estado is None and self.titular is None:
            raise ValueError("Indicá el estado nuevo o el titular del comprobante.")
        if self.estado is not None and self.justificacion is None:
            raise ValueError("La justificación es obligatoria cuando se cambia el estado.")
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
    """Destino de la imputación resuelto para la tabla del historial.

    `destino` dice si el monto fue a un alumno o a una empresa, y `nombre` es el beneficiario ya
    resuelto para que la pantalla no tenga que cruzar listados (HU 23).
    """

    id: int
    destino: str
    nombre: str
    inscripcion_id: int | None = None
    monto: Decimal
    alumno_id: int | None = None
    alumno: str | None = None
    empresa_id: int | None = None
    empresa: str | None = None
    comision: ComisionCobranzaOut | None = None


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
    #: Primera imputación, por compatibilidad con la tabla de la HU 21.
    imputacion: ImputacionCobranzaOut | None
    #: Todas las imputaciones de la cobranza, en el orden en que se registraron (HU 23).
    imputaciones: list[ImputacionCobranzaOut] = Field(default_factory=list)
    monto_imputado: Decimal
    saldo_sin_imputar: Decimal


class PagoAlumnoOut(BaseModel):
    """Comprobante tal como lo ve el alumno en su historial (HU 23).

    `importe` es lo que se le imputó a él, no el total del comprobante: un pago repartido entre
    tres alumnos muestra en cada legajo su parte.
    """

    id: int
    fecha: date
    importe: Decimal
    medio: str
    estado: str
    causa: str | None
    pagado_por_tercero: bool
