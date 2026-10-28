"""Reglas de negocio de cobranzas manuales (HU 21 y HU 23).

El alta es transaccional: o quedan el pagador, la cobranza y sus imputaciones, o no queda nada.
El pagador se crea por operación y no se deduplica, porque esta historia no administra un padrón
de pagadores (decisión acordada con el equipo).
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.clases import AuditLog
from app.models.cobranza import Cobranza, Imputacion, Pagador
from app.models.enums import (
    EstadoCobranza,
    EstadoContrato,
    EstadoInscripcion,
    OrigenCobranza,
)
from app.models.inscripciones import ContratoCorporativo, Empresa, Inscripcion
from app.models.padron import Alumno
from app.schemas.cobranzas import (
    TITULAR_SIN_IDENTIFICAR,
    ZONA_ACADEMIA,
    CobranzaCreate,
    CobranzaEstadoUpdate,
    ImputacionCreate,
    ImputacionesCreate,
)
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


class CobranzaNoEncontrada(Exception):
    """La cobranza que se quiere modificar no existe."""


class CambioEstadoInvalido(Exception):
    """La transición de estado pedida no está permitida."""


class TitularNoModificable(Exception):
    """El comprobante ya tiene un titular identificado y no se cambia desde esta edición."""


class EmpresaNoEncontrada(Exception):
    """La empresa elegida para imputar no existe o está inactiva."""


class EmpresaSinContrato(Exception):
    """La empresa no tiene un contrato corporativo activo al que imputar el pago."""


class ImputacionesExcedenSaldo(Exception):
    """La distribución supera el importe de la cobranza."""


def _monto_imputado(session: Session, cobranza_id: int) -> Decimal:
    """Cuánto de la cobranza ya está imputado (D10: se deriva, no es una columna)."""
    return session.scalar(
        select(func.coalesce(func.sum(Imputacion.monto), 0)).where(
            Imputacion.cobranza_id == cobranza_id
        )
    )


#: Transiciones válidas (HU 21, ampliación). Corregir un pago acreditado por error también cuenta:
#: un comprobante acreditado puede volver a revisión o quedar rechazado.
TRANSICIONES_ESTADO = {
    EstadoCobranza.ACREDITADO.value: (
        EstadoCobranza.OBSERVADO.value,
        EstadoCobranza.RECHAZADO.value,
    ),
    EstadoCobranza.OBSERVADO.value: (
        EstadoCobranza.ACREDITADO.value,
        EstadoCobranza.RECHAZADO.value,
    ),
    EstadoCobranza.RECHAZADO.value: (EstadoCobranza.ACREDITADO.value,),
}


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


def _cargar_empresa(session: Session, empresa_id: int) -> Empresa:
    """Valida que la empresa exista, esté activa y tenga un contrato corporativo vigente."""
    empresa = session.get(Empresa, empresa_id)
    if empresa is None or not empresa.activo:
        raise EmpresaNoEncontrada("La empresa elegida no existe.")
    contrato = session.scalar(
        select(ContratoCorporativo)
        .where(
            ContratoCorporativo.empresa_id == empresa.id,
            ContratoCorporativo.estado == EstadoContrato.ACTIVO.value,
        )
        .limit(1)
    )
    if contrato is None:
        raise EmpresaSinContrato("La empresa no tiene un contrato activo al que imputar el pago.")
    return empresa


def _resolver_destino(
    session: Session, imputacion: ImputacionCreate
) -> tuple[int | None, int | None, Decimal]:
    """Traduce un destino del cuerpo a `(inscripcion_id, empresa_id, monto)` ya validado."""
    if imputacion.inscripcion_id is not None:
        inscripcion = _cargar_inscripcion(session, None, imputacion.inscripcion_id)
        return inscripcion.id, None, imputacion.monto
    empresa = _cargar_empresa(session, imputacion.empresa_id)
    return None, empresa.id, imputacion.monto


def crear_cobranza(session: Session, datos: CobranzaCreate) -> Cobranza:
    """Crea pagador, cobranza e imputaciones en una sola transacción."""
    if datos.imputaciones is None:
        inscripcion = resolver_inscripcion(
            session,
            alumno_id=datos.alumno_id,
            inscripcion_id=datos.inscripcion_id,
        )
        destinos = [] if inscripcion is None else [(inscripcion.id, None, datos.importe)]
    else:
        destinos = [_resolver_destino(session, item) for item in datos.imputaciones]

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
        for inscripcion_id, empresa_id, monto in destinos:
            session.add(
                Imputacion(
                    cobranza_id=cobranza.id,
                    inscripcion_id=inscripcion_id,
                    empresa_id=empresa_id,
                    monto=monto,
                )
            )
        session.commit()
    except (IntegrityError, DataError) as error:
        session.rollback()
        raise CobranzaInvalida("No pudimos registrar el cobro con los datos informados.") from error

    session.refresh(cobranza)
    return cobranza


def agregar_imputaciones(
    session: Session,
    cobranza_id: int,
    datos: ImputacionesCreate,
    usuario_id: int,
) -> Cobranza:
    """Reparte el saldo sin imputar de una cobranza ya registrada (HU 23).

    La fila de la cobranza se bloquea con `FOR UPDATE` antes de leer lo ya imputado: dos
    operaciones simultáneas se serializan y la segunda ve lo que dejó la primera, así no se puede
    sobreimputar. Las imputaciones anteriores no se tocan.
    """
    cobranza = session.scalar(select(Cobranza).where(Cobranza.id == cobranza_id).with_for_update())
    if cobranza is None:
        raise CobranzaNoEncontrada("La cobranza no existe.")

    nuevos = [_resolver_destino(session, item) for item in datos.imputaciones]
    saldo = cobranza.importe - _monto_imputado(session, cobranza.id)
    total = sum((monto for _, _, monto in nuevos), Decimal("0"))
    if total > saldo:
        raise ImputacionesExcedenSaldo(
            f"La imputación supera el saldo sin imputar de la cobranza ({saldo})."
        )

    for inscripcion_id, empresa_id, monto in nuevos:
        session.add(
            Imputacion(
                cobranza_id=cobranza.id,
                inscripcion_id=inscripcion_id,
                empresa_id=empresa_id,
                monto=monto,
            )
        )
    session.add(
        AuditLog(
            usuario_id=usuario_id,
            accion="cobranza.imputacion_agregada",
            entidad="cobranza",
            entidad_id=cobranza.id,
            detalle=json.dumps(
                {
                    "imputaciones": [
                        {
                            "inscripcion_id": inscripcion_id,
                            "empresa_id": empresa_id,
                            "monto": str(monto),
                        }
                        for inscripcion_id, empresa_id, monto in nuevos
                    ],
                    "saldo_restante": str(saldo - total),
                },
                ensure_ascii=False,
            ),
        )
    )

    try:
        session.commit()
    except (IntegrityError, DataError) as error:
        session.rollback()
        raise CobranzaInvalida("No pudimos imputar el pago con los datos informados.") from error

    session.refresh(cobranza)
    return cobranza


def cambiar_estado_cobranza(
    session: Session,
    cobranza_id: int,
    datos: CobranzaEstadoUpdate,
    usuario_id: int,
) -> Cobranza:
    """Cambia el estado y/o completa el titular, y lo deja en `audit_log`.

    Actualiza la fila original: no crea cobranza, pagador ni imputación. El titular solo se puede
    completar cuando quedó "Sin identificar"; un comprobante con titular no se reescribe desde acá.
    El estado, el titular y su entrada de auditoría van en la misma transacción, con la fila
    bloqueada para que dos cambios simultáneos no dejen dos entradas.
    """
    cobranza = session.scalar(select(Cobranza).where(Cobranza.id == cobranza_id).with_for_update())
    if cobranza is None:
        raise CobranzaNoEncontrada("La cobranza no existe.")

    estado_nuevo = datos.estado.value if datos.estado is not None else None
    cambia_estado = estado_nuevo is not None and estado_nuevo != cobranza.estado

    titular_anterior = None
    if datos.titular is not None:
        if cobranza.pagador is None or cobranza.pagador.nombre != TITULAR_SIN_IDENTIFICAR:
            raise TitularNoModificable(
                "El comprobante ya tiene un titular identificado: no se cambia desde acá."
            )
        titular_anterior = cobranza.pagador.nombre
        cobranza.pagador.nombre = datos.titular

    if estado_nuevo is not None:
        if not cambia_estado and datos.titular is None:
            raise CambioEstadoInvalido("La cobranza ya está en ese estado.")
        if cambia_estado and estado_nuevo not in TRANSICIONES_ESTADO[cobranza.estado]:
            raise CambioEstadoInvalido(
                f"No se puede pasar una cobranza de {cobranza.estado} a {estado_nuevo}."
            )
    elif datos.titular is None:
        raise CambioEstadoInvalido("Indicá el estado nuevo o el titular del comprobante.")

    anterior = cobranza.estado
    ahora = datetime.now(ZONA_ACADEMIA)
    if cambia_estado:
        cobranza.estado = estado_nuevo
        # El modelo exige causa mientras la cobranza no está acreditada, y es el motivo que
        # muestra el historial: la justificación es esa causa. Al acreditar se conserva la anterior.
        if datos.estado != EstadoCobranza.ACREDITADO:
            cobranza.causa = datos.justificacion
        cobranza.estado_cambiado_por = usuario_id
        cobranza.estado_cambiado_at = ahora

    detalle = {
        "estado_anterior": anterior,
        "estado_nuevo": cobranza.estado,
        "justificacion": datos.justificacion or "Titular del comprobante completado.",
        "fecha": ahora.isoformat(),
    }
    if titular_anterior is not None:
        detalle["titular_anterior"] = titular_anterior
        detalle["titular_nuevo"] = datos.titular
    session.add(
        AuditLog(
            usuario_id=usuario_id,
            accion="cobranza.estado_cambiado" if cambia_estado else "cobranza.titular_completado",
            entidad="cobranza",
            entidad_id=cobranza.id,
            detalle=json.dumps(detalle, ensure_ascii=False),
        )
    )

    try:
        session.commit()
    except (IntegrityError, DataError) as error:
        session.rollback()
        raise CobranzaInvalida("No pudimos actualizar la cobranza.") from error

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
            selectinload(Cobranza.imputaciones).selectinload(Imputacion.empresa),
        )
        .order_by(Cobranza.fecha.desc(), Cobranza.id.desc())
    )
    if q is not None and q.strip() != "":
        consulta = consulta.where(Cobranza.pagador.has(Pagador.nombre.ilike(f"%{q.strip()}%")))
    return list(session.scalars(consulta).all())


def listar_pagos_de_alumno(session: Session, alumno_id: int) -> list[Cobranza]:
    """Cobranzas con al menos una imputación a una inscripción del alumno (HU 23).

    El filtro va en la consulta y no en la pantalla: el alumno solo puede ver lo que está imputado
    a su legajo, nunca el historial administrativo completo.
    """
    consulta = (
        select(Cobranza)
        .where(
            Cobranza.imputaciones.any(
                Imputacion.inscripcion.has(Inscripcion.alumno_id == alumno_id)
            )
        )
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
    return list(session.scalars(consulta).all())


def serializar_pago_de_alumno(cobranza: Cobranza, alumno_id: int) -> dict[str, object]:
    """Fila del historial del alumno, con lo imputado a él y no el total del comprobante."""
    propias = [
        imputacion
        for imputacion in cobranza.imputaciones
        if imputacion.inscripcion is not None and imputacion.inscripcion.alumno_id == alumno_id
    ]
    imputado = sum((imputacion.monto for imputacion in propias), Decimal("0"))
    alumno = propias[0].inscripcion.alumno.nombre if propias else ""
    return {
        "id": cobranza.id,
        "fecha": cobranza.fecha,
        "importe": imputado,
        "medio": cobranza.medio,
        "estado": cobranza.estado,
        "causa": cobranza.causa,
        # El comprobante lo puede mandar un familiar o una empresa (D7).
        "pagado_por_tercero": cobranza.pagador.nombre != alumno,
    }


def _serializar_imputacion(imputacion: Imputacion) -> dict[str, object]:
    salida: dict[str, object] = {
        "id": imputacion.id,
        "monto": imputacion.monto,
        "inscripcion_id": None,
        "alumno_id": None,
        "alumno": None,
        "empresa_id": None,
        "empresa": None,
        "comision": None,
    }
    if imputacion.inscripcion is not None:
        inscripcion = imputacion.inscripcion
        salida.update(
            {
                "destino": "ALUMNO",
                "nombre": inscripcion.alumno.nombre,
                "inscripcion_id": inscripcion.id,
                "alumno_id": inscripcion.alumno_id,
                "alumno": inscripcion.alumno.nombre,
                "comision": {
                    "codigo": inscripcion.comision.codigo,
                    "nombre": inscripcion.comision.curso.nombre,
                },
            }
        )
    else:
        salida.update(
            {
                "destino": "EMPRESA",
                "nombre": imputacion.empresa.razon_social,
                "empresa_id": imputacion.empresa_id,
                "empresa": imputacion.empresa.razon_social,
            }
        )
    return salida


def serializar_cobranza(cobranza: Cobranza) -> dict[str, object]:
    """Arma la fila que consume el frontend, con pagador e imputaciones resueltas."""
    imputaciones = [_serializar_imputacion(item) for item in cobranza.imputaciones]
    monto_imputado = sum((item.monto for item in cobranza.imputaciones), Decimal("0"))
    return {
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
        "imputacion": imputaciones[0] if imputaciones else None,
        "imputaciones": imputaciones,
        "monto_imputado": monto_imputado,
        "saldo_sin_imputar": cobranza.importe - monto_imputado,
    }
