"""Reglas de negocio de inscripciones (HU #14)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.enums import EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno
from app.schemas.inscripciones import InscripcionCreate


class AlumnoNoEncontrado(Exception):
    """El alumno no existe en el padrón."""


class ComisionNoEncontrada(Exception):
    """La comisión no existe."""


class InscripcionDuplicada(Exception):
    """El alumno ya está inscripto en esa comisión."""


class CupoLleno(Exception):
    """La comisión no tiene vacantes."""


def listar_inscripciones_activas(session: Session, alumno_id: int) -> list[Inscripcion]:
    """Inscripciones activas del alumno, para elegir a cuál imputar una cobranza (HU 21)."""
    if session.get(Alumno, alumno_id) is None:
        raise AlumnoNoEncontrado("El alumno no existe.")
    return list(
        session.scalars(
            select(Inscripcion)
            .where(
                Inscripcion.alumno_id == alumno_id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
            )
            .options(selectinload(Inscripcion.comision).selectinload(Comision.curso))
            .order_by(Inscripcion.id)
        ).all()
    )


def crear_inscripcion(session: Session, datos: InscripcionCreate) -> Inscripcion:
    alumno = session.get(Alumno, datos.alumno_id)
    if alumno is None:
        raise AlumnoNoEncontrado("El alumno no existe.")

    comision = session.get(Comision, datos.comision_id)
    if comision is None:
        raise ComisionNoEncontrada("La comisión no existe.")

    existente = session.scalar(
        select(Inscripcion).where(
            Inscripcion.alumno_id == datos.alumno_id,
            Inscripcion.comision_id == datos.comision_id,
        )
    )
    if existente is not None:
        raise InscripcionDuplicada("El alumno ya está inscripto en esa comisión.")

    inscriptas = session.scalar(
        select(func.count(Inscripcion.id)).where(
            Inscripcion.comision_id == datos.comision_id,
            Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
        )
    ) or 0
    if inscriptas >= comision.cupo_maximo:
        raise CupoLleno("La comisión está completa.")

    inscripcion = Inscripcion(
        alumno_id=datos.alumno_id,
        comision_id=datos.comision_id,
        categoria=datos.categoria,
        estado=EstadoInscripcion.ACTIVA.value,
    )
    session.add(inscripcion)
    try:
        session.flush()
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise InscripcionDuplicada("El alumno ya está inscripto en esa comisión.") from error
    session.refresh(inscripcion)
    return inscripcion
