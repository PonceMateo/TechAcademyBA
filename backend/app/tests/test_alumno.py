"""Contrato del autoservicio del alumno (HUs #38, #42 y #43).

**Pruebas de unidad del esquema**: no tocan la base, porque lo que afirman es qué acepta y qué
rechaza el contrato de entrada antes de llegar al servicio. La contracara contra PostgreSQL está en
`test_alumno_api.py`.

La edición del perfil es el caso que importa: el alumno puede cambiar su email y su teléfono, y
**nada más**. El documento, el nombre y el identificador del sistema no están en el contrato, así
que un cuerpo que los mande tiene que caer acá y no depender de que el servicio los ignore.
"""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from app.models.clases import Clase
from app.models.enums import CategoriaInscripcion, EstadoHabilitacion
from app.schemas.alumno import PerfilAlumnoUpdate
from app.services import alumnos as servicio_alumnos
from app.services.alumno import (
    CursadaNoEncontrada,
    actualizar_perfil,
    listar_inscripciones,
    obtener_detalle,
    obtener_perfil,
)
from app.services.auth import CredencialesInvalidas, autenticar
from app.services.emails import EmailAlreadyRegistered
from app.tests.factories import (
    PASSWORD_DE_PRUEBA,
    crear_alumno,
    crear_comision,
    crear_curso,
    crear_docente,
    crear_empresa,
    crear_inscripcion,
    crear_override,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_alumno,
)

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


# --- Servicio: detalle de la cursada (HU 38) ---------------------------------------------------


def test_el_detalle_trae_la_comision_los_horarios_y_el_acceso(db_session) -> None:
    docente = crear_docente(db_session, nombre="Laura", apellido="Benítez")
    comision = crear_comision(db_session, docente=docente)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.CORPORATIVO.value,
        empresa_id=crear_empresa(db_session).id,
    )

    detalle = obtener_detalle(db_session, usuario, comision.codigo)

    assert detalle.comision.codigo == comision.codigo
    assert detalle.comision.docente_nombre == "Laura Benítez"
    assert detalle.comision.horario == "Lun y Mié 18-20hs"
    assert detalle.categoria == CategoriaInscripcion.CORPORATIVO.value
    assert detalle.acceso.estado == EstadoHabilitacion.HABILITADO.value


def test_el_detalle_no_expone_el_link_de_la_clase(db_session) -> None:
    """El link llega con la HU 39: antes de eso no forma parte del contrato."""
    comision = crear_comision(db_session)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    detalle = obtener_detalle(db_session, usuario, comision.codigo)

    assert "link" not in detalle.model_dump()
    assert "link_virtual" not in detalle.model_dump()["comision"]


def test_una_comision_ajena_responde_igual_que_una_inexistente(db_session) -> None:
    """El mismo error en los dos casos: la respuesta no dice si la comisión existe (D58)."""
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    curso = crear_curso(db_session)
    agustina = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=agustina)
    propia = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=agustina, comision=propia)

    otro = crear_alumno(
        db_session, nombre="Otro Alumno", documento="39999888", email="otro2@techacademy.invalid"
    )
    ajena = crear_comision(db_session, curso=curso, docente=docente, sede=sede)
    crear_inscripcion(db_session, alumno=otro, comision=ajena)

    with pytest.raises(CursadaNoEncontrada) as de_otro:
        obtener_detalle(db_session, usuario, ajena.codigo)
    with pytest.raises(CursadaNoEncontrada) as inexistente:
        obtener_detalle(db_session, usuario, "CUR999-9")

    assert str(de_otro.value) == str(inexistente.value)


# --- Servicio: próximos encuentros (HU 38) -----------------------------------------------------

#: Lunes. Los encuentros de una comisión de lunes y miércoles salen de acá con fechas fijas.
HOY = date(2026, 10, 26)


def test_los_encuentros_salen_en_orden_cronologico(db_session) -> None:
    comision = crear_comision(
        db_session, horarios_semana=[("LUN", "18:00", "20:00"), ("MIE", "18:00", "20:00")]
    )
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    detalle = obtener_detalle(db_session, usuario, comision.codigo, hoy=HOY)

    assert [encuentro.fecha for encuentro in detalle.proximos_encuentros] == [
        date(2026, 10, 26),
        date(2026, 10, 28),
        date(2026, 11, 2),
        date(2026, 11, 4),
    ]


def test_un_encuentro_sin_clase_cargada_viene_sin_tema(db_session) -> None:
    comision = crear_comision(db_session, horarios_semana=[("LUN", "18:00", "20:00")])
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    detalle = obtener_detalle(db_session, usuario, comision.codigo, hoy=HOY)

    assert detalle.proximos_encuentros[0].tema is None


def test_el_tema_sale_de_la_clase_cargada_para_esa_fecha(db_session) -> None:
    comision = crear_comision(db_session, horarios_semana=[("LUN", "18:00", "20:00")])
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)
    db_session.add(
        Clase(comision_id=comision.id, fecha=date(2026, 10, 26), tema="Variables y tipos")
    )
    db_session.flush()

    detalle = obtener_detalle(db_session, usuario, comision.codigo, hoy=HOY)

    assert detalle.proximos_encuentros[0].tema == "Variables y tipos"
    # La clase de esa fecha no completa las otras: cada encuentro trae su propio tema.
    assert detalle.proximos_encuentros[1].tema is None


def test_una_comision_que_empieza_mas_adelante_no_muestra_encuentros_pasados(db_session) -> None:
    comision = crear_comision(db_session, horarios_semana=[("LUN", "18:00", "20:00")])
    comision.fecha_inicio = date(2026, 11, 9)
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    detalle = obtener_detalle(db_session, usuario, comision.codigo, hoy=HOY)

    assert detalle.proximos_encuentros[0].fecha == date(2026, 11, 9)


# --- Servicio: perfil del alumno (HU 43) --------------------------------------------------------


def test_el_perfil_trae_los_datos_del_alumno_autenticado(db_session) -> None:
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    perfil = obtener_perfil(usuario)

    assert perfil.nombre == alumno.nombre
    assert perfil.documento == alumno.documento
    assert perfil.email == alumno.email
    assert perfil.telefono == alumno.telefono


def test_un_perfil_sin_telefono_lo_devuelve_vacio(db_session) -> None:
    alumno = crear_alumno(db_session)
    alumno.telefono = None
    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    assert obtener_perfil(usuario).telefono is None


def test_guardar_el_contacto_actualiza_el_padron_y_la_cuenta(db_session) -> None:
    """Si las dos filas no se sincronizan, el email nuevo no sirve para entrar (D58)."""
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno, email="agustina@viejomail.com")

    perfil = actualizar_perfil(
        db_session,
        usuario,
        PerfilAlumnoUpdate(email="agustina@nuevomail.com", telefono="+5491140000003"),
    )

    assert perfil.email == "agustina@nuevomail.com"
    assert perfil.telefono == "+5491140000003"
    assert alumno.email == "agustina@nuevomail.com"
    assert usuario.email == "agustina@nuevomail.com"
    # El email viejo deja de servir para entrar y el nuevo sí.
    with pytest.raises(CredencialesInvalidas):
        autenticar(db_session, "agustina@viejomail.com", PASSWORD_DE_PRUEBA)
    assert autenticar(db_session, "agustina@nuevomail.com", PASSWORD_DE_PRUEBA).id == usuario.id


def test_un_email_de_otra_cuenta_es_un_conflicto_y_no_cambia_nada(db_session) -> None:
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno, email="agustina@mail.com")
    otro = crear_alumno(
        db_session, nombre="Otro Alumno", documento="39999888", email="ocupado@mail.com"
    )

    with pytest.raises(EmailAlreadyRegistered):
        actualizar_perfil(
            db_session,
            usuario,
            PerfilAlumnoUpdate(email=otro.email, telefono="+5491140000003"),
        )

    assert alumno.email == "agustina.benitez@techacademy.invalid"
    assert usuario.email == "agustina@mail.com"
    assert alumno.telefono == "+54 11 4000-0002"


def test_guardar_el_mismo_email_no_es_un_conflicto(db_session) -> None:
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    perfil = actualizar_perfil(
        db_session,
        usuario,
        PerfilAlumnoUpdate(email=alumno.email, telefono="+5491140000004"),
    )

    assert perfil.email == alumno.email


def test_borrar_el_telefono_lo_deja_no_informado(db_session) -> None:
    alumno = crear_alumno(db_session)
    usuario = crear_usuario_alumno(db_session, alumno=alumno)

    perfil = actualizar_perfil(
        db_session, usuario, PerfilAlumnoUpdate(email=alumno.email, telefono="")
    )

    assert perfil.telefono is None
    assert alumno.telefono is None


def test_un_telefono_invalido_no_se_persiste(db_session) -> None:
    alumno = crear_alumno(db_session)
    crear_usuario_alumno(db_session, alumno=alumno)

    with pytest.raises(ValidationError):
        PerfilAlumnoUpdate(email=alumno.email, telefono="011 4788-1122")

    assert alumno.telefono == "+54 11 4000-0002"
