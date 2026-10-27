"""Reglas de negocio de inscripciones (HU #14)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.enums import CategoriaInscripcion, EstadoInscripcion
from app.models.inscripciones import Empresa, Inscripcion
from app.models.padron import Alumno
from app.schemas.inscripciones import InscripcionCategoriaUpdate, InscripcionCreate


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


class InscripcionNoEncontrada(Exception):
    """La inscripción no existe."""


class CategoriaInvalida(Exception):
    """La categoría no es una del enum."""


class PorcentajeInvalido(Exception):
    """El porcentaje no está entre 1 y 99 para becado parcial."""


class EmpresaRequerida(Exception):
    """La categoría corporativo exige una empresa."""


class EmpresaNoEncontrada(Exception):
    """La empresa no existe."""


def actualizar_categoria(
    session: Session, inscripcion_id: int, datos: InscripcionCategoriaUpdate
) -> Inscripcion:
    inscripcion = session.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción no existe.")

    categoria = datos.categoria
    if categoria not in {member.value for member in CategoriaInscripcion}:
        raise CategoriaInvalida("La categoría no es válida.")

    porcentaje = datos.porcentaje_beca
    empresa_id = datos.empresa_id

    if categoria == CategoriaInscripcion.BECADO_PARCIAL.value:
        if porcentaje is None or porcentaje < 1 or porcentaje > 99:
            raise PorcentajeInvalido("El porcentaje debe estar entre 1 y 99.")
    else:
        porcentaje = None

    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        if empresa_id is None:
            raise EmpresaRequerida("Seleccioná la empresa.")
        empresa = session.get(Empresa, empresa_id)
        if empresa is None:
            raise EmpresaNoEncontrada("La empresa no existe.")
    else:
        empresa_id = None

    inscripcion.categoria = categoria
    inscripcion.porcentaje_beca = porcentaje
    inscripcion.empresa_id = empresa_id
    session.commit()
    session.refresh(inscripcion)
    return inscripcion
