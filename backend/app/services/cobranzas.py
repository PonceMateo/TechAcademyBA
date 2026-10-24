"""Reglas de negocio de cobranzas manuales (HU 21).

El alta es transaccional: o quedan el pagador, la cobranza y su imputación, o no queda nada.
El pagador se crea por operación y no se deduplica, porque esta historia no administra un padrón
de pagadores (decisión acordada con el equipo).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.cobranza import Cobranza, Imputacion, Pagador
from app.models.enums import EstadoInscripcion, OrigenCobranza
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno
from app.schemas.cobranzas import CobranzaCreate
from app.services.normalization import normalize_document


class AlumnoNoEncontrado(Exception):
    """El alumno elegido no existe en el padrón."""


class InscripcionNoEncontrada(Exception):
    """La inscripción elegida no existe."""


class InscripcionDeOtroAlumno(Exception):
    """La inscripción no pertenece al alumno indicado."""


class InscripcionNoActiva(Exception):
    """La inscripción elegida no está activa."""


class InscripcionNoDisponible(Exception):
    """El alumno no tiene ninguna inscripción activa para imputar."""


class InscripcionAmbigua(Exception):
    """El alumno tiene varias inscripciones activas y hay que elegir una."""


class CobranzaInvalida(Exception):
    """La base rechazó la cobranza por una regla de integridad."""


def _cargar_inscripcion(
    session: Session, alumno_id: int | None, inscripcion_id: int
) -> Inscripcion:
    inscripcion = session.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción elegida no existe.")
    if alumno_id is not None and inscripcion.alumno_id != alumno_id:
        raise InscripcionDeOtroAlumno("La inscripción no pertenece al alumno elegido.")
    if inscripcion.estado != EstadoInscripcion.ACTIVA.value:
        raise InscripcionNoActiva("La inscripción elegida no está activa.")
    return inscripcion


def resolver_inscripcion(
    session: Session,
    *,
    alumno_id: int | None,
    inscripcion_id: int | None,
) -> Inscripcion | None:
    """Devuelve la inscripción a imputar, o `None` si el pago no se imputa.

    Con una inscripción explícita se valida que sea del alumno y esté activa. Sin ella, se toma
    la única activa del alumno; con cero o varias se rechaza para no elegir una comisión
    arbitraria.
    """
    if inscripcion_id is not None:
        return _cargar_inscripcion(session, alumno_id, inscripcion_id)

    if alumno_id is None:
        return None

    if session.get(Alumno, alumno_id) is None:
        raise AlumnoNoEncontrado("El alumno no existe.")

    activas = session.scalars(
        select(Inscripcion).where(
            Inscripcion.alumno_id == alumno_id,
            Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
        )
    ).all()
    if not activas:
        raise InscripcionNoDisponible(
            "El alumno no tiene una inscripción activa para imputar el pago."
        )
    if len(activas) > 1:
        raise InscripcionAmbigua(
            "El alumno tiene varias inscripciones activas: elegí a cuál imputar el pago."
        )
    return activas[0]


def crear_cobranza(session: Session, datos: CobranzaCreate) -> Cobranza:
    """Crea pagador, cobranza e imputación en una sola transacción."""
    inscripcion = resolver_inscripcion(
        session,
        alumno_id=datos.alumno_id,
        inscripcion_id=datos.inscripcion_id,
    )

    pagador = Pagador(
        nombre=datos.titular,
        documento=datos.cuit_titular,
        documento_norm=normalize_document(datos.cuit_titular),
    )
    cobranza = Cobranza(
        fecha=datos.fecha,
        importe=datos.importe,
        medio=datos.medio.value,
        origen=OrigenCobranza.MANUAL.value,
        estado=datos.estado.value,
        causa=datos.causa,
        factura_a_solicitada=datos.factura_a_solicitada,
        pagador=pagador,
    )

    session.add(cobranza)
    try:
        session.flush()
        if inscripcion is not None:
            session.add(
                Imputacion(
                    cobranza_id=cobranza.id,
                    inscripcion_id=inscripcion.id,
                    monto=datos.importe,
                )
            )
        session.commit()
    except (IntegrityError, DataError) as error:
        session.rollback()
        raise CobranzaInvalida(
            "No pudimos registrar el cobro con los datos informados."
        ) from error

    session.refresh(cobranza)
    return cobranza


def listar_cobranzas(session: Session, q: str | None = None) -> list[Cobranza]:
    """Historial completo, del pago más reciente al más viejo."""
    consulta = (
        select(Cobranza)
        .options(
            selectinload(Cobranza.pagador),
            selectinload(Cobranza.imputaciones)
            .selectinload(Imputacion.inscripcion)
            .selectinload(Inscripcion.alumno),
            selectinload(Cobranza.imputaciones)
            .selectinload(Imputacion.inscripcion)
            .selectinload(Inscripcion.comision)
            .selectinload(Comision.curso),
        )
        .order_by(Cobranza.fecha.desc(), Cobranza.id.desc())
    )
    if q is not None and q.strip() != "":
        consulta = consulta.where(
            Cobranza.pagador.has(Pagador.nombre.ilike(f"%{q.strip()}%"))
        )
    return list(session.scalars(consulta).all())


def serializar_cobranza(cobranza: Cobranza) -> dict[str, object]:
    """Arma la fila que consume el frontend, con pagador e imputación resueltos."""
    imputacion = cobranza.imputaciones[0] if cobranza.imputaciones else None
    salida: dict[str, object] = {
        "id": cobranza.id,
        "fecha": cobranza.fecha,
        "importe": cobranza.importe,
        "medio": cobranza.medio,
        "origen": cobranza.origen,
        "estado": cobranza.estado,
        "causa": cobranza.causa,
        "factura_a_solicitada": cobranza.factura_a_solicitada,
        "factura": "A" if cobranza.factura_a_solicitada else None,
        "pagador": {
            "id": cobranza.pagador.id,
            "nombre": cobranza.pagador.nombre,
            "documento": cobranza.pagador.documento,
        },
        "imputacion": None,
    }
    if imputacion is not None:
        inscripcion = imputacion.inscripcion
        salida["imputacion"] = {
            "id": imputacion.id,
            "inscripcion_id": inscripcion.id,
            "monto": imputacion.monto,
            "alumno_id": inscripcion.alumno_id,
            "alumno": inscripcion.alumno.nombre,
            "comision": {
                "codigo": inscripcion.comision.codigo,
                "nombre": inscripcion.comision.curso.nombre,
            },
        }
    return salida
