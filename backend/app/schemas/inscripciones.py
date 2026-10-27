"""Contrato de entrada y salida de inscripciones (HU #14)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InscripcionCreate(BaseModel):
    """Cuerpo de `POST /inscripciones`."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    alumno_id: int = Field(gt=0)
    comision_id: int = Field(gt=0)
    categoria: str = Field(default="PARTICULAR", min_length=1, max_length=20)


class InscripcionOut(BaseModel):
    """Respuesta de `POST /inscripciones`."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    alumno_id: int
    comision_id: int
    categoria: str
    porcentaje_beca: Decimal | None = None
    empresa_id: int | None = None
    estado: str


class InscripcionCategoriaUpdate(BaseModel):
    """Cuerpo de `PATCH /inscripciones/{id}` para asignar categoría (HU #15)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    categoria: str = Field(min_length=1, max_length=20)
    porcentaje_beca: int | None = Field(default=None, ge=1, le=99)
    empresa_id: int | None = Field(default=None, gt=0)


class ComisionDisponibleOut(BaseModel):
    """Comisión que la pantalla muestra al elegir a qué inscripción imputar (HU 21)."""

    codigo: str
    nombre: str


class InscripcionDisponibleOut(BaseModel):
    """Inscripción activa de un alumno para imputar una cobranza (HU 21)."""

    id: int
    estado: str
    comision: ComisionDisponibleOut
