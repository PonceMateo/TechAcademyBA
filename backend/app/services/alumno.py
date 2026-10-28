"""Reglas del autoservicio del alumno: sus cursadas y sus datos de contacto (HUs #38, #42 y #43).

**El alumno nunca se recibe por parámetro.** Todas las funciones parten de la cuenta autenticada y
resuelven su legajo con `alumno_de`, así que ninguna consulta de este módulo puede devolver datos de
otro alumno (D60).

**El estado de habilitación no se recalcula acá.** Sale de `habilitacion.derivar_estado`, la misma
función que usa Administración, porque la causa que ve el alumno tiene que ser la administrativa —
incluido el forzado de Secretaría— (HU 42).

**El servicio devuelve los contratos de `app.schemas.alumno`.** Las tres respuestas son vistas
armadas —no filas del padrón— y el contrato es la única descripción de su forma: si se construyeran
en la capa de API habría dos lugares donde agregar un campo.
"""

from __future__ import annotations

from datetime import date, time, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import ORDEN_DIA, Comision
from app.models.clases import Clase
from app.models.enums import DiaSemana, EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.schemas.alumno import (
    AccesoAlumnoOut,
    ComisionCursadaOut,
    CronogramaOut,
    DetalleCursadaOut,
    EncuentroOut,
    HorarioCursadaOut,
    InscripcionAlumnoOut,
    PerfilAlumnoOut,
    PerfilAlumnoUpdate,
)
from app.services import habilitacion
from app.services.emails import EmailAlreadyRegistered, ensure_email_available


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


#: Cuántos encuentros venideros muestra el detalle. Cuatro es lo que entra sin scroll en la
#: tarjeta del cronograma; la lista completa espera a que exista la fecha de fin de la comisión.
ENCUENTROS_VISIBLES = 4

#: Día de la semana de Python (`Monday=0`) para cada día del enum `DiaSemana`.
DIA_DE_LA_SEMANA = {
    "LUN": 0,
    "MAR": 1,
    "MIE": 2,
    "JUE": 3,
    "VIE": 4,
    "SAB": 5,
    "DOM": 6,
}


def obtener_detalle(
    session: Session, usuario: Usuario, codigo: str, *, hoy: date | None = None
) -> DetalleCursadaOut:
    """Detalle de una cursada propia, a partir del código de la comisión (HU 38).

    **El código se busca dentro de las inscripciones del alumno, no en el catálogo.** Una comisión
    que existe pero no es suya da el mismo `CursadaNoEncontrada` que un código inexistente, así que
    la respuesta no sirve para averiguar qué comisiones tiene otro (D60).
    """
    alumno = alumno_de(usuario)
    inscripcion = _inscripcion_por_codigo(session, alumno, codigo)
    comision = inscripcion.comision

    return DetalleCursadaOut(
        comision=ComisionCursadaOut(
            codigo=comision.codigo,
            nombre=comision.curso.nombre,
            docente_nombre=comision.docente_nombre,
            horario=comision.resumen_horarios,
            horarios=_horarios(comision),
        ),
        categoria=inscripcion.categoria,
        porcentaje_beca=inscripcion.porcentaje_beca,
        acceso=_acceso(session, inscripcion),
        # `fin` no existe en el modelo (D60): el contrato informa que todavía no está definida en
        # lugar de completarla con una fecha de ejemplo.
        cronograma=CronogramaOut(inicio=comision.fecha_inicio, fin=None),
        proximos_encuentros=_proximos_encuentros(session, comision, hoy or date.today()),
    )


def _inscripcion_por_codigo(session: Session, alumno: Alumno, codigo: str) -> Inscripcion:
    buscado = _clave_de_codigo(codigo)
    for inscripcion in inscripciones_activas(session, alumno):
        if _clave_de_codigo(inscripcion.comision.codigo) == buscado:
            return inscripcion
    raise CursadaNoEncontrada("No encontré esa cursada entre tus inscripciones.")


def _clave_de_codigo(codigo: str) -> str:
    """El código comparable: sin espacios y sin distinguir mayúsculas, como el frontend."""
    return (codigo or "").strip().upper()


def _proximos_encuentros(session: Session, comision: Comision, desde: date) -> list[EncuentroOut]:
    """Los próximos `ENCUENTROS_VISIBLES` días de cursada, del más cercano al más lejano.

    **Los días salen de los horarios, cada uno trae su hora y el tema de `Clase`.** El `horario` del
    encuentro es el rango de ese día de la semana en la grilla de la comisión, así la agenda y el
    detalle dicen a qué hora se dicta y no solo en qué fecha. Mientras nadie haya cargado la clase
    de esa fecha —la carga llega con las historias #33 y #34— el encuentro viaja sin tema, en lugar
    de completarlo con un texto de ejemplo: no hay ningún "tema a confirmar" que mostrar.

    ponytail: el cálculo no conoce feriados ni suspensiones, así que un día que se dicta y no se
    dictó igual aparece. Cuando #33/#34 carguen las clases reales, la fuente del encuentro pasa a
    ser `Clase` y esto queda como respaldo.
    """
    dias = {DIA_DE_LA_SEMANA[horario.dia] for horario in comision.horarios}
    fechas = _dias_de_cursada(comision, desde, dias)
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
            horario=", ".join(_rangos_del_dia(comision, fecha)) or None,
            tema=temas.get(fecha),
        )
        for fecha in fechas
    ]


def _rangos_del_dia(comision: Comision, fecha: date) -> list[str]:
    """Los rangos `HH:MM-HH:MM` de esa fecha en la grilla de la comisión, en orden de carga.

    Una comisión puede dictar más de un tramo el mismo día: los dos viajan, separados por coma.
    """
    return [
        f"{_hora(horario.inicio)}-{_hora(horario.fin)}"
        for horario in comision.horarios
        if DIA_DE_LA_SEMANA[horario.dia] == fecha.weekday()
    ]


def _dias_de_cursada(comision: Comision, desde: date, dias: set[int]) -> list[date]:
    """Las fechas de cursada desde `desde`, en orden cronológico.

    Arranca en el día corriente o en la fecha de inicio de la comisión, la que sea posterior, así
    que una comisión que todavía no empezó no muestra encuentros del pasado. Sin días cargados no
    hay nada que derivar: devuelve una lista vacía en vez de girar para siempre.
    """
    if not dias:
        return []

    fecha = desde
    if comision.fecha_inicio is not None:
        fecha = max(desde, comision.fecha_inicio)

    fechas: list[date] = []
    while len(fechas) < ENCUENTROS_VISIBLES:
        if fecha.weekday() in dias:
            fechas.append(fecha)
        fecha += timedelta(days=1)
    return fechas


def obtener_perfil(usuario: Usuario) -> PerfilAlumnoOut:
    """Los datos del alumno autenticado, sin el identificador del sistema ni datos de terceros.

    No toca la base: el legajo y la cuenta ya vienen con la sesión autenticada.
    """
    return _perfil(alumno_de(usuario))


def actualizar_perfil(
    session: Session, usuario: Usuario, datos: PerfilAlumnoUpdate
) -> PerfilAlumnoOut:
    """Actualiza el email y el teléfono del alumno en el padrón **y en su cuenta** (HU 43).

    **Los dos datos viajan juntos porque salen de la misma pantalla, y las dos filas se escriben en
    la misma transacción.** `usuario.email` es el correo de login y `alumno.email` el del padrón: si
    se actualiara solo uno, el alumno entraría con un correo y la secretaría vería otro, o dejaría
    de poder entrar. Es el mismo patrón de la edición administrativa (D52 y D60).

    La unicidad la resuelve `ensure_email_available` excluyendo la propia cuenta —guardar el mismo
    email no puede chocar contra uno mismo— y la carrera entre dos cuentas que piden el mismo correo
    la traduce el `IntegrityError` al mismo conflicto.
    """
    alumno = alumno_de(usuario)
    ensure_email_available(
        session,
        datos.email,
        exclude_alumno_id=alumno.id,
        exclude_usuario_id=usuario.id,
    )

    alumno.email = datos.email
    alumno.telefono = datos.telefono
    usuario.email = datos.email

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if "uq_alumno_email" in str(error.orig) or "uq_usuario_email" in str(error.orig):
            raise EmailAlreadyRegistered(datos.email, "alumnos") from error
        raise

    return _perfil(alumno)


def _perfil(alumno: Alumno) -> PerfilAlumnoOut:
    return PerfilAlumnoOut(
        nombre=alumno.nombre,
        documento=alumno.documento,
        email=alumno.email,
        telefono=alumno.telefono,
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
