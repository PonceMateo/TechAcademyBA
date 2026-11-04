"""Agenda compartida por los tres tableros (H/U 55, 56 y 57).

**Una sola regla para los tres roles.** El detalle del alumno, la próxima clase del docente y la
agenda de Administración derivan los encuentros de las filas de `comision_horario` y del período de
la comisión. Tener tres implementaciones de "próxima clase" termina mostrando fechas distintas para
el mismo horario.

**La agenda es por fecha, no por hora.** Incluye el día corriente completo, aunque la clase de la
mañana ya haya terminado: es la regla que ya usaban el alumno y el docente, y cambiarla obligaría a
comparar horas en zona horaria. No conoce feriados ni suspensiones (D82).

**Los temas salen de `Clase` en una sola consulta por lote.** Cuando la agenda junta varias
comisiones, las fechas se calculan primero y después se leen todos los temas de una vez: la pantalla
del administrador no hace una consulta por comisión.
"""

from __future__ import annotations

from datetime import date, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalogo import Comision
from app.models.clases import Clase
from app.models.enums import DiaSemana
from app.schemas.alumno import EncuentroOut

#: Cuántos encuentros muestra el detalle de una cursada. Cuatro es lo que entra sin scroll en la
#: tarjeta del cronograma.
ENCUENTROS_VISIBLES = 4

#: Día de la semana de Python (`Monday=0`) para cada día del enum `DiaSemana`.
DIA_DE_LA_SEMANA = {
    DiaSemana.LUN: 0,
    DiaSemana.MAR: 1,
    DiaSemana.MIE: 2,
    DiaSemana.JUE: 3,
    DiaSemana.VIE: 4,
    DiaSemana.SAB: 5,
    DiaSemana.DOM: 6,
}

#: Días corridos que cubre la agenda de un tablero, contando hoy.
DIAS_DE_AGENDA = 7


def proximos_encuentros(
    session: Session,
    comision: Comision,
    desde: date,
    *,
    limite: int = ENCUENTROS_VISIBLES,
    hasta: date | None = None,
) -> list[EncuentroOut]:
    """Los próximos encuentros de una comisión, del más cercano al más lejano.

    **Los días salen de los horarios, cada uno trae su hora y el tema de `Clase`.** El `horario`
    del encuentro es el rango de ese día de la semana en la grilla de la comisión, así la agenda y
    el detalle dicen a qué hora se dicta y no solo en qué fecha. Mientras nadie haya cargado la
    clase de esa fecha, el encuentro viaja sin tema: no hay ningún "tema a confirmar" que mostrar.
    """
    dias = {DIA_DE_LA_SEMANA[DiaSemana(horario.dia)] for horario in comision.horarios}
    fechas = fechas_de_cursada(comision, desde, dias, limite=limite, hasta=hasta)
    if not fechas:
        return []

    temas = dict(
        session.execute(
            select(Clase.fecha, Clase.tema).where(
                Clase.comision_id == comision.id,
                Clase.fecha.in_(fechas),
            )
        ).all()
    )

    return [
        EncuentroOut(
            fecha=fecha,
            horario=", ".join(rangos_del_dia(comision, fecha)) or None,
            tema=temas.get(fecha),
        )
        for fecha in fechas
    ]


def encuentros_de_comisiones(
    session: Session,
    comisiones: list[Comision],
    desde: date,
    *,
    limite: int = 8,
    dias_ventana: int = DIAS_DE_AGENDA,
) -> list[dict[str, object]]:
    """Agenda conjunta de varias comisiones, ordenada por fecha y hora.

    Devuelve diccionarios con el contexto que necesita el tablero del administrador: la comisión,
    el curso y el docente, además de la fecha, el horario y el tema. Los temas se leen en una sola
    consulta para todas las comisiones y fechas de la ventana.
    """
    if limite <= 0:
        return []

    hasta = desde + timedelta(days=max(dias_ventana, 1) - 1)
    pares: list[tuple[Comision, date]] = []
    for comision in comisiones:
        if comision.fecha_fin is not None and comision.fecha_fin < desde:
            continue
        dias = {DIA_DE_LA_SEMANA[DiaSemana(horario.dia)] for horario in comision.horarios}
        for fecha in fechas_de_cursada(comision, desde, dias, limite=limite, hasta=hasta):
            pares.append((comision, fecha))

    if not pares:
        return []

    temas = {
        (comision_id, fecha): tema
        for comision_id, fecha, tema in session.execute(
            select(Clase.comision_id, Clase.fecha, Clase.tema).where(
                Clase.comision_id.in_({comision.id for comision, _ in pares}),
                Clase.fecha.in_({fecha for _, fecha in pares}),
            )
        ).all()
    }

    encuentros = [
        {
            "fecha": fecha,
            "horario": ", ".join(rangos_del_dia(comision, fecha)) or None,
            "tema": temas.get((comision.id, fecha)),
            "codigo": comision.codigo,
            "nombre_curso": comision.curso.nombre,
            "docente_nombre": comision.docente_nombre,
        }
        for comision, fecha in pares
    ]
    encuentros.sort(
        key=lambda encuentro: (
            encuentro["fecha"],
            encuentro["horario"] or "",
            encuentro["codigo"],
        )
    )
    return encuentros[:limite]


def fechas_de_cursada(
    comision: Comision,
    desde: date,
    dias: set[int],
    *,
    limite: int,
    hasta: date | None = None,
) -> list[date]:
    """Las fechas de cursada del período, desde `desde`, en orden cronológico.

    Arranca en el día corriente o en la fecha de inicio de la comisión, la que sea posterior, así
    que una comisión que todavía no empezó no muestra encuentros del pasado. Termina en la fecha de
    fin de la comisión o en `hasta`, la que llegue primero: una cursada terminada no informa
    encuentros y la agenda no se pasa de su ventana (historia #49). Sin días cargados no hay nada
    que derivar.
    """
    if not dias or limite <= 0:
        return []

    fecha = desde
    if comision.fecha_inicio is not None:
        fecha = max(desde, comision.fecha_inicio)

    fin = comision.fecha_fin
    if hasta is not None and (fin is None or hasta < fin):
        fin = hasta

    fechas: list[date] = []
    while len(fechas) < limite:
        if fin is not None and fecha > fin:
            break
        if fecha.weekday() in dias:
            fechas.append(fecha)
        fecha += timedelta(days=1)
    return fechas


def rangos_del_dia(comision: Comision, fecha: date) -> list[str]:
    """Los rangos `HH:MM-HH:MM` de esa fecha en la grilla de la comisión, en orden de carga.

    Una comisión puede dictar más de un tramo el mismo día: los dos viajan, separados por coma.
    """
    return [
        f"{hora(horario.inicio)}-{hora(horario.fin)}"
        for horario in comision.horarios
        if DIA_DE_LA_SEMANA[DiaSemana(horario.dia)] == fecha.weekday()
    ]


def hora(valor: time) -> str:
    return f"{valor.hour:02d}:{valor.minute:02d}"
