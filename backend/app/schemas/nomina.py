"""Contrato de carga de nómina corporativa (HU #19)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.validators import DniConForma, EmailConForma, TelefonoE164


class EmpleadoNominaIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    documento: DniConForma = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=160)
    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: TelefonoE164 | None = Field(default=None, max_length=40)


class NominaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    comision_id: int = Field(gt=0)
    empleados: list[EmpleadoNominaIn] = Field(min_length=1)


class NominaOut(BaseModel):
    contrato_id: int
    empresa_id: int
    comision_id: int
    cantidad: int
    alumnos_creados: int
    alumnos_reutilizados: int
    inscripciones_creadas: int
