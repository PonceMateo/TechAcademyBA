"""Reglas del autoservicio del alumno: sus cursadas y sus datos de contacto (HUs #38, #42 y #43).

**El alumno nunca se recibe por parámetro.** Todas las funciones parten de la cuenta autenticada y
resuelven su legajo con `alumno_de`, así que ninguna consulta de este módulo puede devolver datos de
otro alumno (D58).

**El estado de habilitación no se recalcula acá.** Sale de `habilitacion.derivar_estado`, la misma
función que usa Administración, porque la causa que ve el alumno tiene que ser la administrativa —
incluido el forzado de Secretaría— (HU 42).

**El servicio devuelve los contratos de `app.schemas.alumno`.** Las tres respuestas son vistas
armadas —no filas del padrón— y el contrato es la única descripción de su forma: si se construyeran
en la capa de API habría dos lugares donde agregar un campo.
"""

from __future__ import annotations

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import ORDEN_DIA, Comision
from app.models.enums import DiaSemana, EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.schemas.alumno import (
    AccesoAlumnoOut,
    HorarioCursadaOut,
    InscripcionAlumnoOut,
)
from app.services import habilitacion


class SinAlumnoAsociado(Exception):
    """La cuenta no tiene legajo de alumno. El CHECK del modelo lo impide, pero se nombra."""


class CursadaNoEncontrada(Exception):
    """La comisión no es una inscripción del alumno. Es el mismo error para "no existe"."""


def alumno_de(usuario: Usuario) -> Alumno:
    """El legajo del alumno que está usando el sistema, resuelto desde su cuenta."""
    alumno = usuario.alumno
    if alumno is None:
        raise SinAlumnoAsociado("La cuenta no tiene un legajo de alumno asociado.")
    return alumno


def inscripciones_activas(session: Session, alumno: Alumno) -> list[Inscripcion]:
    """Las inscripciones vigentes del alumno, con lo que la tarjeta y el detalle necesitan.

    Solo `ACTIVA`: una inscripción dada de baja no es una cursada, y `Mis Cursos` no tiene por qué
    mostrar un curso que el alumno ya no está haciendo.
    """
    return list(
        session.scalars(
            select(Inscripcion)
            .where(
                Inscripcion.alumno_id == alumno.id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
            )
            .options(
                selectinload(Inscripcion.comision).selectinload(Comision.curso),
                selectinload(Inscripcion.comision).selectinload(Comision.docente),
                selectinload(Inscripcion.comision).selectinload(Comision.horarios),
            )
            .order_by(Inscripcion.id)
        ).all()
    )


def listar_inscripciones(session: Session, usuario: Usuario) -> list[InscripcionAlumnoOut]:
    """Las cursadas del alumno autenticado, con su estado derivado y su causa (HU 38 y 42).

    **Una lista vacía es una respuesta válida**, no un error: un alumno sin inscripciones tiene que
    ver el mensaje de que no tiene cursos, y eso lo decide la pantalla.
    """
    alumno = alumno_de(usuario)

    return [
        _a_inscripcion(session, inscripcion)
        for inscripcion in inscripciones_activas(session, alumno)
    ]


def _a_inscripcion(session: Session, inscripcion: Inscripcion) -> InscripcionAlumnoOut:
    comision = inscripcion.comision

    return InscripcionAlumnoOut(
        codigo=comision.codigo,
        nombre_curso=comision.curso.nombre,
        docente_nombre=comision.docente_nombre,
        horario=comision.resumen_horarios,
        horarios=_horarios(comision),
        categoria=inscripcion.categoria,
        porcentaje_beca=inscripcion.porcentaje_beca,
        acceso=_acceso(session, inscripcion),
    )


def _acceso(session: Session, inscripcion: Inscripcion) -> AccesoAlumnoOut:
    """El estado derivado con su causa, tal como lo ve Administración (HU 42)."""
    estado, causa, forzado = habilitacion.derivar_estado(session, inscripcion)
    return AccesoAlumnoOut(estado=estado, causa=causa, forzado=forzado)


def _horarios(comision: Comision) -> list[HorarioCursadaOut]:
    """Los días de cursada en orden de semana, con la hora en `HH:MM`.

    La hora se arma acá y no se deja a la serialización de `time`, que agrega los segundos: el
    frontend agrupa los días por rango con una función que lee `HH:MM` (historia #48).
    """
    filas = sorted(
        comision.horarios,
        key=lambda horario: (ORDEN_DIA[DiaSemana(horario.dia)], horario.inicio),
    )

    return [
        HorarioCursadaOut(
            dia=horario.dia,
            inicio=_hora(horario.inicio),
            fin=_hora(horario.fin),
        )
        for horario in filas
    ]


def _hora(valor: time) -> str:
    return f"{valor.hour:02d}:{valor.minute:02d}"
