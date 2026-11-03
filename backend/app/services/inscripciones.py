"""Reglas de negocio de inscripciones (HU #14, HU 60 y HU 64).

El alta y el `PATCH` de categoría comparten la validación de categoría, porcentaje de beca y
empresa: la regla no puede depender de la puerta por la que entra la inscripción (HU 64). La
gestión de una comisión (HU 60) reutiliza esa misma validación y agrega el listado y la baja lógica.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import ZONA_HORARIA_DOMINIO, Comision, clases_del_periodo
from app.models.clases import AuditLog
from app.models.enums import CategoriaInscripcion, EstadoComision, EstadoInscripcion
from app.models.inscripciones import Empresa, Inscripcion
from app.models.padron import Alumno, Usuario
from app.schemas.inscripciones import (
    AccesoDeInscripcionOut,
    AlumnoDeInscripcionOut,
    ComisionDeInscripcionesOut,
    InscripcionCategoriaUpdate,
    InscripcionCreate,
    InscripcionDeComisionOut,
    InscripcionesDeComisionOut,
)
from app.services import habilitacion


class AlumnoNoEncontrado(Exception):
    """El alumno no existe en el padrón."""


class ComisionNoEncontrada(Exception):
    """La comisión no existe."""


class InscripcionDuplicada(Exception):
    """El alumno ya está inscripto en esa comisión."""


class CupoLleno(Exception):
    """La comisión no tiene vacantes."""


class ComisionFinalizada(Exception):
    """La comisión ya terminó y no admite inscripciones (H/U 70)."""


class ProrrateoNoDisponible(Exception):
    """No se puede calcular el importe de la inscripción."""


def calcular_importe_arancel(
    comision: Comision,
    categoria: str,
    porcentaje_beca: Decimal | None = None,
    *,
    hoy: date | None = None,
) -> Decimal | None:
    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        return None
    if categoria == CategoriaInscripcion.BECADO_TOTAL.value:
        return Decimal("0.00")
    if comision.fecha_inicio is None or comision.fecha_fin is None:
        raise ProrrateoNoDisponible(
            "No se pudo calcular el importe: la comisión no tiene un período completo."
        )
    fecha_alta = hoy or datetime.now(ZONA_HORARIA_DOMINIO).date()
    clases_totales = comision.cantidad_clases
    clases_restantes = (
        clases_totales
        if fecha_alta <= comision.fecha_inicio
        else clases_del_periodo(fecha_alta, comision.fecha_fin, comision.horarios)
    )
    if not clases_totales or not clases_restantes:
        raise ProrrateoNoDisponible(
            "No se pudo calcular el importe: no quedan clases en el período."
        )
    importe = comision.arancel * Decimal(clases_restantes) / Decimal(clases_totales)
    if categoria == CategoriaInscripcion.BECADO_PARCIAL.value:
        importe *= (Decimal("100") - (porcentaje_beca or Decimal("0"))) / Decimal("100")
    return importe.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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

    comision = session.scalar(
        select(Comision).where(Comision.id == datos.comision_id).with_for_update()
    )
    if comision is None:
        raise ComisionNoEncontrada("La comisión no existe.")

    # H/U 70: una comisión terminada no admite altas. Va antes del cupo y del duplicado para que
    # el motivo informado sea el real cuando además está llena o el alumno ya está inscripto.
    if comision.estado == EstadoComision.FINALIZADA.value:
        raise ComisionFinalizada("La comisión ya finalizó.")

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

    categoria, porcentaje_beca, empresa_id = _validar_categoria(
        session, datos.categoria, datos.porcentaje_beca, datos.empresa_id
    )
    importe_arancel = calcular_importe_arancel(comision, categoria, porcentaje_beca)

    inscripcion = Inscripcion(
        alumno_id=datos.alumno_id,
        comision_id=datos.comision_id,
        categoria=categoria,
        porcentaje_beca=porcentaje_beca,
        empresa_id=empresa_id,
        importe_arancel=importe_arancel,
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


def _validar_categoria(
    session: Session,
    categoria: str,
    porcentaje_beca: int | None,
    empresa_id: int | None,
) -> tuple[str, Decimal | None, int | None]:
    """Valida y normaliza categoría, porcentaje de beca y empresa (HU 64).

    Beca parcial exige un porcentaje entre 1 y 99, corporativo exige una empresa existente y las
    demás categorías no llevan ninguno de los dos. El alta y el `PATCH` usan esta misma función y
    guardan lo que devuelve, así la base nunca ve una combinación que el servicio no aprobó.
    """
    if categoria not in {member.value for member in CategoriaInscripcion}:
        raise CategoriaInvalida("La categoría no es válida.")

    if categoria == CategoriaInscripcion.BECADO_PARCIAL.value:
        if porcentaje_beca is None or porcentaje_beca < 1 or porcentaje_beca > 99:
            raise PorcentajeInvalido("El porcentaje debe estar entre 1 y 99.")
        porcentaje = Decimal(porcentaje_beca)
    else:
        porcentaje = None

    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        if empresa_id is None:
            raise EmpresaRequerida("Seleccioná la empresa.")
        if session.get(Empresa, empresa_id) is None:
            raise EmpresaNoEncontrada("La empresa no existe.")
    else:
        empresa_id = None

    return categoria, porcentaje, empresa_id


def actualizar_categoria(
    session: Session, inscripcion_id: int, datos: InscripcionCategoriaUpdate
) -> Inscripcion:
    inscripcion = session.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción no existe.")

    categoria, porcentaje, empresa_id = _validar_categoria(
        session, datos.categoria, datos.porcentaje_beca, datos.empresa_id
    )

    inscripcion.categoria = categoria
    inscripcion.porcentaje_beca = porcentaje
    inscripcion.empresa_id = empresa_id
    session.commit()
    session.refresh(inscripcion)
    return inscripcion


class InscripcionDeOtraComision(Exception):
    """La inscripción no pertenece a la comisión desde la que se pide la baja."""


class TransicionDeInscripcionInvalida(Exception):
    """La inscripción ya no está `ACTIVA` y no se puede dar de baja otra vez."""


def listar_de_comision(session: Session, comision_id: int) -> InscripcionesDeComisionOut:
    """Inscriptos de una comisión, activos e históricos, con el cupo y las vacantes (HU 60).

    Las vacantes se derivan de las inscripciones `ACTIVA` (D10), así una baja libera su lugar sin
    que haya una columna que mantener. La habilitación se deriva solo para las `ACTIVA`: una baja o
    una cursada completada no tiene bloqueo que informar.
    """
    comision = session.get(Comision, comision_id)
    if comision is None:
        raise ComisionNoEncontrada("La comisión no existe.")

    inscripciones = session.scalars(
        select(Inscripcion)
        .where(Inscripcion.comision_id == comision_id)
        .options(selectinload(Inscripcion.alumno), selectinload(Inscripcion.empresa))
        .order_by(Inscripcion.id)
    ).all()

    activas = sum(
        1 for inscripcion in inscripciones if inscripcion.estado == EstadoInscripcion.ACTIVA.value
    )
    filas = [
        _fila_de_comision(session, inscripcion)
        # Las activas primero y las bajas al final, como historial.
        for inscripcion in sorted(
            inscripciones,
            key=lambda fila: (fila.estado != EstadoInscripcion.ACTIVA.value, fila.id),
        )
    ]
    return InscripcionesDeComisionOut(
        comision=ComisionDeInscripcionesOut(
            id=comision.id,
            codigo=comision.codigo,
            nombre_curso=comision.curso.nombre,
            cupo_maximo=comision.cupo_maximo,
            inscriptos_activos=activas,
            vacantes=max(comision.cupo_maximo - activas, 0),
        ),
        inscripciones=filas,
    )


def _fila_de_comision(session: Session, inscripcion: Inscripcion) -> InscripcionDeComisionOut:
    acceso = None
    if inscripcion.estado == EstadoInscripcion.ACTIVA.value:
        estado, causa, forzado = habilitacion.derivar_estado(session, inscripcion)
        acceso = AccesoDeInscripcionOut(estado=estado, causa=causa, forzado=forzado)
    return InscripcionDeComisionOut(
        id=inscripcion.id,
        alumno=AlumnoDeInscripcionOut.model_validate(inscripcion.alumno),
        categoria=inscripcion.categoria,
        porcentaje_beca=inscripcion.porcentaje_beca,
        empresa_id=inscripcion.empresa_id,
        empresa_nombre=inscripcion.empresa.razon_social if inscripcion.empresa else None,
        estado=inscripcion.estado,
        acceso=acceso,
    )


def dar_de_baja(
    session: Session, inscripcion_id: int, comision_id: int, usuario: Usuario
) -> Inscripcion:
    """Baja lógica de una inscripción (HU 60).

    La fila se bloquea con `SELECT ... FOR UPDATE`: dos bajas simultáneas de la misma inscripción
    se serializan, la segunda lee el estado ya cambiado y recibe `409` en vez de liberar dos
    vacantes. La inscripción, el alumno y sus pagos se conservan; solo cambia el estado y se deja
    la entrada de auditoría en la misma transacción.
    """
    inscripcion = session.scalar(
        select(Inscripcion).where(Inscripcion.id == inscripcion_id).with_for_update()
    )
    if inscripcion is None or inscripcion.comision_id != comision_id:
        raise InscripcionNoEncontrada("La inscripción no existe en esa comisión.")
    if inscripcion.estado != EstadoInscripcion.ACTIVA.value:
        raise TransicionDeInscripcionInvalida(
            "La inscripción ya no está activa: no se puede dar de baja otra vez."
        )

    inscripcion.estado = EstadoInscripcion.BAJA.value
    session.add(
        AuditLog(
            usuario_id=usuario.id,
            accion="inscripcion.baja",
            entidad="inscripcion",
            entidad_id=inscripcion.id,
            detalle=json.dumps(
                {"comision_id": inscripcion.comision_id, "alumno_id": inscripcion.alumno_id},
                ensure_ascii=False,
            ),
        )
    )
    session.commit()
    session.refresh(inscripcion)
    return inscripcion
