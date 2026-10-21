"""Contrato de salida del padrón de alumnos (lectura para inscripción, HU #14)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ComisionAsignadaOut(BaseModel):
    """Comisión del padrón. Hoy siempre `None` hasta que exista la inscripción real."""

    codigo: str
    nombre: str


class AccesoAlumnoOut(BaseModel):
    """El acceso derivado de la fila. Hoy siempre `None`: la habilitación es posterior."""

    estado: str
    causa: str | None = None


class AlumnoOut(BaseModel):
    """Fila de `GET /alumnos`."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    documento: str | None
    tipo_documento: str | None
    email: str
    telefono: str | None
    activo: bool
    comision: ComisionAsignadaOut | None = None
    categoria: str | None = None
    porcentaje_beca: Decimal | None = None
    acceso: AccesoAlumnoOut | None = None
