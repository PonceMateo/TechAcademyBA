"""Contrato de entrada y salida de inscripciones (HU #14)."""

from __future__ import annotations

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
    estado: str
