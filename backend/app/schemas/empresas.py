"""Contrato de entrada y salida de empresas (historia #18).

El contrato de alta admite **únicamente** razón social, CUIT y el indicador de Factura A:
`extra="forbid"` hace que un campo de otra historia —nómina, contrato— sea un 422 y no un
dato ignorado que aparenta haberse guardado.

El CUIT se valida por forma y por dígito verificador en el esquema, con la misma regla que
sostiene `ck_empresa_cuit_digito` en la base: doble defensa, como en el resto del esquema.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.normalization import cuit_es_valido


class EmpresaCreate(BaseModel):
    """Cuerpo de `POST /empresas`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    razon_social: str = Field(min_length=1, max_length=200)
    cuit: str = Field(min_length=1, max_length=20)
    requiere_factura_a: bool

    @field_validator("cuit")
    @classmethod
    def _cuit_con_digito_verificador(cls, valor: str) -> str:
        """Once dígitos (después de normalizar) y dígito verificador correcto (historia #18).

        El mensaje es de la interfaz en es-AR y dice las dos causas posibles, porque las dos
        producen el mismo rechazo en la base y el operador no distingue una de la otra.
        """
        if not cuit_es_valido(valor):
            raise ValueError(
                "El CUIT debe tener 11 dígitos y un dígito verificador válido."
            )
        return valor


class EmpresaOut(BaseModel):
    """Fila de `GET /empresas` y respuesta de `POST /empresas`.

    `cuit` va tal como se registró (con guiones si el operador los escribió); la unicidad se
    resuelve sobre `cuit_norm`, que no sale al contrato porque es una detalle de persistencia
    (D6).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    razon_social: str
    cuit: str
    requiere_factura_a: bool
    activo: bool
