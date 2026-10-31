"""Reglas de negocio del catálogo: alta, edición y consulta de cursos, comisiones y sedes.

Historias #1, #2, #3, #4, #5 y #8. Vive en `services` y no en el router porque son reglas de
negocio, no detalles de transporte (D1): la ruta solo traduce una excepción a un código HTTP.

**Este módulo confirma la transacción.** `get_db` cierra la sesión sin confirmar, así que la
primera ruta que escribe tiene que confirmar por su cuenta. Se confirma acá y no en la ruta
porque un servicio que deja la transacción abierta se puede usar mal sin que nada lo note.

**Lo que este módulo no hace, y por qué.** El código del curso no se calcula: lo genera la
columna de la base (D32). Lo único que hay que hacer es leerlo después del `flush`, porque un
`INSERT` no devuelve el valor de una columna generada y sin ese `refresh` la respuesta
devolvería `codigo = None`. El número de la comisión sí se calcula, porque depende del curso y
la base no lo puede sacar sola.

**Los rechazos nombran el dato que se repitió.** Los criterios de #1 y #9 piden saber qué
colisionó, no solo que algo colisionó. Por eso hay una comprobación previa que trae la fila que
choca —para poder nombrarla— y el `IntegrityError` queda como la red que corta la carrera entre
dos altas simultáneas.
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import (
    Comision,
    ComisionHorario,
    Curso,
    Sede,
    clases_del_periodo,
    resumen_de_horarios,
)
from app.models.enums import EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Docente
from app.schemas.catalogo import (
    ComisionCreate,
    ComisionUpdate,
    CursoCreate,
    CursoUpdate,
    HorarioComision,
)
from app.services.normalization import normalize_name

logger = logging.getLogger(__name__)

#: Restricción que PostgreSQL levanta cuando el nombre del curso ya está usado. La comparación
#: va por **nombre de restricción** y no por el texto del mensaje, porque el texto cambia entre
#: versiones de PostgreSQL y el nombre no.
INDICE_NOMBRE_CURSO = "uq_curso_nombre_norm"

#: Restricción que corta la carrera entre dos altas simultáneas de comisión del mismo curso
#: con el mismo número (D34). No es un error de quien carga: la API responde 409 con la
#: invitación a reintentar.
INDICE_COMISION_NUMERO = "uq_comision_curso_numero"


class CursoDuplicado(Exception):
    """Ya hay un curso con ese nombre, ignorando mayúsculas, acentos y espacios.

    `existente` puede venir `None` solo en la carrera entre dos altas simultáneas: ahí no se
    puede nombrar el curso porque su transacción todavía no confirmada es invisible, y el
    mensaje se degrada en vez de inventar un nombre.
    """

    def __init__(self, existente: Curso | None) -> None:
        self.existente = existente
        if existente is None:
            super().__init__("Ese nombre de curso se acaba de registrar. Probá de nuevo.")
        else:
            super().__init__(
                f"Ya existe un curso con ese nombre: {existente.codigo} — {existente.nombre}."
            )


class NumeracionDeComisionEnConflicto(Exception):
    """Dos altas simultáneas sacaron el mismo número para el mismo curso.

    Es la carrera de D34, no un error de quien carga.
    """

    def __init__(self) -> None:
        super().__init__(
            "Otra alta de comisión para el mismo curso se está guardando al mismo tiempo. "
            "Probá de nuevo en un momento."
        )


class CursoNoEncontrado(Exception):
    def __init__(self, curso_id: int) -> None:
        self.curso_id = curso_id
        super().__init__(f"El curso {curso_id} no existe.")


class DocenteNoEncontrado(Exception):
    def __init__(self, docente_id: int) -> None:
        self.docente_id = docente_id
        super().__init__(f"El docente {docente_id} no existe.")


class SedeNoEncontrada(Exception):
    def __init__(self, sede_id: int) -> None:
        self.sede_id = sede_id
        super().__init__(f"La sede {sede_id} no existe.")


class ComisionNoEncontrada(Exception):
    def __init__(self, comision_id: int) -> None:
        self.comision_id = comision_id
        super().__init__(f"La comisión {comision_id} no existe.")


class HorarioDelDocenteEnConflicto(Exception):
    """El docente ya dicta otra comisión vigente que se pisa con este horario (historia #48).

    Nombra la comisión en conflicto con su código, su día y su rango porque el formulario muestra
    ese texto bajo `Días y Horarios`: quien está cargando el horario tiene que saber contra qué
    choca, no solo que choca.
    """

    def __init__(self, comision: Comision, horario: ComisionHorario) -> None:
        self.comision = comision
        self.horario = horario
        super().__init__(
            f"Ese horario se superpone con la comisión {comision.codigo} "
            f"({resumen_de_horarios([horario])}), que dicta el mismo docente."
        )


class CupoInsuficiente(Exception):
    """El cupo nuevo dejaría a la comisión con más inscriptos que lugares (HU #4).

    `inscriptos` viaja en la excepción para que el mensaje diga el número actual y no una
    vaguedad: la secretaría necesita saber hasta cuánto puede reducir.
    """

    def __init__(self, inscriptos: int) -> None:
        self.inscriptos = inscriptos
        super().__init__(
            f"La comisión tiene {inscriptos} inscriptos activos: el cupo máximo no puede ser "
            f"menor que {inscriptos}."
        )


class PeriodoInvalido(Exception):
    """El período de cursada no cumple las reglas del alta o de la edición (historia #49).

    Viaja como excepción de dominio y no como validador de Pydantic para que el `422` lleve el
    mensaje en es-AR en el `detail`: es el único texto que el frontend muestra. El CHECK
    `ck_comision_periodo_coherente` sigue siendo la red de seguridad en la base.
    """


def crear_curso(session: Session, datos: CursoCreate) -> Curso:
    """Crea un curso y devuelve el código que le generó la base (D32).

    El nombre se normaliza con `normalize_name` **antes** de insertar (D6), para que
    `"Curso Python"` y `"curso  de  python"` colisionen contra `uq_curso_nombre_norm`.

    La comprobación previa existe para poder decir *qué* curso choca: el `IntegrityError` solo
    nombra la restricción. Es la carrera entre dos altas simultáneas la que deja pasar, y ahí
    el índice la corta con un mensaje degradado.
    """
    nombre_norm = normalize_name(datos.nombre)

    existente = session.scalar(select(Curso).where(Curso.nombre_norm == nombre_norm))
    if existente is not None:
        raise CursoDuplicado(existente)

    curso = Curso(nombre=datos.nombre, nombre_norm=nombre_norm, descripcion=datos.descripcion)
    session.add(curso)
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        if INDICE_NOMBRE_CURSO not in _motivo(error):
            raise
        raise CursoDuplicado(None) from error

    session.commit()
    # El `refresh` posterior al `commit` no es opcional: el `INSERT` no devuelve el valor de
    # una columna generada, así que sin esto la respuesta devolvería `codigo = None`.
    session.refresh(curso)
    return curso


def obtener_curso(session: Session, curso_id: int) -> Curso:
    """El curso por identificador, o `CursoNoEncontrado` para que la ruta responda 404.

    La edición lo resuelve antes de tocar el nombre: un `id` inexistente no puede chocar con
    la unicidad ni dejar una fila a medio actualizar.
    """
    curso = session.get(Curso, curso_id)
    if curso is None:
        raise CursoNoEncontrado(curso_id)
    return curso


def editar_curso(session: Session, curso: Curso, datos: CursoUpdate) -> Curso:
    """Actualiza nombre y descripción conservando el `id`, el código y las comisiones (HU #3).

    La unicidad se compara contra el resto del catálogo **excluyendo el propio curso**: guardar
    el mismo nombre no choca contra su propia fila. El índice `uq_curso_nombre_norm` sigue
    cortando la carrera entre dos ediciones simultáneas, y ahí el mensaje se degrada porque el
    curso que chocó todavía no es visible (mismo criterio que el alta).
    """
    nombre_norm = normalize_name(datos.nombre)

    existente = session.scalar(
        select(Curso).where(Curso.nombre_norm == nombre_norm, Curso.id != curso.id)
    )
    if existente is not None:
        raise CursoDuplicado(existente)

    curso.nombre = datos.nombre
    curso.nombre_norm = nombre_norm
    curso.descripcion = datos.descripcion
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        if INDICE_NOMBRE_CURSO not in _motivo(error):
            raise
        raise CursoDuplicado(None) from error

    session.commit()
    session.refresh(curso)
    return curso


def listar_cursos(session: Session) -> list[Curso]:
    return list(session.scalars(select(Curso).order_by(Curso.id)))


def crear_comision(session: Session, datos: ComisionCreate) -> Comision:
    """Crea una comisión y devuelve el código derivado que le corresponde (D34).

    El `numero` es el máximo de los números de ese curso más uno. **Techo asumido:** dos altas
    simultáneas del mismo curso pueden calcular el mismo número, y lo corta
    `uq_comision_curso_numero` con un 409. A la escala declarada del proyecto (10 comisiones) no
    hace falta una secuencia por curso ni un lock; si el volumen llegara a importar, el arreglo
    es un `SELECT ... MAX(numero) ... FOR UPDATE` sobre el curso y no toca el contrato.

    El curso, el docente y la sede se validan antes de insertar para que un identificador que
    no existe responda 404 en vez de un 500 de clave foránea. Las reglas de la comisión —cupo
    positivo, arancel positivo y `modalidad_virtual_sin_sede`, que prohíbe la sede en Virtual—
    no se validan acá: son CHECK de la base, y una regla que se sostiene en dos lugares es una
    regla que se desincroniza. La sede es **opcional en toda modalidad**, así que su ausencia no
    es un rechazo.

    El período sí se valida acá: necesita los horarios ya armados y un mensaje en es-AR, que es
    lo que la ruta devuelve en el `detail` del `422` (historia #49).
    """
    curso = session.get(Curso, datos.curso_id)
    if curso is None:
        raise CursoNoEncontrado(datos.curso_id)

    if session.get(Docente, datos.docente_id) is None:
        raise DocenteNoEncontrado(datos.docente_id)

    if datos.sede_id is not None and session.get(Sede, datos.sede_id) is None:
        raise SedeNoEncontrada(datos.sede_id)

    conflicto = _horario_en_conflicto(session, datos.docente_id, datos.horarios)
    if conflicto is not None:
        raise HorarioDelDocenteEnConflicto(conflicto.comision, conflicto)

    horarios = _armar_horarios(datos.horarios)
    _validar_periodo(datos.fecha_inicio, datos.fecha_fin, horarios)
    comision = Comision(
        curso_id=curso.id,
        docente_id=datos.docente_id,
        numero=_siguiente_numero(session, curso.id),
        dias_horarios=resumen_de_horarios(horarios),
        cupo_maximo=datos.cupo_maximo,
        arancel=datos.arancel,
        modalidad=datos.modalidad.value,
        sede_id=datos.sede_id,
        fecha_inicio=datos.fecha_inicio,
        fecha_fin=datos.fecha_fin,
        horarios=horarios,
    )
    session.add(comision)
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        if INDICE_COMISION_NUMERO in _motivo(error):
            raise NumeracionDeComisionEnConflicto from error
        # `modalidad_virtual_sin_sede`, `cupo_maximo_positivo` y `arancel_positivo`
        # también llegan como IntegrityError. Siguen subiendo: la ruta los traduce a 422 y el
        # mensaje de PostgreSQL ya dice qué regla se incumplió.
        raise

    session.commit()
    session.refresh(comision)
    # En una comisión recién creada no hay inscripciones, así que las vacantes son el cupo
    # completo. Se calcula acá y no en la ruta para que el valor de la respuesta lo arme
    # quien escribe la fila, y no quien la traduce.
    comision.vacantes = comision.cupo_maximo
    return comision


def obtener_comision(session: Session, comision_id: int) -> Comision:
    """La comisión por identificador, o `ComisionNoEncontrada` para que la ruta responda 404.

    La edición la resuelve antes de validar el docente o el cupo: un `id` inexistente no puede
    terminar en un `404` del docente que confunda a quien está corrigiendo el formulario.
    """
    comision = session.get(Comision, comision_id)
    if comision is None:
        raise ComisionNoEncontrada(comision_id)
    return comision


def editar_comision(session: Session, comision: Comision, datos: ComisionUpdate) -> Comision:
    """Actualiza docente, días y horarios, arancel, cupo y período (historias #4 y #49).

    El curso, el número, la modalidad y la sede no se tocan: no forman parte del contrato.
    Las inscripciones y los pagos siguen asociados a la misma comisión porque el `id` no cambia.

    El cupo se compara contra las inscripciones **ACTIVA**, el mismo criterio que `vacantes` (D10)
    y que el rechazo de la comisión llena: `EN_ESPERA`, `BAJA` y `COMPLETADA` no ocupan banco. La
    cuenta y el `UPDATE` no están serializados contra una inscripción simultánea, igual que el
    alta de inscripción (D51).

    El período no recalcula aranceles ni toca las inscripciones ni los pagos: solo se guarda el
    calendario nuevo, y los importes ya calculados de cada inscripción quedan como estaban (D64).
    """
    if session.get(Docente, datos.docente_id) is None:
        raise DocenteNoEncontrado(datos.docente_id)

    inscriptos = _inscriptos_activos(session, comision.id)
    if datos.cupo_maximo < inscriptos:
        raise CupoInsuficiente(inscriptos)

    # El período se valida antes de tocar las filas del horario: un rechazo no puede dejar la
    # sesión con los `DELETE` a medio camino.
    horarios = _armar_horarios(datos.horarios)
    _validar_periodo(datos.fecha_inicio, datos.fecha_fin, horarios)

    # La propia comisión queda afuera del chequeo: reenviar sus horarios actuales no puede ser un
    # conflicto consigo misma.
    conflicto = _horario_en_conflicto(
        session, datos.docente_id, datos.horarios, excluir_comision_id=comision.id
    )
    if conflicto is not None:
        raise HorarioDelDocenteEnConflicto(conflicto.comision, conflicto)

    # Las filas viejas se borran **antes** de insertar las nuevas: si se dejaran al unit of work,
    # el `INSERT` de un día que sigue existiendo choca con `uq_comision_horario_comision_id_dia`,
    # porque el `DELETE` llega después.
    comision.horarios.clear()
    session.flush()

    comision.docente_id = datos.docente_id
    comision.horarios = horarios
    comision.dias_horarios = resumen_de_horarios(horarios)
    comision.arancel = datos.arancel
    comision.cupo_maximo = datos.cupo_maximo
    comision.fecha_inicio = datos.fecha_inicio
    comision.fecha_fin = datos.fecha_fin
    session.commit()
    session.refresh(comision)

    # Las vacantes no son una columna (D10): se recalculan con la misma cuenta que acaba de
    # validar el cupo, para que la respuesta no tenga que volver a pedir el listado entero.
    comision.vacantes = max(comision.cupo_maximo - inscriptos, 0)
    return comision


def _inscriptos_activos(session: Session, comision_id: int) -> int:
    """Cantidad de inscripciones `ACTIVA` de la comisión, que es lo que ocupa el cupo."""
    return (
        session.scalar(
            select(func.count(Inscripcion.id)).where(
                Inscripcion.comision_id == comision_id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
            )
        )
        or 0
    )


def listar_comisiones(session: Session) -> list[Comision]:
    """Comisiones con el curso, el docente y las vacantes ya resueltos.

    Las vacantes salen de **una sola** consulta agrupada (D10): recorrer `inscripcion` comisión
    por comisión sería una consulta por fila. Vienen como atributo de la instancia y no como
    columna porque D10 dice que no se persisten, así que un `refresh` posterior las borra: son
    un dato de la respuesta, no del objeto.
    """
    comisiones = list(
        session.scalars(
            select(Comision)
            .options(
                selectinload(Comision.curso),
                selectinload(Comision.docente),
                selectinload(Comision.sede),
                selectinload(Comision.horarios),
            )
            .order_by(Comision.id)
        )
    )

    inscriptas = dict(
        session.execute(
            select(Inscripcion.comision_id, func.count(Inscripcion.id))
            .where(
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
                Inscripcion.comision_id.is_not(None),
            )
            .group_by(Inscripcion.comision_id)
        ).all()
    )

    for comision in comisiones:
        comision.vacantes = max(comision.cupo_maximo - inscriptas.get(comision.id, 0), 0)
    return comisiones


def listar_sedes(session: Session) -> list[Sede]:
    """Sedes activas. Es un endpoint de lectura: no hay historia que pida el alta (historia #8)."""
    return list(session.scalars(select(Sede).where(Sede.activo.is_(True)).order_by(Sede.id)))


def _validar_periodo(
    inicio: date, fin: date, horarios: list[ComisionHorario]
) -> None:
    """Rechaza el período incoherente o sin clases antes de escribir (historia #49).

    Las dos reglas viven acá y no en el schema porque el `422` de un validador de Pydantic
    viaja como arreglo y el frontend solo muestra un `detail` de texto. El conteo usa
    `clases_del_periodo`, la misma función que después informa `cantidad_clases` y que va a usar
    el prorrateo de la H/U 50, así que el rechazo y el número no pueden divergir.
    """
    if fin < inicio:
        raise PeriodoInvalido("La fecha de fin no puede ser anterior a la de inicio.")
    if clases_del_periodo(inicio, fin, horarios) == 0:
        raise PeriodoInvalido(
            "El período no contiene ninguna clase: revisá las fechas o los días de cursada."
        )


def _armar_horarios(datos: list[HorarioComision]) -> list[ComisionHorario]:
    """Las filas de horario nuevas, listas para asignar a la comisión.

    Las filas se arman a partir de la lista que mandó el formulario, que es el estado completo del
    horario: al asignarlas, el `delete-orphan` de la relación borra las que ya no están.
    """
    return [
        ComisionHorario(dia=dato.dia.value, inicio=dato.inicio, fin=dato.fin) for dato in datos
    ]


def _horario_en_conflicto(
    session: Session,
    docente_id: int,
    horarios: list[HorarioComision],
    excluir_comision_id: int | None = None,
) -> ComisionHorario | None:
    """La primera fila del docente que se pisa con alguno de estos horarios, o `None`.

    La comparación es **estricta** (`a.inicio < b.fin and b.inicio < a.fin`), así que un rango que
    termina a las 18:30 y otro que empieza a las 18:30 no chocan. Solo participan comisiones
    vigentes: la baja lógica va por `activo`, y una comisión dada de baja no ocupa el horario del
    docente. Incluye comisiones de otros cursos, porque el docente es la misma persona.

    **Techo asumido:** dos altas simultáneas del mismo docente pueden pasar las dos por acá, porque
    la comprobación es de aplicación y no un lock. A la escala del proyecto es aceptable; si
    importara, el arreglo es un lock por docente y no cambia el contrato.
    """
    consulta = (
        select(ComisionHorario)
        .join(Comision, Comision.id == ComisionHorario.comision_id)
        .where(
            Comision.docente_id == docente_id,
            Comision.activo.is_(True),
            ComisionHorario.dia.in_([dato.dia.value for dato in horarios]),
        )
        .options(selectinload(ComisionHorario.comision).selectinload(Comision.curso))
        .order_by(ComisionHorario.dia, ComisionHorario.id)
    )
    if excluir_comision_id is not None:
        consulta = consulta.where(Comision.id != excluir_comision_id)

    existentes = session.scalars(consulta).all()
    for candidato in horarios:
        for fila in existentes:
            if fila.dia != candidato.dia.value:
                continue
            if candidato.inicio < fila.fin and fila.inicio < candidato.fin:
                return fila
    return None


def _siguiente_numero(session: Session, curso_id: int) -> int:
    """El número siguiente de un curso: su máximo más uno, o 1 si no tiene comisiones."""
    mayor = session.scalar(select(func.max(Comision.numero)).where(Comision.curso_id == curso_id))
    return (mayor or 0) + 1


def _motivo(error: IntegrityError) -> str:
    """El nombre de la restricción violada, sin depender del texto del mensaje."""
    diagnostico = getattr(error.orig, "diag", None)
    return str(getattr(diagnostico, "constraint_name", "") or error.orig)
