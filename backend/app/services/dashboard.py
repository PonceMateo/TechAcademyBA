"""Agregado del tablero de Administración (H/U 55).

**Todo se calcula en el servidor.** La pantalla no deriva indicadores: recibe los conteos, la serie,
la ocupación, los comprobantes y la agenda ya resueltos. Así el número de una tarjeta y el de una
alerta no pueden contradecirse.

**No hay fecha de inscripción.** La serie de seis meses y los comprobantes recientes salen de
las fechas que el modelo sí guarda: `cobranza.fecha` y `comprobante_alumno.enviado_at`. No se
completa la serie con datos de ejemplo ni se inventan altas.

**La ocupación es por comisión.** El indicador de cupo promedio y el top tres usan la misma base
—inscriptos activos sobre cupo—, para que dos promedios distintos no se lean como un error.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import ZONA_HORARIA_DOMINIO, Comision
from app.models.cobranza import Cobranza
from app.models.comprobantes import ComprobanteAlumno
from app.models.enums import (
    EstadoCobranza,
    EstadoComision,
    EstadoComprobanteAlumno,
    EstadoInscripcion,
)
from app.models.inscripciones import Inscripcion
from app.schemas.dashboard import (
    CobroMesOut,
    DashboardAdminOut,
    EncuentroAgendaOut,
    IndicadoresDashboardOut,
    OcupacionComisionOut,
)
from app.services import agenda, comprobantes

#: Cuántos meses muestra la serie, incluido el corriente.
MESES_DE_LA_SERIE = 6

#: Cuántas comisiones entran en el top de ocupación.
COMISIONES_EN_OCUPACION = 3

#: Cuántos comprobantes recientes muestra el bloque.
COMPROBANTES_RECIENTES = 5

#: Cuántas clases muestra la agenda del tablero.
ENCUENTROS_EN_AGENDA = 8

UN_DECIMAL = Decimal("0.1")


def obtener_dashboard(session: Session, *, hoy: date | None = None) -> DashboardAdminOut:
    """Arma la respuesta completa del tablero con los datos del momento."""
    referencia = hoy or datetime.now(ZONA_HORARIA_DOMINIO).date()

    inscripciones_por_comision = dict(
        session.execute(
            select(Inscripcion.comision_id, func.count(Inscripcion.id))
            .where(Inscripcion.estado == EstadoInscripcion.ACTIVA.value)
            .group_by(Inscripcion.comision_id)
        ).all()
    )
    inscripciones_activas = sum(inscripciones_por_comision.values())
    alumnos_inscriptos = session.scalar(
        select(func.count(func.distinct(Inscripcion.alumno_id))).where(
            Inscripcion.estado == EstadoInscripcion.ACTIVA.value
        )
    ) or 0

    comisiones = list(
        session.scalars(
            select(Comision)
            .options(
                selectinload(Comision.curso),
                selectinload(Comision.docente),
                selectinload(Comision.horarios),
            )
            .order_by(Comision.id)
        ).all()
    )
    activas = [comision for comision in comisiones if comision.activo]
    vigentes = [
        comision for comision in activas if comision.estado == EstadoComision.VIGENTE.value
    ]

    ocupaciones = [
        OcupacionComisionOut(
            codigo=comision.codigo,
            nombre_curso=comision.curso.nombre,
            inscriptos=inscripciones_por_comision.get(comision.id, 0),
            cupo=comision.cupo_maximo,
            porcentaje=_porcentaje(
                inscripciones_por_comision.get(comision.id, 0), comision.cupo_maximo
            ),
        )
        for comision in vigentes
    ]
    promotores = sorted(ocupaciones, key=lambda item: item.porcentaje, reverse=True)
    ocupacion_por_comision = promotores[:COMISIONES_EN_OCUPACION]
    cupo_promedio = (
        (sum((item.porcentaje for item in ocupaciones), Decimal("0")) / len(ocupaciones)).quantize(
            UN_DECIMAL, rounding=ROUND_HALF_UP
        )
        if ocupaciones
        else None
    )

    comprobantes_pendientes = _contar_comprobantes(
        session, EstadoComprobanteAlumno.PENDIENTE_REVISION.value
    )
    cobranzas_observadas = _contar_cobranzas(session, EstadoCobranza.OBSERVADO.value)

    serie = _serie_de_cobros(session, referencia)
    cobrado_mes_actual = serie[-1].importe

    return DashboardAdminOut(
        indicadores=IndicadoresDashboardOut(
            alumnos_inscriptos=alumnos_inscriptos,
            inscripciones_activas=inscripciones_activas,
            cupo_promedio_ocupado=cupo_promedio,
            comisiones=len(comisiones),
            comisiones_vigentes=len(vigentes),
            cobros_pendientes=comprobantes_pendientes + cobranzas_observadas,
            comprobantes_pendientes=comprobantes_pendientes,
            cobranzas_observadas=cobranzas_observadas,
            cobrado_mes_actual=cobrado_mes_actual,
        ),
        cobros_por_mes=serie,
        ocupacion_por_comision=ocupacion_por_comision,
        comprobantes_recientes=_comprobantes_recientes(session),
        agenda=_agenda(session, vigentes, referencia),
    )


def _porcentaje(inscriptos: int, cupo: int) -> Decimal:
    """Ocupación con un decimal y tope de 100, aunque haya sobrecupo."""
    if cupo <= 0:
        return Decimal("0.0")
    valor = min(Decimal(inscriptos) * 100 / Decimal(cupo), Decimal(100))
    return valor.quantize(UN_DECIMAL, rounding=ROUND_HALF_UP)


def _contar_comprobantes(session: Session, estado: str) -> int:
    return (
        session.scalar(
            select(func.count(ComprobanteAlumno.id)).where(ComprobanteAlumno.estado == estado)
        )
        or 0
    )


def _contar_cobranzas(session: Session, estado: str) -> int:
    return (
        session.scalar(
            select(func.count(Cobranza.id)).where(Cobranza.estado == estado)
        )
        or 0
    )


def _primer_dia_del_mes(referencia: date, desplazamiento: int) -> date:
    indice = referencia.year * 12 + (referencia.month - 1) + desplazamiento
    return date(indice // 12, indice % 12 + 1, 1)


def _serie_de_cobros(session: Session, referencia: date) -> list[CobroMesOut]:
    """Importe acreditado por mes, últimos seis meses, con ceros reales.

    Se leen las fechas e importes del período y se agrupa en memoria: son seis meses de cobros y
    así la consulta no depende de una función de fecha de PostgreSQL. Solo suma `ACREDITADO`; lo
    observado y lo rechazado no es dinero cobrado.
    """
    inicio = _primer_dia_del_mes(referencia, -(MESES_DE_LA_SERIE - 1))
    siguiente = _primer_dia_del_mes(referencia, 1)
    filas = session.execute(
        select(Cobranza.fecha, Cobranza.importe).where(
            Cobranza.estado == EstadoCobranza.ACREDITADO.value,
            Cobranza.fecha >= inicio,
            Cobranza.fecha < siguiente,
        )
    ).all()

    totales: dict[str, Decimal] = {}
    for fecha, importe in filas:
        clave = f"{fecha.year:04d}-{fecha.month:02d}"
        totales[clave] = totales.get(clave, Decimal("0")) + Decimal(importe)

    return [
        CobroMesOut(
            mes=f"{mes.year:04d}-{mes.month:02d}",
            importe=totales.get(f"{mes.year:04d}-{mes.month:02d}", Decimal("0")),
        )
        for mes in (
            _primer_dia_del_mes(referencia, desplazamiento)
            for desplazamiento in range(-(MESES_DE_LA_SERIE - 1), 1)
        )
    ]


def _comprobantes_recientes(session: Session):
    """Los cinco comprobantes más recientes, de cualquier estado, por fecha de recepción."""
    filas = session.scalars(
        select(ComprobanteAlumno)
        .where(ComprobanteAlumno.estado != EstadoComprobanteAlumno.PENDIENTE_CARGA.value)
        .options(
            selectinload(ComprobanteAlumno.alumno),
            selectinload(ComprobanteAlumno.revisor),
            selectinload(ComprobanteAlumno.inscripcion)
            .selectinload(Inscripcion.comision)
            .selectinload(Comision.curso),
        )
        .order_by(ComprobanteAlumno.enviado_at.desc(), ComprobanteAlumno.id.desc())
        .limit(COMPROBANTES_RECIENTES)
    ).all()
    return [comprobantes.serializar_para_revision(fila) for fila in filas]


def _agenda(
    session: Session, comisiones: list[Comision], referencia: date
) -> list[EncuentroAgendaOut]:
    return [
        EncuentroAgendaOut(**encuentro)
        for encuentro in agenda.encuentros_de_comisiones(
            session, comisiones, referencia, limite=ENCUENTROS_EN_AGENDA
        )
    ]
