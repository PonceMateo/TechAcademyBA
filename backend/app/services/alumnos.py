"""Reglas de negocio del padrón de alumnos (lectura y búsqueda, HU #16)."""

from __future__ import annotations

from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno
from app.services.normalization import normalize_document


def listar_alumnos(session: Session, consulta: str | None = None) -> list[Alumno]:
    """Alumnos ordenados por id, con la comisión y categoría de su inscripción.

    La habilitación queda en `None`: es la HU #27 (Should) y no se inventa un estado.
    """
    alumnos = list(session.scalars(select(Alumno).order_by(Alumno.id)))

    if consulta and consulta.strip():
        aguja = consulta.strip()
        normalizada = normalize_document(aguja)
        filtrados: list[Alumno] = []
        for alumno in alumnos:
            coincide_documento = normalizada and alumno.documento_norm == normalizada
            coincide_email = alumno.email.lower() == aguja.lower()
            if coincide_documento or coincide_email:
                filtrados.append(alumno)
        alumnos = filtrados

    inscripciones = list(
        session.scalars(
            select(Inscripcion)
            .options(selectinload(Inscripcion.comision).selectinload(Comision.curso))
            .order_by(Inscripcion.id)
        )
    )
    por_alumno: dict[int, Inscripcion] = {}
    for inscripcion in inscripciones:
        por_alumno.setdefault(inscripcion.alumno_id, inscripcion)

    for alumno in alumnos:
        inscripcion = por_alumno.get(alumno.id)
        if inscripcion is not None and inscripcion.comision is not None:
            alumno.comision = SimpleNamespace(  # type: ignore[attr-defined]
                codigo=inscripcion.comision.codigo,
                nombre=inscripcion.comision.curso.nombre,
            )
            alumno.categoria = inscripcion.categoria  # type: ignore[attr-defined]
            alumno.porcentaje_beca = inscripcion.porcentaje_beca  # type: ignore[attr-defined]
        else:
            alumno.comision = None  # type: ignore[attr-defined]
            alumno.categoria = None  # type: ignore[attr-defined]
            alumno.porcentaje_beca = None  # type: ignore[attr-defined]
        alumno.acceso = None  # type: ignore[attr-defined]

    return alumnos
