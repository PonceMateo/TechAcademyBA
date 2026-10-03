"""4.4 — Pagador, cobranza, imputación y factura."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalogo import Comision
from app.models.cobranza import Cobranza, Imputacion
from app.models.enums import EstadoCobranza, TipoFactura
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno
from app.tests.conftest import assert_rechazado
from app.tests.factories import (
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_empresa,
    crear_factura,
    crear_imputacion,
    crear_inscripcion,
    crear_pagador,
    crear_usuario_admin,
)


def test_registro_de_pago_valido(db_session: Session) -> None:
    """Historia #21: fecha, importe mayor que cero y medio de pago."""
    cobranza = crear_cobranza(db_session, importe="31000.00")
    assert cobranza.importe == Decimal("31000.00")
    assert cobranza.estado == EstadoCobranza.ACREDITADO.value


@pytest.mark.parametrize("importe", ["0", "-500"])
def test_importe_menor_o_igual_a_cero_es_rechazado(db_session: Session, importe: str) -> None:
    motivo = assert_rechazado(crear_cobranza, db_session, importe=Decimal(importe))
    assert "ck_cobranza_cobranza_importe_positivo" in motivo


def test_importe_nulo_es_rechazado(db_session: Session) -> None:
    """M16: el modelo no admite el importe en `null`, que es lo que lleva el ejemplo del
    comprobante ilegible del 19/05. Por eso esa fila no podría crearse contra la base real.

    Lo rechaza el `NOT NULL` de la columna, y no el CHECK `cobranza_importe_positivo`, que
    solo caza el cero y los negativos. Qué hacer con un comprobante ilegible es una decisión
    de las historias #21 y #45, no de este change.
    """
    cobranza = crear_cobranza(db_session)
    cobranza.importe = None

    motivo = assert_rechazado(lambda: db_session.flush())
    assert 'column "importe"' in motivo


def test_fecha_futura_es_rechazada(db_session: Session) -> None:
    """Historia #21: la fecha de una cobranza no puede ser futura."""
    cobranza = crear_cobranza(db_session)
    cobranza.fecha = date.today() + timedelta(days=1)

    motivo = assert_rechazado(lambda: db_session.flush())
    assert "ck_cobranza_cobranza_fecha_no_futura" in motivo


def test_medio_de_pago_invalido_es_rechazado(db_session: Session) -> None:
    motivo = assert_rechazado(crear_cobranza, db_session, medio="CRIPTO")
    assert "ck_cobranza_medio_pago_valido" in motivo


def test_observada_sin_causa_es_rechazada(db_session: Session) -> None:
    """D28 / historia #45: sin la causa, un comprobante ilegible y una mora de tres meses
    son indistinguibles. Y eso es exactamente la ambigüedad que el cliente reporta."""
    motivo = assert_rechazado(
        crear_cobranza, db_session, estado=EstadoCobranza.OBSERVADO.value, causa=None
    )
    assert "ck_cobranza_causa_obligatoria_si_no_acreditado" in motivo


def test_observada_con_causa_en_blanco_es_rechazada(db_session: Session) -> None:
    motivo = assert_rechazado(
        crear_cobranza, db_session, estado=EstadoCobranza.OBSERVADO.value, causa="   "
    )
    assert "ck_cobranza_causa_obligatoria_si_no_acreditado" in motivo


@pytest.mark.parametrize("estado", [EstadoCobranza.OBSERVADO, EstadoCobranza.RECHAZADO])
def test_comprobante_no_acreditado_con_causa_es_aceptado(db_session: Session, estado) -> None:
    """Historia #24 y #45: se guarda el estado y la causa."""
    cobranza = crear_cobranza(db_session, estado=estado.value, causa="comprobante ilegible")
    assert cobranza.causa == "comprobante ilegible"


def test_acreditada_no_necesita_causa(db_session: Session) -> None:
    cobranza = crear_cobranza(db_session, estado=EstadoCobranza.ACREDITADO.value, causa=None)
    assert cobranza.causa is None


def test_cambio_de_estado_registra_usuario_y_fecha(db_session: Session) -> None:
    """Historia #24: el cambio de estado queda con su autor y su fecha."""
    admin = crear_usuario_admin(db_session)
    cobranza = crear_cobranza(
        db_session, estado=EstadoCobranza.OBSERVADO.value, causa="cheque pendiente"
    )

    cobranza.estado = EstadoCobranza.ACREDITADO.value
    cobranza.causa = None
    cobranza.estado_cambiado_por = admin.id
    cobranza.estado_cambiado_at = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires"))
    db_session.flush()

    assert cobranza.estado == EstadoCobranza.ACREDITADO.value
    assert cobranza.estado_cambiado_por == admin.id
    assert cobranza.estado_cambiado_at is not None


def test_autor_y_fecha_del_cambio_van_juntos(db_session: Session) -> None:
    """Si queda el autor sin la fecha, el cambio no está auditado."""
    cobranza = crear_cobranza(db_session)
    cobranza.estado_cambiado_at = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires"))
    motivo = assert_rechazado(lambda: db_session.flush())
    assert "ck_cobranza_estado_cambiado_registro_completo" in motivo


def test_dos_comprobantes_no_acreditados_con_causas_distintas(db_session: Session) -> None:
    """Historia #45: cada uno muestra su propia causa, de modo que no se confundan."""
    ilegible = crear_cobranza(
        db_session,
        estado=EstadoCobranza.OBSERVADO.value,
        causa="comprobante ilegible",
        importe="30000.00",
    )
    cheque = crear_cobranza(
        db_session,
        estado=EstadoCobranza.OBSERVADO.value,
        causa="cheque pendiente de acreditación",
        importe="390000.00",
    )
    assert ilegible.causa != cheque.causa


def test_pagador_no_es_alumno(db_session: Session) -> None:
    """Historia #22: el titular es un tercero y no entra al padrón de alumnos."""
    pagador = crear_pagador(db_session, nombre="Familiar de Agustina")
    cobranza = crear_cobranza(db_session, pagador_id=pagador.id)

    total_alumnos = db_session.scalar(select(func.count()).select_from(Alumno))
    assert total_alumnos == 0, "crear un pagador no puede crear alumnos"
    assert cobranza.pagador_id == pagador.id


def test_cuit_de_pagador_con_formato_incorrecto_es_rechazado(db_session: Session) -> None:
    """Historia #22: un CUIT de pagador con formato incorrecto se rechaza."""
    motivo = assert_rechazado(crear_pagador, db_session, documento="12345")
    assert "ck_pagador_pagador_documento_formato" in motivo


def test_pagador_sin_documento_es_valido(db_session: Session) -> None:
    """No todos los comprobantes traen un documento del titular."""
    pagador = crear_pagador(db_session, nombre="Pagador anónimo", documento=None)
    assert pagador.documento_norm is None


def test_imputacion_a_un_alumno(db_session: Session) -> None:
    """Historia #23: la imputación queda asociada a la inscripción del alumno."""
    inscripcion = crear_inscripcion(db_session)
    cobranza = crear_cobranza(db_session)

    imputacion = crear_imputacion(
        db_session, cobranza=cobranza, inscripcion=inscripcion, monto="31000.00"
    )
    assert imputacion.inscripcion_id == inscripcion.id
    assert imputacion.empresa_id is None


def test_imputacion_a_una_empresa(db_session: Session) -> None:
    """Historia #23: la imputación queda asociada a la cuenta de la empresa."""
    empresa = crear_empresa(db_session)
    cobranza = crear_cobranza(db_session, importe="240000.00")

    imputacion = crear_imputacion(db_session, cobranza=cobranza, empresa_id=empresa.id)
    assert imputacion.empresa_id == empresa.id
    assert imputacion.inscripcion_id is None


def test_imputacion_sin_destino_es_rechazada(db_session: Session) -> None:
    """D7: destino único."""
    cobranza = crear_cobranza(db_session)
    motivo = assert_rechazado(crear_imputacion, db_session, cobranza=cobranza)
    assert "ck_imputacion_imputacion_destino_unico" in motivo


def test_imputacion_con_dos_destinos_es_rechazada(db_session: Session) -> None:
    """D7: una imputación no puede ir a la vez a un alumno y a una empresa."""
    inscripcion = crear_inscripcion(db_session)
    empresa = crear_empresa(db_session)
    cobranza = crear_cobranza(db_session)

    motivo = assert_rechazado(
        crear_imputacion,
        db_session,
        cobranza=cobranza,
        inscripcion=inscripcion,
        empresa_id=empresa.id,
    )
    assert "ck_imputacion_imputacion_destino_unico" in motivo


def test_imputacion_de_monto_no_positivo_es_rechazada(db_session: Session) -> None:
    inscripcion = crear_inscripcion(db_session)
    cobranza = crear_cobranza(db_session)
    motivo = assert_rechazado(
        crear_imputacion,
        db_session,
        cobranza=cobranza,
        inscripcion=inscripcion,
        monto=Decimal("0"),
    )
    assert "ck_imputacion_imputacion_monto_positivo" in motivo


def test_no_existe_columna_de_saldo_en_cobranza(db_session: Session) -> None:
    """D10: el saldo no imputado se deriva, no se persiste. Si alguien agrega la columna,
    la suma de imputaciones puede desincronizarse del importe."""
    assert "saldo" not in Cobranza.__table__.columns
    assert "saldo_no_imputado" not in Cobranza.__table__.columns


def test_la_inscripcion_no_expone_estado_de_habilitacion(db_session: Session) -> None:
    """D9: el estado de habilitación se calcula, nunca se guarda.

    Es la razón de fondo de D9: el estado guardado miente. El Excel del cliente guarda
    `Habilitado_Link_Clase = "NO - No pago"` para una alumna que en realidad mandó un
    comprobante que no se lee.
    """
    columnas = set(Inscripcion.__table__.columns.keys())
    assert columnas == {
        "id",
        "alumno_id",
        "comision_id",
        "categoria",
        "porcentaje_beca",
        "empresa_id",
        "estado",
        "created_at",
        "updated_at",
    }, (
        "inscripcion cambió: si aparece un campo de estado de habilitación, "
        "se está contradiciendo D9"
    )
    assert "habilitacion" not in columnas
    assert "habilitado" not in columnas


def test_factura_a_emitida(db_session: Session) -> None:
    """Historia #25: el estado queda registrado."""
    empresa = crear_empresa(db_session, requiere_factura_a=True)
    factura = crear_factura(
        db_session, empresa_id=empresa.id, tipo=TipoFactura.A.value, requerida=True, emitida=True
    )
    assert factura.emitida is True
    assert factura.tipo == "A"


def test_factura_b_de_un_alumno_particular(db_session: Session) -> None:
    """D29: la factura B es la del consumidor final, y se registra."""
    alumno = crear_alumno(db_session)
    factura = crear_factura(db_session, alumno=alumno, tipo=TipoFactura.B.value)
    assert factura.tipo == "B"
    assert factura.alumno_id == alumno.id


def test_factura_de_tipo_invalido_es_rechazada(db_session: Session) -> None:
    alumno = crear_alumno(db_session)
    motivo = assert_rechazado(crear_factura, db_session, alumno=alumno, tipo="C")
    assert "ck_factura_tipo_factura_valido" in motivo


def test_factura_sin_destino_es_rechazada(db_session: Session) -> None:
    motivo = assert_rechazado(crear_factura, db_session, tipo=TipoFactura.B.value)
    assert "ck_factura_factura_destino_unico" in motivo


def test_factura_con_dos_destinos_es_rechazada(db_session: Session) -> None:
    alumno = crear_alumno(db_session)
    empresa = crear_empresa(db_session)
    motivo = assert_rechazado(
        crear_factura, db_session, alumno=alumno, empresa_id=empresa.id, tipo=TipoFactura.B.value
    )
    assert "ck_factura_factura_destino_unico" in motivo


def test_empresa_que_no_requiere_factura_a_no_tiene_seguimiento(db_session: Session) -> None:
    """Historia #25: si no se requiere Factura A, no hay nada pendiente que seguir."""
    empresa = crear_empresa(db_session, requiere_factura_a=False)
    motivo = assert_rechazado(
        crear_factura,
        db_session,
        empresa_id=empresa.id,
        tipo=TipoFactura.A.value,
        requerida=False,
        emitida=True,
    )
    assert "ck_factura_factura_no_requerida_no_emitida" in motivo


def test_la_comision_no_expone_vacantes_ni_estado(db_session: Session) -> None:
    """D10 y `design.md` (Gaps abiertos #14): las vacantes se derivan y los estados de
    comisión de la planilla del cliente no se modelan."""
    columnas = set(Comision.__table__.columns.keys())
    assert "vacantes" not in columnas
    assert "estado" not in columnas
    assert "activo" in columnas, "la baja lógica va con `activo`"


def test_el_legajo_de_un_alumno_del_exterior_acepta_pasaporte(db_session: Session) -> None:
    """D30, extremo del dominio: el alumno sin DNI se inscribe igual."""
    alumno = crear_alumno(
        db_session,
        nombre="Nicolás Castro",
        documento=None,
        tipo_documento=None,
        email="nicolas.castro@techacademy.invalid",
    )
    comision = crear_comision(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    assert inscripcion.alumno_id == alumno.id


def test_imputacion_tiene_cobranza_obligatoria(db_session: Session) -> None:
    inscripcion = crear_inscripcion(db_session)
    imputacion = Imputacion(inscripcion_id=inscripcion.id, monto=Decimal("1000"))
    motivo = assert_rechazado(lambda: (db_session.add(imputacion), db_session.flush())[1])
    assert "cobranza_id" in motivo
