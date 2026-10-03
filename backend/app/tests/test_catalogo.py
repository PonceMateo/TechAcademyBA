"""4.1 — Catálogo: cursos, sedes y comisiones.

Cada test le pide a PostgreSQL una restricción concreta y mira el motivo del rechazo, de
modo que si la restricción desapareciera el test falla diciendo cuál era.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models.catalogo import Comision, Curso, Sede
from app.models.enums import Modalidad
from app.services.normalization import normalize_code, normalize_name
from app.tests.conftest import assert_rechazado
from app.tests.factories import crear_comision, crear_curso, crear_docente, crear_sede


def test_alta_de_curso_sin_duplicados(db_session: Session) -> None:
    curso = crear_curso(db_session, codigo="CUR-101", nombre="Python Inicial")
    assert curso.id is not None
    assert curso.codigo == "CUR-101", "el valor tal como lo escribió el operador se conserva"


def test_codigo_duplicado_por_normalizacion(db_session: Session) -> None:
    """Historia #1: `CUR-101` y `CUR101` son el mismo curso. Un índice único sobre la
    columna cruda no lo detectaría; por eso existe `codigo_norm` (D6)."""
    crear_curso(db_session, codigo="CUR-101", nombre="Python Inicial")

    motivo = assert_rechazado(crear_curso, db_session, codigo="cur101", nombre="otro nombre")

    assert "uq_curso_codigo_norm" in motivo


def test_nombre_duplicado_por_normalizacion(db_session: Session) -> None:
    """Historia #1: el nombre también es único, tolerando acentos y espacios."""
    crear_curso(db_session, codigo="CUR-101", nombre="Categoría Ónica")
    motivo = assert_rechazado(crear_curso, db_session, codigo="OTRO-1", nombre="categoria onica")
    assert "uq_curso_nombre_norm" in motivo


def test_curso_sin_codigo_es_rechazado(db_session: Session) -> None:
    """Historia #1: el código es obligatorio."""
    motivo = assert_rechazado(crear_curso, db_session, codigo="", nombre="Sin código")
    assert "codigo" in motivo


def test_curso_sin_nombre_es_rechazado(db_session: Session) -> None:
    """Historia #1: el nombre es obligatorio."""
    motivo = assert_rechazado(crear_curso, db_session, codigo="SIN-NOMBRE", nombre="")
    assert "nombre" in motivo


def test_editar_curso_conserva_el_historial_de_sus_comisiones(db_session: Session) -> None:
    """Historia #3: cambiar el nombre del curso no desasocia las comisiones."""
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso)
    identificador_comision = comision.id

    curso.nombre = "Python Inicial (2026)"
    curso.nombre_norm = normalize_name(curso.nombre)
    db_session.flush()

    comision_reevaluada = db_session.get(Comision, identificador_comision)
    assert comision_reevaluada is not None
    assert comision_reevaluada.curso_id == curso.id


def test_codigo_de_comision_unico(db_session: Session) -> None:
    sede = crear_sede(db_session)
    crear_comision(
        db_session, codigo="COM-105", sede=sede, curso=crear_curso(db_session, codigo="CUR-200")
    )
    motivo = assert_rechazado(
        crear_comision,
        db_session,
        codigo="COM-105",
        sede=sede,
        curso=crear_curso(db_session, codigo="CUR-300", nombre="Otro curso"),
    )
    assert "uq_comision_codigo" in motivo


def test_sede_unica_por_nombre(db_session: Session) -> None:
    crear_sede(db_session, nombre="Sede Central")
    motivo = assert_rechazado(crear_sede, db_session, nombre="Sede Central")
    assert "uq_sede_nombre" in motivo


@pytest.mark.parametrize("cupo", [0, -5])
def test_cupo_cero_o_negativo_es_rechazado(db_session: Session, cupo: int) -> None:
    """Historia #5: el cupo tiene que ser un entero positivo."""
    motivo = assert_rechazado(crear_comision, db_session, cupo_maximo=cupo)
    assert "ck_comision_cupo_maximo_positivo" in motivo


@pytest.mark.parametrize("arancel", [0, -1])
def test_arancel_menor_o_igual_a_cero_es_rechazado(db_session: Session, arancel: str) -> None:
    """Historia #4: el arancel tiene que ser mayor que cero."""
    motivo = assert_rechazado(crear_comision, db_session, arancel=Decimal(arancel))
    assert "ck_comision_arancel_positivo" in motivo


@pytest.mark.parametrize("modalidad", [Modalidad.PRESENCIAL.value, Modalidad.HIBRIDO.value])
def test_modalidad_presencial_u_hibrida_sin_sede_es_rechazada(
    db_session: Session, modalidad: str
) -> None:
    """Historia #8: Presencial e Híbrido exigen sede."""
    motivo = assert_rechazado(
        crear_comision, db_session, modalidad=modalidad, con_sede=False
    )
    assert "ck_comision_modalidad_presencial_requiere_sede" in motivo


def test_modalidad_virtual_no_exige_sede(db_session: Session) -> None:
    """Historia #8: Virtual se registra sin sede."""
    comision = crear_comision(db_session, modalidad=Modalidad.VIRTUAL.value, con_sede=False)
    assert comision.sede_id is None


def test_modalidad_invalida_es_rechazada(db_session: Session) -> None:
    motivo = assert_rechazado(crear_comision, db_session, modalidad="PRESENCIAL_MAS")
    assert "ck_comision_modalidad_valida" in motivo


def test_comision_con_todos_los_datos(db_session: Session) -> None:
    """Historia #2: alta de comisión completa."""
    sede = crear_sede(db_session)
    docente = crear_docente(db_session)
    comision = crear_comision(
        db_session,
        sede=sede,
        cupo_maximo=20,
        arancel="52000.00",
        modalidad=Modalidad.HIBRIDO.value,
    )
    comision.docente_id = docente.id
    db_session.flush()

    assert comision.curso_id is not None
    assert comision.sede_id == sede.id
    assert comision.docente_id == docente.id
    assert comision.arancel == Decimal("52000.00")


def test_no_existe_columna_de_vacantes(db_session: Session) -> None:
    """D10: las vacantes se derivan de `cupo_maximo` menos las inscripciones activas. Si
    alguien agrega la columna, el estado guardado vuelve a mentir."""
    assert "vacantes" not in Comision.__table__.columns
    assert "cantidad_vacantes" not in Comision.__table__.columns


def test_toda_entidad_tiene_marcas_de_tiempo(db_session: Session) -> None:
    """Spec `domain-schema`, "Convenciones transversales del esquema"."""
    for modelo in (Curso, Sede, Comision):
        assert "created_at" in modelo.__table__.columns
        assert "updated_at" in modelo.__table__.columns


def test_updated_at_se_actualiza_solo(db_session: Session) -> None:
    """La marca de última actualización la calcula el servidor, no la aplicación."""
    curso = crear_curso(db_session)
    primera_marca = curso.created_at
    db_session.commit()

    curso.descripcion = "Descripción nueva."
    db_session.commit()

    assert curso.updated_at >= curso.created_at
    assert curso.created_at == primera_marca, "created_at no se toca al modificar"


def test_normalizadores_de_codigo_y_nombre() -> None:
    """D6, aislado de la base: la normalización es testeable por separado."""
    assert normalize_code("cur-101") == normalize_code("CUR 101") == "CUR101"
    assert normalize_code("Categoría Ónica") == "CATEGORIAONICA"
    assert normalize_name("Python  Inicial") == normalize_name("python inicial")
    assert normalize_code("CUR-101") != normalize_code("CUR-102")
