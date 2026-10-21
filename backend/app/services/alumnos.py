"""Reglas de negocio del padrón de alumnos (lectura para inscripción, HU #14)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.padron import Alumno


def listar_alumnos(session: Session) -> list[Alumno]:
    """Alumnos ordenados por id. Los campos derivados de inscripción se dejan en `None`
    porque la inscripción es la HU #14 y no se inventan datos (D43)."""
    alumnos = list(session.scalars(select(Alumno).order_by(Alumno.id)))
    for alumno in alumnos:
        alumno.comision = None  # type: ignore[attr-defined]
        alumno.categoria = None  # type: ignore[attr-defined]
        alumno.porcentaje_beca = None  # type: ignore[attr-defined]
        alumno.acceso = None  # type: ignore[attr-defined]
    return alumnos
