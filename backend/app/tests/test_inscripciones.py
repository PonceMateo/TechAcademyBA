"""4.3 — Inscripciones, empresas, contratos corporativos y nóminas."""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.enums import CategoriaInscripcion, TipoContrato
from app.models.padron import Alumno
from app.tests.conftest import assert_rechazado
from app.tests.factories import (
    crear_alumno,
    crear_comision,
    crear_contrato,
    crear_empresa,
    crear_inscripcion,
    crear_nomina_empleado,
    cuit_digito_verificador,
    cuit_valido,
)

#: Prefijo de persona jurídica de AFIP, para no tener que calcularlo en cada prueba.
PREFIJO_EMPRESA = "3012345678"

# La misma regla de dígito verificador del CHECK, escrita como SQL. La prueba contrasta
# las dos implementaciones: si el CHECK de la migración y la regla de Python se separan,
# acá se ve.
_DIGITO_EN_SQL = text(
    """
    SELECT (CASE mod(
        substr(:c, 1, 1)::int * 5 + substr(:c, 2, 1)::int * 4
        + substr(:c, 3, 1)::int * 3 + substr(:c, 4, 1)::int * 2
        + substr(:c, 5, 1)::int * 7 + substr(:c, 6, 1)::int * 6
        + substr(:c, 7, 1)::int * 5 + substr(:c, 8, 1)::int * 4
        + substr(:c, 9, 1)::int * 3 + substr(:c, 10, 1)::int * 2
    , 11)
    WHEN 0 THEN 0
    WHEN 1 THEN 9
    ELSE 11 - mod(
        substr(:c, 1, 1)::int * 5 + substr(:c, 2, 1)::int * 4
        + substr(:c, 3, 1)::int * 3 + substr(:c, 4, 1)::int * 2
        + substr(:c, 5, 1)::int * 7 + substr(:c, 6, 1)::int * 6
        + substr(:c, 7, 1)::int * 5 + substr(:c, 8, 1)::int * 4
        + substr(:c, 9, 1)::int * 3 + substr(:c, 10, 1)::int * 2
    , 11) END)
    """
)


def test_alta_de_empresa_con_cuit_valido(db_session: Session) -> None:
    """Historia #18: la empresa queda disponible para contratos e inscripciones."""
    empresa = crear_empresa(db_session)
    assert empresa.cuit_norm == cuit_valido(PREFIJO_EMPRESA)
    assert empresa.requiere_factura_a is True


def test_cuit_con_formato_incorrecto_es_rechazado(db_session: Session) -> None:
    """Historia #18: `cuit_norm` solo puede tener once dígitos.

    Los dos CHECK de CUIT rechazan el valor, y PostgreSQL informa el que evaluó primero,
    así que la prueba acepta cualquiera de los dos: lo que importa es que la fila no
    entra.
    """
    motivo = assert_rechazado(crear_empresa, db_session, cuit="301234567")
    assert "ck_empresa_cuit_formato" in motivo or "ck_empresa_cuit_digito" in motivo


def test_cuit_con_digito_verificador_incorrecto_es_rechazado(db_session: Session) -> None:
    """Historia #18: el dígito verificador se valida con la regla de AFIP."""
    digito_correcto = cuit_digito_verificador(PREFIJO_EMPRESA)
    cuit_incorrecto = f"{PREFIJO_EMPRESA}{(int(digito_correcto) + 1) % 10}"

    motivo = assert_rechazado(crear_empresa, db_session, cuit=cuit_incorrecto)
    assert "ck_empresa_cuit_digito" in motivo or "ck_empresa_cuit_formato" in motivo


def test_el_digito_verificador_en_sql_cuadra_con_la_regla_de_python(db_session: Session) -> None:
    """El CHECK vive en SQL y la regla de AFIP está en Python. Se contrastan sobre una
    muestra generada, así una discrepancia entre las dos implementaciones aparece acá y
    no en producción."""
    connection = db_session.connection()
    for numero in range(1000, 1060):
        primeros_diez = f"30{numero:08d}"
        esperado = int(cuit_digito_verificador(primeros_diez))
        obtenido = connection.execute(_DIGITO_EN_SQL, {"c": primeros_diez}).scalar_one()
        assert obtenido == esperado, (
            f"el CHECK de PostgreSQL y la regla de Python discrepan para {primeros_diez}: "
            f"la base dice {obtenido} y la regla dice {esperado}"
        )


def test_cuit_duplicado_es_rechazado(db_session: Session) -> None:
    """D6: `30123456781` y `30-12345678-1` son la misma empresa."""
    digito = cuit_valido(PREFIJO_EMPRESA)[-1]
    crear_empresa(db_session, cuit=f"{PREFIJO_EMPRESA}{digito}")
    motivo = assert_rechazado(
        crear_empresa,
        db_session,
        razon_social="La misma, con guiones",
        cuit=f"30-12345678-{digito}",
    )
    assert "uq_empresa_cuit_norm" in motivo


def test_inscripcion_unica_por_alumno_y_comision(db_session: Session) -> None:
    """Historia #14: el alumno no puede estar inscripto dos veces en la misma comisión."""
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session)

    crear_inscripcion(db_session, alumno=alumno, comision=comision)
    motivo = assert_rechazado(crear_inscripcion, db_session, alumno=alumno, comision=comision)

    assert "uq_inscripcion_alumno_comision" in motivo


@pytest.mark.parametrize("porcentaje", ["0", "100", "-10", "150"])
def test_porcentaje_de_beca_fuera_de_rango_es_rechazado(
    db_session: Session, porcentaje: str
) -> None:
    """Historia #15: la beca parcial va de 1 a 99."""
    motivo = assert_rechazado(
        crear_inscripcion,
        db_session,
        categoria=CategoriaInscripcion.BECADO_PARCIAL.value,
        porcentaje_beca=Decimal(porcentaje),
    )
    assert "ck_inscripcion_porcentaje_beca_solo_para_becado_parcial" in motivo


def test_beca_parcial_con_porcentaje_valido(db_session: Session) -> None:
    """Historia #15: se guarda la categoría y el porcentaje."""
    inscripcion = crear_inscripcion(
        db_session,
        categoria=CategoriaInscripcion.BECADO_PARCIAL.value,
        porcentaje_beca="50",
    )
    assert inscripcion.porcentaje_beca == Decimal("50")


def test_beca_parcial_sin_porcentaje_es_rechazada(db_session: Session) -> None:
    motivo = assert_rechazado(
        crear_inscripcion, db_session, categoria=CategoriaInscripcion.BECADO_PARCIAL.value
    )
    assert "ck_inscripcion_porcentaje_beca_solo_para_becado_parcial" in motivo


def test_porcentaje_de_beca_en_otra_categoria_es_rechazado(db_session: Session) -> None:
    """Historia #15: en cualquier categoría que no sea becado parcial el porcentaje es nulo."""
    motivo = assert_rechazado(
        crear_inscripcion,
        db_session,
        categoria=CategoriaInscripcion.PARTICULAR.value,
        porcentaje_beca="50",
    )
    assert "ck_inscripcion_porcentaje_beca_solo_para_becado_parcial" in motivo


def test_corporativo_sin_empresa_es_rechazado(db_session: Session) -> None:
    """Historia #14: la categoría Corporativo exige una empresa registrada."""
    motivo = assert_rechazado(
        crear_inscripcion, db_session, categoria=CategoriaInscripcion.CORPORATIVO.value
    )
    assert "ck_inscripcion_corporativo_requiere_empresa" in motivo


def test_corporativo_con_empresa_es_aceptado(db_session: Session) -> None:
    empresa = crear_empresa(db_session)
    inscripcion = crear_inscripcion(
        db_session, categoria=CategoriaInscripcion.CORPORATIVO.value, empresa_id=empresa.id
    )
    assert inscripcion.empresa_id == empresa.id


def test_beca_total_no_pide_porcentaje(db_session: Session) -> None:
    """Historia #15: Becado total implica exención de pago, así que no hay descuento que
    registrar."""
    inscripcion = crear_inscripcion(db_session, categoria=CategoriaInscripcion.BECADO_TOTAL.value)
    assert inscripcion.porcentaje_beca is None


def test_charla_corporativa_no_genera_nomina(db_session: Session) -> None:
    """Historia #19: una charla cerrada no genera alumnos ni pide carga de nómina.

    La restricción está en la base, no en el servicio: `nomina_empleado.tipo_contrato`
    tiene una clave foránea compuesta contra `contrato_corporativo(id, tipo)` más un
    CHECK. Un `INSERT` directo tampoco la esquiva.
    """
    empresa = crear_empresa(db_session)
    contrato = crear_contrato(db_session, empresa=empresa, tipo=TipoContrato.CHARLA.value)

    motivo = assert_rechazado(crear_nomina_empleado, db_session, contrato=contrato)

    assert "ck_nomina_empleado_solo_curso_formal_tiene_nomina" in motivo


def test_curso_formal_admite_nomina(db_session: Session) -> None:
    """Historia #19: el curso formal carga la nómina de empleados."""
    contrato = crear_contrato(db_session, tipo=TipoContrato.CURSO_FORMAL.value)
    empleado = crear_nomina_empleado(db_session, contrato=contrato)
    assert empleado.contrato_id == contrato.id


def test_empleado_repetido_en_la_misma_nomina_es_rechazado(db_session: Session) -> None:
    """Historia #19: un empleado no aparece dos veces en la misma tanda."""
    contrato = crear_contrato(db_session, tipo=TipoContrato.CURSO_FORMAL.value)
    empleado_alumno = crear_alumno(db_session)
    crear_nomina_empleado(db_session, contrato=contrato, alumno=empleado_alumno)

    motivo = assert_rechazado(
        crear_nomina_empleado, db_session, contrato=contrato, alumno=empleado_alumno
    )
    assert "uq_nomina_contrato_alumno" in motivo


def test_empleado_ya_en_el_padron_se_vincula_sin_duplicar(db_session: Session) -> None:
    """Historia #19: si el documento ya está en el padrón, se vincula al alumno existente
    y no se duplica su registro. El modelo lo sostiene con el FK a `alumno`."""
    empleado_alumno = crear_alumno(db_session, documento="44111222")
    contrato = crear_contrato(db_session, tipo=TipoContrato.CURSO_FORMAL.value)

    crear_nomina_empleado(db_session, contrato=contrato, alumno=empleado_alumno)

    encontrados = db_session.scalars(
        select(Alumno).where(Alumno.documento_norm == "44111222")
    ).all()
    assert [alumno.id for alumno in encontrados] == [empleado_alumno.id]
