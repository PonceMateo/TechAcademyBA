"""4.2 — Padrón: docentes, alumnos y cuentas de usuario."""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.models.enums import Rol, TipoDocumento
from app.services.emails import EmailAlreadyRegistered, ensure_email_available
from app.services.normalization import normalize_document
from app.tests.conftest import assert_rechazado
from app.tests.factories import (
    crear_alumno,
    crear_docente,
    crear_usuario_admin,
    crear_usuario_docente,
)


def test_alta_de_docente_sin_cuil(db_session: Session) -> None:
    """Historia #9 y D33: el docente se crea con acceso por su email, y el CUIL no se pide.

    El valor por defecto de la fábrica es `None`: en esta fase los docentes no son personas
    reales y un CUIL inventado sería peor que ninguno.
    """
    docente = crear_docente(db_session)
    assert docente.cuil is None
    assert docente.email.endswith("@techacademy.invalid")


def test_alta_de_docente_con_cuil(db_session: Session) -> None:
    """D33: la columna no se borró, sigue aceptando el dato cuando hay docente real."""
    docente = crear_docente(db_session, cuil="27345678907")
    assert docente.cuil == "27345678907"


def test_varios_docentes_sin_cuil_conviven(db_session: Session) -> None:
    """D33: el índice único sobre `cuil` sobrevive a los nulos.

    PostgreSQL admite varios nulos en un índice único, así que la obligatoriedad que se
    revirtió no dejó el índice pidiendo un valor inventado.
    """
    primero = crear_docente(db_session, dni="30111222", email="uno@techacademy.invalid")
    segundo = crear_docente(db_session, dni="30111999", email="dos@techacademy.invalid")

    assert primero.cuil is None and segundo.cuil is None


def test_cuil_duplicado_es_rechazado(db_session: Session) -> None:
    """D33: el CUIL sigue siendo único cuando está cargado."""
    crear_docente(db_session, cuil="27345678907")
    motivo = assert_rechazado(
        crear_docente,
        db_session,
        dni="30111999",
        email="otro@techacademy.invalid",
        cuil="27345678907",
    )
    assert "uq_docente_cuil" in motivo


def test_dni_de_docente_duplicado_es_rechazado(db_session: Session) -> None:
    """Historia #9: el DNI es único dentro del padrón de docentes."""
    crear_docente(db_session, dni="30111222")
    motivo = assert_rechazado(
        crear_docente,
        db_session,
        dni="30.111.222",
        cuil="20345678902",
        email="otro@techacademy.invalid",
    )
    assert "uq_docente_dni_norm" in motivo


def test_email_de_docente_duplicado_es_rechazado(db_session: Session) -> None:
    crear_docente(db_session, email="rita.molina@techacademy.invalid")
    motivo = assert_rechazado(
        crear_docente,
        db_session,
        dni="30111999",
        cuil="20345678902",
        email="rita.molina@techacademy.invalid",
    )
    assert "uq_docente_email" in motivo


def test_alta_de_alumno(db_session: Session) -> None:
    alumno = crear_alumno(db_session)
    assert alumno.documento_norm == "38111222"


def test_documento_de_alumno_duplicado_es_rechazado(db_session: Session) -> None:
    """Historia #13: el DNI o pasaporte ya registrado se rechaza."""
    crear_alumno(db_session, documento="38111222")
    motivo = assert_rechazado(
        crear_alumno,
        db_session,
        nombre="Otra alumna",
        documento="38-111.222",
        email="otra@techacademy.invalid",
    )
    assert "uq_alumno_documento_norm" in motivo


def test_alumno_del_exterior_sin_dni(db_session: Session) -> None:
    """D30: el padrón tiene que poder alojar a un alumno que no tiene DNI, porque el
    instituto lo inscribe. Varios pueden convivir porque un índice único en PostgreSQL
    admite múltiples nulos."""
    primero = crear_alumno(
        db_session,
        nombre="Nicolás Castro",
        documento="U1234567",
        tipo_documento=TipoDocumento.PASAPORTE.value,
        email="nicolas.castro@techacademy.invalid",
    )
    segundo = crear_alumno(
        db_session,
        nombre="Otra alumna del exterior",
        documento=None,
        tipo_documento=None,
        email="otra.exterior@techacademy.invalid",
    )

    assert primero.documento_norm == "U1234567".replace("U", "")  # solo dígitos
    assert segundo.documento_norm is None


def test_documento_y_tipo_documento_van_juntos(db_session: Session) -> None:
    """Un número sin decir de qué tipo es no significa nada."""
    motivo = assert_rechazado(
        crear_alumno,
        db_session,
        nombre="Alumna sin tipo",
        documento="40111222",
        tipo_documento=None,
        email="sin.tipo@techacademy.invalid",
    )
    assert "ck_alumno_documento_y_tipo_juntos" in motivo


def test_cuenta_docente_sin_docente_es_rechazada(db_session: Session) -> None:
    """D4: `DOCENTE` exige docente y no admite alumno."""
    from app.models.padron import Usuario

    usuario = Usuario(
        email="huerfano@techacademy.invalid",
        nombre="Cuenta huérfana",
        password_hash="$2b$12$placeholder",
        rol=Rol.DOCENTE.value,
    )
    motivo = assert_rechazado(lambda: (db_session.add(usuario), db_session.flush())[1])
    assert "ck_usuario_rol_vinculo_coherente" in motivo


def test_cuenta_admin_no_puede_tener_docente_ni_alumno(db_session: Session) -> None:
    """D4: `ADMIN` es Administración y Secretaría, no un tercero con vínculos."""
    from app.models.padron import Usuario

    docente = crear_docente(db_session)
    usuario = Usuario(
        email="admin.con.docente@techacademy.invalid",
        nombre="Administración con vínculo",
        password_hash="$2b$12$placeholder",
        rol=Rol.ADMIN.value,
        docente_id=docente.id,
    )
    motivo = assert_rechazado(lambda: (db_session.add(usuario), db_session.flush())[1])
    assert "ck_usuario_rol_vinculo_coherente" in motivo


def test_cuenta_docente_con_docente_es_aceptada(db_session: Session) -> None:
    usuario = crear_usuario_docente(db_session)
    assert usuario.docente_id is not None
    assert usuario.alumno_id is None
    assert usuario.rol == Rol.DOCENTE.value


def test_cuenta_admin_sin_vinculos_es_aceptada(db_session: Session) -> None:
    usuario = crear_usuario_admin(db_session)
    assert usuario.docente_id is None
    assert usuario.alumno_id is None


def test_email_repetido_entre_docente_y_alumno_es_rechazado(db_session: Session) -> None:
    """Historia #13 y D5: una misma dirección no identifica a dos personas.

    **Ojo con cómo se rechaza.** D5 dice que los tres emails son únicos cada uno "lo que
    garantiza unicidad global", y eso no es cierto a nivel de base: un índice único es
    por tabla. Lo que la base garantiza es la unicidad dentro de cada padrón y la
    unicidad global de `usuario.email`; la unicidad cruzada entre `docente` y `alumno` la
    verifica el servicio, que es donde vive la regla de negocio (D1).
    """
    correo = "compartido@techacademy.invalid"
    crear_docente(db_session, email=correo)

    with pytest.raises(EmailAlreadyRegistered) as excepcion:
        ensure_email_available(db_session, correo)

    assert excepcion.value.padrón == "docentes"


def test_el_servicio_de_email_ignora_el_propio_registro(db_session: Session) -> None:
    """Un docente tiene que poder guardar su propio perfil sin que su fila lo bloquee."""
    correo = "rita.molina@techacademy.invalid"
    docente = crear_docente(db_session, email=correo)

    ensure_email_available(db_session, correo, exclude_docente_id=docente.id)


def test_normalizador_de_documento() -> None:
    assert normalize_document("30-71665544-9") == "30716655449"
    assert normalize_document("30 111 222") == "30111222"
    assert normalize_document("sin dígitos") is None
    assert normalize_document(None) is None
