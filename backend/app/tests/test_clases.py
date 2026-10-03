"""4.5 — Clases, asistencia, override de habilitación y auditoría."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models.clases import AuditLog
from app.models.enums import EstadoAsistencia, EstadoHabilitacion
from app.tests.conftest import assert_rechazado
from app.tests.factories import (
    crear_alumno,
    crear_asistencia,
    crear_clase,
    crear_comision,
    crear_inscripcion,
    crear_override,
    crear_usuario_admin,
)


def test_clase_con_link_valido(db_session: Session) -> None:
    """Historia #33: el link queda disponible para los alumnos habilitados."""
    clase = crear_clase(db_session, link_virtual="https://zoom.us/j/987654321")
    assert clase.link_virtual == "https://zoom.us/j/987654321"


def test_clase_sin_link_es_valida(db_session: Session) -> None:
    """El link se carga después; una clase sin link todavía es una clase."""
    clase = crear_clase(db_session, link_virtual=None)
    assert clase.link_virtual is None


@pytest.mark.parametrize("link", ["zoom.us/j/987", "no-es-una-url", "https://", "ftp://a.com"])
def test_link_virtual_invalido_es_rechazado(db_session: Session, link: str) -> None:
    """Historia #33: un texto que no es una URL válida se rechaza."""
    motivo = assert_rechazado(crear_clase, db_session, link_virtual=link)
    assert "ck_clase_clase_link_virtual_url" in motivo


def test_asistencia_registrada(db_session: Session) -> None:
    """Historia #34: Presente o Ausente por alumno y clase."""
    clase = crear_clase(db_session)
    alumno = crear_alumno(db_session)
    asistencia = crear_asistencia(db_session, clase=clase, alumno=alumno)
    assert asistencia.estado == EstadoAsistencia.PRESENTE.value


def test_asistencia_repetida_para_el_mismo_alumno_y_clase_es_rechazada(
    db_session: Session,
) -> None:
    """Historia #34: modificar una asistencia actualiza el registro, no lo duplica."""
    clase = crear_clase(db_session)
    alumno = crear_alumno(db_session)
    crear_asistencia(db_session, clase=clase, alumno=alumno)

    motivo = assert_rechazado(crear_asistencia, db_session, clase=clase, alumno=alumno)
    assert "uq_asistencia_clase_alumno" in motivo


def test_correccion_de_asistencia_actualiza_el_registro(db_session: Session) -> None:
    """Historia #34: al guardar el cambio, el registro se actualiza y los totales se
    recalculan."""
    clase = crear_clase(db_session)
    alumno = crear_alumno(db_session)
    asistencia = crear_asistencia(db_session, clase=clase, alumno=alumno)

    asistencia.estado = EstadoAsistencia.AUSENTE.value
    db_session.commit()

    assert asistencia.estado == EstadoAsistencia.AUSENTE.value


def test_asistencia_con_estado_invalido_es_rechazada(db_session: Session) -> None:
    from app.models.clases import Asistencia

    clase = crear_clase(db_session)
    alumno = crear_alumno(db_session)
    asistencia = Asistencia(clase_id=clase.id, alumno_id=alumno.id, estado="TARDE")
    motivo = assert_rechazado(lambda: (db_session.add(asistencia), db_session.flush())[1])
    assert "ck_asistencia_asistencia_estado_valido" in motivo


def test_no_existen_columnas_de_totales_de_asistencia(db_session: Session) -> None:
    """D10: los totales de presentes y ausentes se derivan por consulta."""
    from app.models.clases import Asistencia

    columnas = set(Asistencia.__table__.columns.keys())
    assert "presentes" not in columnas
    assert "ausentes" not in columnas


def test_override_con_motivo(db_session: Session) -> None:
    """Historia #30: el estado forzado prevalece y quedan usuario, fecha y motivo."""
    inscripcion = crear_inscripcion(db_session)
    admin = crear_usuario_admin(db_session)

    override = crear_override(
        db_session,
        inscripcion=inscripcion,
        usuario=admin,
        motivo="Ajuste comercial autorizado por dirección",
        estado_forzado=EstadoHabilitacion.HABILITADO.value,
    )

    assert override.activo is True
    assert override.motivo == "Ajuste comercial autorizado por dirección"
    assert override.usuario_id == admin.id
    assert override.fecha is not None


@pytest.mark.parametrize("motivo", ["", "   ", "\n\t"])
def test_override_con_motivo_vacio_es_rechazado(db_session: Session, motivo: str) -> None:
    """Historia #30: sin motivo no hay forzaje. El motivo es lo que después se le
    muestra al alumno."""
    inscripcion = crear_inscripcion(db_session)
    admin = crear_usuario_admin(db_session)

    motivo_del_error = assert_rechazado(
        crear_override, db_session, inscripcion=inscripcion, usuario=admin, motivo=motivo
    )
    assert "ck_override_habilitacion_override_motivo_obligatorio" in motivo_del_error


def test_quitar_el_forzaje_devuelve_el_estado_al_calculo(db_session: Session) -> None:
    """Historia #30: con `activo` en falso el estado vuelve a derivarse. Lo que queda en
    la base es el override, nunca el estado (D9)."""
    inscripcion = crear_inscripcion(db_session)
    admin = crear_usuario_admin(db_session)

    override = crear_override(db_session, inscripcion=inscripcion, usuario=admin)
    override.activo = False
    db_session.flush()

    assert override.activo is False
    assert "habilitacion" not in set(inscripcion.__table__.columns.keys())


def test_override_con_estado_invalido_es_rechazado(db_session: Session) -> None:
    inscripcion = crear_inscripcion(db_session)
    admin = crear_usuario_admin(db_session)
    motivo = assert_rechazado(
        crear_override,
        db_session,
        inscripcion=inscripcion,
        usuario=admin,
        estado_forzado="CUALQUIERA",
    )
    assert "ck_override_habilitacion_estado_forzado_valido" in motivo


def test_operacion_relevante_registrada(db_session: Session) -> None:
    """Spec `domain-schema`, "Registro de auditoría"."""
    admin = crear_usuario_admin(db_session)
    entrada = AuditLog(
        usuario_id=admin.id,
        accion="override.quitar",
        entidad="override_habilitacion",
        entidad_id=1,
        detalle="Motivo: ajuste comercial autorizado por dirección",
    )
    db_session.add(entrada)
    db_session.flush()

    assert entrada.id is not None
    assert entrada.created_at is not None


def test_auditoria_no_admite_modificacion(db_session: Session) -> None:
    """La inmutabilidad la impone un trigger de PostgreSQL, no una convención: sin él,
    cualquier `UPDATE` a `audit_log` pasa."""
    entrada = AuditLog(accion="alta", entidad="curso", entidad_id=1)
    db_session.add(entrada)
    db_session.flush()

    with pytest.raises(DBAPIError, match="solo_agregado"):
        db_session.execute(
            text("UPDATE audit_log SET accion = 'alterada' WHERE id = :id"), {"id": entrada.id}
        )


def test_auditoria_no_admite_borrado(db_session: Session) -> None:
    entrada = AuditLog(accion="alta", entidad="curso", entidad_id=1)
    db_session.add(entrada)
    db_session.flush()

    with pytest.raises(DBAPIError, match="solo_agregado"):
        db_session.execute(text("DELETE FROM audit_log WHERE id = :id"), {"id": entrada.id})


def test_auditoria_no_tiene_updated_at(db_session: Session) -> None:
    """Una entrada que se puede modificar ya no es una entrada de auditoría."""
    columnas = set(AuditLog.__table__.columns.keys())
    assert "created_at" in columnas
    assert "updated_at" not in columnas


def test_toda_entidad_operativa_admite_baja_logica(db_session: Session) -> None:
    """Spec `domain-schema`: las entidades con historial se dan de baja, no se borran."""
    from app.models.catalogo import Comision, Curso, Sede
    from app.models.inscripciones import Empresa
    from app.models.padron import Alumno, Docente

    for modelo in (Curso, Sede, Comision, Docente, Alumno, Empresa):
        assert "activo" in modelo.__table__.columns, f"{modelo.__name__} no admite baja lógica"


def test_el_motivo_y_el_alcance_de_la_clase_son_de_la_comision(db_session: Session) -> None:
    """Historia #33 y #38: la clase es de una comisión, y la comisión la dicta un docente."""
    from app.models.clases import Clase

    comision = crear_comision(db_session)
    clase = crear_clase(db_session, comision=comision)
    assert clase.comision_id == comision.id
    assert "docente_id" not in Clase.__table__.columns, (
        "el docente sale de la comisión; duplicarlo en la clase se desincroniza"
    )
