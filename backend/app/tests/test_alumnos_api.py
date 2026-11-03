"""Padrón de alumnos: búsqueda (HU #16) y detalle con importes por inscripción (HU 61)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import CategoriaInscripcion, EstadoCobranza, EstadoInscripcion
from app.models.padron import Usuario
from app.tests.factories import (
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_curso,
    crear_empresa,
    crear_imputacion,
    crear_inscripcion,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


def _inscripciones_de(cliente: TestClient, alumno_id: int) -> list[dict]:
    """Las inscripciones del detalle, que es donde viven la categoría y los importes (HU 61)."""
    respuesta = cliente.get(f"/alumnos/{alumno_id}")
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["inscripciones"]


def test_buscar_por_dni_devuelve_la_ficha(
    cliente_admin: TestClient, db_session: Session
) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso)
    alumno = crear_alumno(db_session, documento="12345678", email="buscado@techacademy.invalid")
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    respuesta = cliente_admin.get("/alumnos", params={"q": "12345678"})
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["id"] == alumno.id
    # HU 64: el padrón devuelve solo los datos del alumno; la categoría se lee en el detalle.
    assert "comision" not in cuerpo[0]
    assert "categoria" not in cuerpo[0]


def test_el_detalle_trae_una_entrada_por_inscripcion_con_su_categoria(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: un alumno corporativo en un curso y particular en otro muestra las dos."""
    alumno = crear_alumno(db_session)
    sede = crear_sede(db_session)
    comision_particular = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Python Inicial"),
        sede=sede,
        cupo_maximo=5,
    )
    comision_corporativa = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Data Science"),
        sede=sede,
        cupo_maximo=5,
    )
    empresa = crear_empresa(db_session)
    crear_inscripcion(db_session, alumno=alumno, comision=comision_particular)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision_corporativa,
        categoria=CategoriaInscripcion.CORPORATIVO.value,
        empresa_id=empresa.id,
    )

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["id"] == alumno.id
    assert [inscripcion["categoria"] for inscripcion in cuerpo["inscripciones"]] == [
        "PARTICULAR",
        "CORPORATIVO",
    ]
    particular, corporativa = cuerpo["inscripciones"]
    assert particular["comision"]["codigo"] == comision_particular.codigo
    assert particular["acceso"]["estado"] == "BLOQUEADO"
    assert corporativa["empresa"]["razon_social"] == empresa.razon_social
    assert corporativa["acceso"]["estado"] == "HABILITADO"


def test_el_detalle_de_un_alumno_sin_inscripciones_trae_la_lista_vacia(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["inscripciones"] == []


def test_el_detalle_no_deriva_acceso_para_una_inscripcion_no_activa(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 64: una cursada terminada informa su estado de inscripción y ningún acceso."""
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, cupo_maximo=5)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        estado=EstadoInscripcion.COMPLETADA.value,
    )

    respuesta = cliente_admin.get(f"/alumnos/{alumno.id}")

    assert respuesta.status_code == 200, respuesta.text
    [inscripcion] = respuesta.json()["inscripciones"]
    assert inscripcion["estado"] == "COMPLETADA"
    assert inscripcion["acceso"] is None


def test_el_detalle_informa_los_importes_de_una_particular_con_pago_parcial(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """HU 61: el requerido es el arancel y el saldo, lo que falta cubrir."""
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="50000.00", cupo_maximo=5)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="20000.00",
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(detalle["arancel"]) == Decimal("50000.00")
    assert Decimal(detalle["monto_requerido"]) == Decimal("50000.00")
    assert Decimal(detalle["total_pagado"]) == Decimal("20000.00")
    assert Decimal(detalle["total_observado"]) == Decimal("0")
    assert Decimal(detalle["saldo_pendiente"]) == Decimal("30000.00")


def test_la_beca_parcial_descuenta_el_requerido_y_el_saldo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="50000.00", cupo_maximo=5)
    inscripcion = crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_PARCIAL.value,
        porcentaje_beca="50",
    )
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="10000.00",
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(detalle["monto_requerido"]) == Decimal("25000.00")
    assert Decimal(detalle["saldo_pendiente"]) == Decimal("15000.00")


def test_la_beca_total_queda_exenta(cliente_admin: TestClient, db_session: Session) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="52000.00", cupo_maximo=5)
    crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_TOTAL.value,
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(detalle["monto_requerido"]) == Decimal("0")
    assert Decimal(detalle["saldo_pendiente"]) == Decimal("0")
    assert detalle["acceso"]["estado"] == "HABILITADO"


def test_la_inscripcion_corporativa_queda_a_cargo_de_la_empresa(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="52000.00", cupo_maximo=5)
    empresa = crear_empresa(db_session)
    inscripcion = crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.CORPORATIVO.value,
        empresa_id=empresa.id,
    )
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="52000.00",
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert detalle["monto_requerido"] is None
    assert detalle["saldo_pendiente"] is None
    assert Decimal(detalle["total_pagado"]) == Decimal("52000.00")


def test_el_cobro_observado_no_baja_el_saldo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="50000.00", cupo_maximo=5)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(
            db_session, estado=EstadoCobranza.OBSERVADO.value, causa="comprobante ilegible"
        ),
        inscripcion=inscripcion,
        monto="50000.00",
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(detalle["total_pagado"]) == Decimal("0")
    assert Decimal(detalle["total_observado"]) == Decimal("50000.00")
    assert Decimal(detalle["saldo_pendiente"]) == Decimal("50000.00")
    assert detalle["acceso"]["causa"] == "comprobante ilegible"


def test_el_pago_que_supera_el_requerido_no_informa_saldo_negativo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="50000.00", cupo_maximo=5)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="60000.00",
    )

    [detalle] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(detalle["saldo_pendiente"]) == Decimal("0")
    assert detalle["acceso"]["estado"] == "HABILITADO"


def test_el_requerido_se_redondea_a_centavos_y_coincide_con_el_estado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """12345.67 con beca de 33.33% da 8230.862…: se cuantiza a 8230.86, no a fracciones."""
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="12345.67", cupo_maximo=5)
    inscripcion = crear_inscripcion(
        db_session,
        alumno=alumno,
        comision=comision,
        categoria=CategoriaInscripcion.BECADO_PARCIAL.value,
        porcentaje_beca="33.33",
    )
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="8230.85",
    )

    [corto] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(corto["monto_requerido"]) == Decimal("8230.86")
    assert Decimal(corto["saldo_pendiente"]) == Decimal("0.01")
    assert corto["acceso"]["estado"] == "BLOQUEADO"

    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion,
        monto="0.01",
    )

    [completo] = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(completo["saldo_pendiente"]) == Decimal("0")
    assert completo["acceso"]["estado"] == "HABILITADO"


def test_el_saldo_sigue_al_arancel_actual_de_la_comision(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    comision = crear_comision(db_session, arancel="50000.00", cupo_maximo=5)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    [antes] = _inscripciones_de(cliente_admin, alumno.id)
    assert Decimal(antes["saldo_pendiente"]) == Decimal("50000.00")

    comision.arancel = Decimal("60000.00")
    db_session.commit()

    [despues] = _inscripciones_de(cliente_admin, alumno.id)
    assert Decimal(despues["monto_requerido"]) == Decimal("60000.00")
    assert Decimal(despues["saldo_pendiente"]) == Decimal("60000.00")


def test_dos_inscripciones_del_mismo_alumno_no_mezclan_importes(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    sede = crear_sede(db_session)
    comision_uno = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Python Inicial"),
        sede=sede,
        arancel="50000.00",
    )
    comision_dos = crear_comision(
        db_session,
        curso=crear_curso(db_session, nombre="Data Science"),
        sede=sede,
        arancel="80000.00",
    )
    inscripcion_uno = crear_inscripcion(db_session, alumno=alumno, comision=comision_uno)
    inscripcion_dos = crear_inscripcion(db_session, alumno=alumno, comision=comision_dos)
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion_uno,
        monto="20000.00",
    )
    crear_imputacion(
        db_session,
        cobranza=crear_cobranza(db_session),
        inscripcion=inscripcion_dos,
        monto="30000.00",
    )

    primero, segundo = _inscripciones_de(cliente_admin, alumno.id)

    assert Decimal(primero["saldo_pendiente"]) == Decimal("30000.00")
    assert Decimal(segundo["saldo_pendiente"]) == Decimal("50000.00")


def test_el_detalle_de_un_alumno_inexistente_da_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.get("/alumnos/999999")

    assert respuesta.status_code == 404, respuesta.text


def test_reactivable_sigue_respondiendo_despues_del_detalle(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """El detalle se declara después de `/reactivable` para no comerse la ruta (HU 64)."""
    alumno = crear_alumno(db_session)

    respuesta = cliente_admin.get(
        "/alumnos/reactivable",
        params={"documento": alumno.documento, "email": alumno.email},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() is None


def test_el_detalle_es_solo_para_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session)
    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert api_client.get(f"/alumnos/{alumno.id}").status_code == 403

    api_client.headers.clear()
    assert api_client.get(f"/alumnos/{alumno.id}").status_code == 401


def test_buscar_por_email_devuelve_la_ficha(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = crear_alumno(db_session, documento="87654321", email="unico@techacademy.invalid")

    respuesta = cliente_admin.get("/alumnos", params={"q": "unico@techacademy.invalid"})
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["id"] == alumno.id


def test_buscar_inexistente_devuelve_lista_vacia(
    cliente_admin: TestClient, db_session: Session
) -> None:
    respuesta = cliente_admin.get("/alumnos", params={"q": "99999999"})
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == []


def test_sin_consulta_lista_todos(
    cliente_admin: TestClient, db_session: Session
) -> None:
    crear_alumno(db_session, documento="11111111", email="a@techacademy.invalid")
    crear_alumno(db_session, documento="22222222", email="b@techacademy.invalid")

    respuesta = cliente_admin.get("/alumnos")
    assert respuesta.status_code == 200, respuesta.text
    assert len(respuesta.json()) >= 2
