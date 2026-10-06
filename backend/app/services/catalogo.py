"""Reglas de negocio del catálogo: alta y consulta de cursos, comisiones y sedes.

Historias #1, #2, #5 y #8. Vive en `services` y no en el router porque son reglas de negocio,
no detalles de transporte (D1): la ruta solo traduce una excepción a un código HTTP.

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

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision, Curso, Sede
from app.models.enums import EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Docente
from app.schemas.catalogo import ComisionCreate, CursoCreate
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
    positivo, arancel positivo, sede obligatoria para Presencial e Híbrido— no se validan acá:
    son CHECK de la base, y una regla que se sostiene en dos lugares es una regla que se
    desincroniza.
    """
    curso = session.get(Curso, datos.curso_id)
    if curso is None:
        raise CursoNoEncontrado(datos.curso_id)

    if session.get(Docente, datos.docente_id) is None:
        raise DocenteNoEncontrado(datos.docente_id)

    if datos.sede_id is not None and session.get(Sede, datos.sede_id) is None:
        raise SedeNoEncontrada(datos.sede_id)

    comision = Comision(
        curso_id=curso.id,
        docente_id=datos.docente_id,
        numero=_siguiente_numero(session, curso.id),
        dias_horarios=datos.dias_horarios,
        cupo_maximo=datos.cupo_maximo,
        arancel=datos.arancel,
        modalidad=datos.modalidad.value,
        sede_id=datos.sede_id,
    )
    session.add(comision)
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        if INDICE_COMISION_NUMERO in _motivo(error):
            raise NumeracionDeComisionEnConflicto from error
        # `modalidad_presencial_requiere_sede`, `cupo_maximo_positivo` y `arancel_positivo`
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


def _siguiente_numero(session: Session, curso_id: int) -> int:
    """El número siguiente de un curso: su máximo más uno, o 1 si no tiene comisiones."""
    mayor = session.scalar(select(func.max(Comision.numero)).where(Comision.curso_id == curso_id))
    return (mayor or 0) + 1


def _motivo(error: IntegrityError) -> str:
    """El nombre de la restricción violada, sin depender del texto del mensaje."""
    diagnostico = getattr(error.orig, "diag", None)
    return str(getattr(diagnostico, "constraint_name", "") or error.orig)
