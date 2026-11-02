"""Contrato del comprobante que envía el alumno (HU 52).

El comprobante **no** es una cobranza: el alta solo declara lo que el alumno dice haber pagado y
queda pendiente de revisión. La validación vive acá para que el error llegue como `422` con un
texto de interfaz; la base vuelve a sostener las mismas reglas con sus CHECK.

El CUIT solo se informa con Factura A. Sin Factura A un CUIT presente es un error del formulario,
no un dato que se guarde por las dudas.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import MedioPago
from app.schemas.cobranzas import ZONA_ACADEMIA
from app.services.normalization import cuit_es_valido


class ComprobanteCreate(BaseModel):
    """Cuerpo de `POST /alumno/comprobantes`.

    **No lleva el alumno.** Sale de la cuenta autenticada (D60), así que no hay ningún
    identificador que cambiar para enviar un comprobante a nombre de otro.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    inscripcion_id: int = Field(gt=0)
    fecha_pago: date
    importe: Decimal
    medio: MedioPago
    titular: str | None = Field(default=None, max_length=160)
    factura_a_solicitada: bool = False
    cuit: str | None = Field(default=None, max_length=20)
    #: Nombre que el navegador muestra y el backend guarda como etiqueta de descarga.
    archivo_nombre: str | None = Field(default=None, max_length=200)

    @field_validator("fecha_pago")
    @classmethod
    def _fecha_no_futura(cls, valor: date) -> date:
        if valor > datetime.now(ZONA_ACADEMIA).date():
            raise ValueError("La fecha del pago no puede ser futura.")
        return valor

    @field_validator("importe")
    @classmethod
    def _importe_positivo(cls, valor: Decimal) -> Decimal:
        if valor <= 0:
            raise ValueError("El importe tiene que ser mayor a cero.")
        if valor.as_tuple().exponent < -2:
            raise ValueError("El importe puede tener hasta dos decimales.")
        return valor

    @field_validator("titular", "cuit")
    @classmethod
    def _texto_vacio_es_nulo(cls, valor: str | None) -> str | None:
        if valor is None or valor.strip() == "":
            return None
        return valor

    @model_validator(mode="after")
    def _coherencia_factura(self) -> ComprobanteCreate:
        if self.factura_a_solicitada and (self.cuit is None or not cuit_es_valido(self.cuit)):
            raise ValueError("La Factura A requiere un CUIT válido.")
        if not self.factura_a_solicitada and self.cuit is not None:
            raise ValueError("El CUIT solo se informa cuando se solicita Factura A.")
        return self


class InscripcionComprobanteOut(BaseModel):
    """Inscripción a la que el alumno imputa el comprobante."""

    id: int
    codigo: str
    nombre_curso: str


class ComprobanteAlumnoOut(BaseModel):
    """Comprobante tal como lo ven el alumno y Secretaría."""

    id: int
    estado: str
    fecha_pago: date
    importe: Decimal
    medio: str
    titular: str | None
    factura_a_solicitada: bool
    cuit: str | None
    archivo_nombre: str | None
    archivo_mime: str | None
    archivo_bytes: int | None
    enviado_at: datetime | None
    inscripcion: InscripcionComprobanteOut


class ComprobantePendienteOut(ComprobanteAlumnoOut):
    """Fila de la bandeja de Secretaría, con el alumno resuelto."""

    alumno: str
    alumno_email: str
    alumno_documento: str | None


class SubidaDeArchivoOut(BaseModel):
    """Destino al que el navegador sube el archivo.

    `url` es relativa cuando la sube el backend (desarrollo) y absoluta cuando es una URL firmada
    del storage (producción). La pantalla nunca decide: usa lo que devuelve el backend.
    """

    metodo: str
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    expira_segundos: int


class ComprobanteIniciadoOut(BaseModel):
    comprobante: ComprobanteAlumnoOut
    subida: SubidaDeArchivoOut
