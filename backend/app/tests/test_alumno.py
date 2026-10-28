"""Contrato del autoservicio del alumno (HUs #38, #42 y #43).

**Pruebas de unidad del esquema**: no tocan la base, porque lo que afirman es qué acepta y qué
rechaza el contrato de entrada antes de llegar al servicio. La contracara contra PostgreSQL está en
`test_alumno_api.py`.

La edición del perfil es el caso que importa: el alumno puede cambiar su email y su teléfono, y
**nada más**. El documento, el nombre y el identificador del sistema no están en el contrato, así
que un cuerpo que los mande tiene que caer acá y no depender de que el servicio los ignore.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.alumno import PerfilAlumnoUpdate

#: Cuerpo válido de la edición del perfil, para cambiar un solo campo por test.
PERFIL = {
    "email": "agustina.benitez@techacademy.invalid",
    "telefono": "+5491140000002",
}


@pytest.mark.parametrize("campo", ["documento", "nombre", "id"])
def test_el_perfil_rechaza_los_campos_que_no_son_de_contacto(campo: str) -> None:
    """Documento, nombre e identificador no se editan desde el panel del alumno."""
    with pytest.raises(ValidationError) as error:
        PerfilAlumnoUpdate(**{**PERFIL, campo: "otro valor"})

    assert campo in str(error.value)


def test_el_perfil_acepta_email_y_telefono() -> None:
    perfil = PerfilAlumnoUpdate(**PERFIL)

    assert perfil.email == PERFIL["email"]
    assert perfil.telefono == PERFIL["telefono"]


@pytest.mark.parametrize("vacio", ["", "   ", None])
def test_borrar_el_telefono_es_mandar_vacio(vacio: str | None) -> None:
    """Vacío o nulo significan "no informado": el servicio guarda `None` y no un `422`."""
    assert PerfilAlumnoUpdate(**{**PERFIL, "telefono": vacio}).telefono is None


def test_un_telefono_sin_forma_internacional_se_rechaza() -> None:
    with pytest.raises(ValidationError, match="formato internacional"):
        PerfilAlumnoUpdate(**{**PERFIL, "telefono": "011 4788-1122"})


def test_un_email_sin_forma_se_rechaza() -> None:
    with pytest.raises(ValidationError, match="formato válido"):
        PerfilAlumnoUpdate(**{**PERFIL, "email": "agustina"})


# --- Servicio: cursadas del alumno (HU 38 y 42) ------------------------------------------------

from app.models.enums import CategoriaInscripcion, EstadoHabilitacion  # noqa: E402
from app.services import alumnos as servicio_alumnos  # noqa: E402
from app.services.alumno import listar_inscripciones  # noqa: E402
from app.tests.factories import (  # noqa: E402
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_docente,
    crear_inscripcion,
    crear_override,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_alumno,
)


def test_lista_solo_las_inscripciones_del_alumno(db_session) -> None:
    """La consulta parte de la cuenta: la comisión de otro alumno no puede aparecer."""
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    curso = crear_curso(db_session)
    agustina = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=agustina)
    propia = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=agustina, comision=propia)

    otro = crear_alumno(
        db_session, nombre="Otro Alumno", documento="39999888", email="otro@techacademy.invalid"
    )
    ajena = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=otro, comision=ajena)

    lista = listar_inscripciones(db_session, usuario)

    assert [inscripcion.codigo for inscripcion in lista] == [propia.codigo]


def test_la_tarjeta_trae_docente_horarios_y_categoria(db_session) -> None:
    docente = crear_docente(db_session, nombre="Laura", apellido="Benítez")
    comision = crear_comision(db_session, docente=docente)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_PARCIAL.value,
        porcentaje_beca="50",
    )

    (inscripcion,) = listar_inscripciones(db_session, usuario)

    assert inscripcion.nombre_curso == comision.curso.nombre
    assert inscripcion.docente_nombre == "Laura Benítez"
    assert inscripcion.horario == "Lun y Mié 18-20hs"
    assert [(horario.dia, horario.inicio, horario.fin) for horario in inscripcion.horarios] == [
        ("LUN", "18:00", "20:00"),
        ("MIE", "18:00", "20:00"),
    ]
    assert inscripcion.categoria == CategoriaInscripcion.BECADO_PARCIAL.value
    assert int(inscripcion.porcentaje_beca) == 50


def test_una_comision_sin_docente_no_inventa_uno(db_session) -> None:
    comision = crear_comision(db_session, con_sede=False)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    (inscripcion,) = listar_inscripciones(db_session, usuario)

    assert inscripcion.docente_nombre is None


def test_la_causa_del_bloqueo_es_la_misma_que_ve_administracion(db_session) -> None:
    """HU 42: el alumno y la secretaría tienen que leer el mismo estado y la misma causa."""
    docente = crear_docente(db_session)
    comision = crear_comision(db_session, docente=docente)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    admin = crear_usuario_admin(db_session)
    crear_override(
        db_session,
        inscripcion=inscripcion,
        usuario=admin,
        motivo="Comprobante ilegible",
        estado_forzado=EstadoHabilitacion.BLOQUEADO.value,
    )

    (del_alumno,) = listar_inscripciones(db_session, usuario)
    fila_administrativa = next(
        fila for fila in servicio_alumnos.listar_alumnos(db_session) if fila.id == alumno.id
    )

    assert del_alumno.acceso.estado == EstadoHabilitacion.BLOQUEADO.value
    assert del_alumno.acceso.causa == "Comprobante ilegible"
    assert del_alumno.acceso.forzado is True
    assert fila_administrativa.acceso.estado == del_alumno.acceso.estado
    assert fila_administrativa.acceso.causa == del_alumno.acceso.causa
    assert fila_administrativa.acceso.forzado == del_alumno.acceso.forzado


def test_un_alumno_sin_inscripciones_recibe_una_lista_vacia(db_session) -> None:
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    assert listar_inscripciones(db_session, usuario) == []
