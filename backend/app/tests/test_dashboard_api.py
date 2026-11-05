"""Tablero de Administración y agenda compartida (H/U 55, 56 y 57).

**Lo que se prueba es el contrato y las reglas que lo sostienen:** el agregado exige `ADMIN`, cuenta
solo inscripciones activas, suma solo cobranzas acreditadas, devuelve seis meses con ceros reales,
ordena la agenda de todas las comisiones y no muestra comisiones finalizadas. El docente recibe sus
encuentros en `/docentes/mis-comisiones`, que es la misma regla que usa el alumno.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogo import ZONA_HORARIA_DOMINIO
from app.models.enums import EstadoComprobanteAlumno, EstadoInscripcion
from app.models.padron import Alumno, Docente, Usuario
from app.services import dashboard
from app.tests.factories import (
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_comprobante,
    crear_curso,
    crear_docente,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

HOY = datetime.now(ZONA_HORARIA_DOMINIO).date()
DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"]


def _dia(fecha: date) -> str:
    return DIAS[fecha.weekday()]


def _principio_de_mes(fecha: date) -> date:
    return fecha.replace(day=1)


@pytest.fixture
def cuenta_admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session, email="dashboard.admin@techacademy.invalid")


@pytest.fixture
def cliente_admin(api_client: TestClient, cuenta_admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta_admin)))
    return api_client


def test_la_ruta_del_tablero_esta_registrada(client) -> None:
    esquema = client.get("/openapi.json").json()

    assert "/admin/dashboard" in esquema["paths"]
    assert set(esquema["paths"]["/admin/dashboard"]) == {"get"}


def test_el_tablero_devuelve_todas_las_secciones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = crear_comision(
        db_session,
        fecha_inicio=HOY,
        fecha_fin=HOY + timedelta(days=30),
        horarios_semana=[(_dia(HOY), "09:00", "10:00")],
    )
    alumna = crear_alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumna, comision=comision)
    crear_cobranza(db_session, fecha=_principio_de_mes(HOY), importe="30000.00")
    crear_comprobante(db_session, alumno=alumna, inscripcion=inscripcion)

    respuesta = cliente_admin.get("/admin/dashboard")

    assert respuesta.status_code == 200, respuesta.text
    datos = respuesta.json()
    assert set(datos) == {
        "indicadores",
        "cobros_por_mes",
        "ocupacion_por_comision",
        "comprobantes_recientes",
        "agenda",
    }
    assert datos["indicadores"]["inscripciones_activas"] == 1
    assert float(datos["indicadores"]["cobrado_mes_actual"]) == 30000
    assert len(datos["cobros_por_mes"]) == 6
    assert datos["agenda"][0]["codigo"] == comision.codigo


def test_el_tablero_solo_lo_ve_administracion(
    api_client: TestClient, db_session: Session
) -> None:
    docente = crear_docente(db_session, email="dash.docente@techacademy.invalid")
    alumna = crear_alumno(db_session, email="dash.alumna@techacademy.invalid")
    cuenta_docente = crear_usuario_docente(db_session, docente=docente)
    cuenta_alumna = crear_usuario_alumno(db_session, alumno=alumna)

    assert api_client.get("/admin/dashboard").status_code == 401

    api_client.headers.update(
        encabezado_de_autorizacion(token_de_prueba(cuenta_docente))
    )
    assert api_client.get("/admin/dashboard").status_code == 403

    api_client.headers.update(
        encabezado_de_autorizacion(token_de_prueba(cuenta_alumna))
    )
    assert api_client.get("/admin/dashboard").status_code == 403


def test_indicadores_cuentan_alumnos_distintos_y_solo_activas(db_session: Session) -> None:
    curso = crear_curso(db_session)
    comision = crear_comision(db_session, curso=curso, cupo_maximo=10)
    otra = crear_comision(db_session, curso=curso, cupo_maximo=20)
    alumna = crear_alumno(db_session)
    otro = crear_alumno(db_session, documento="39111222", email="otro@techacademy.invalid")
    crear_inscripcion(db_session, alumno=alumna, comision=comision)
    crear_inscripcion(db_session, alumno=alumna, comision=otra)
    crear_inscripcion(
        db_session,
        alumno=otro,
        comision=comision,
        estado=EstadoInscripcion.BAJA.value,
    )

    datos = dashboard.obtener_dashboard(db_session, hoy=HOY)

    assert datos.indicadores.inscripciones_activas == 2
    assert datos.indicadores.alumnos_inscriptos == 1
    assert datos.indicadores.cupo_promedio_ocupado is not None


def test_la_serie_suma_solo_acreditado_y_completa_los_meses(db_session: Session) -> None:
    este_mes = _principio_de_mes(HOY)
    mes_anterior = (este_mes - timedelta(days=1)).replace(day=1)

    crear_cobranza(db_session, fecha=este_mes, importe="10000.00")
    crear_cobranza(db_session, fecha=mes_anterior, importe="25000.00")
    crear_cobranza(
        db_session,
        fecha=mes_anterior,
        importe="99999.00",
        estado="OBSERVADO",
        causa="comprobante ilegible",
    )

    datos = dashboard.obtener_dashboard(db_session, hoy=HOY)
    por_mes = {punto.mes: punto.importe for punto in datos.cobros_por_mes}

    assert len(datos.cobros_por_mes) == 6
    assert str(por_mes[este_mes.strftime("%Y-%m")]) == "10000.00"
    assert str(por_mes[mes_anterior.strftime("%Y-%m")]) == "25000.00"
    assert datos.indicadores.cobrado_mes_actual == 10000
    assert datos.indicadores.cobranzas_observadas == 1


def test_la_agenda_junta_comisiones_ordena_y_excluye_finalizadas(
    db_session: Session,
) -> None:
    curso = crear_curso(db_session)
    hoy = crear_comision(
        db_session,
        curso=curso,
        fecha_inicio=HOY,
        fecha_fin=HOY + timedelta(days=20),
        horarios_semana=[(_dia(HOY), "09:00", "10:00")],
    )
    manana = crear_comision(
        db_session,
        curso=curso,
        fecha_inicio=HOY,
        fecha_fin=HOY + timedelta(days=20),
        horarios_semana=[(_dia(HOY + timedelta(days=1)), "11:00", "12:00")],
    )
    finalizada = crear_comision(
        db_session,
        curso=curso,
        fecha_inicio=HOY - timedelta(days=20),
        fecha_fin=HOY - timedelta(days=1),
        horarios_semana=[(_dia(HOY), "15:00", "16:00")],
    )

    datos = dashboard.obtener_dashboard(db_session, hoy=HOY)
    fechas = [encuentro.fecha for encuentro in datos.agenda]
    codigos = {encuentro.codigo for encuentro in datos.agenda}

    assert fechas[:2] == [HOY, HOY + timedelta(days=1)]
    assert hoy.codigo in codigos
    assert manana.codigo in codigos
    assert finalizada.codigo not in codigos
    assert len(datos.agenda) <= 8


def test_comprobantes_recientes_ordenan_por_recepcion(db_session: Session) -> None:
    alumna = crear_alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumna)
    for indice in range(6):
        crear_comprobante(
            db_session,
            alumno=alumna,
            inscripcion=inscripcion,
            enviado_at=datetime.now(UTC) - timedelta(hours=indice),
        )

    datos = dashboard.obtener_dashboard(db_session, hoy=HOY)

    assert len(datos.comprobantes_recientes) == 5
    assert datos.indicadores.comprobantes_pendientes == 6
    assert datos.indicadores.cobros_pendientes == 6
    envios = [fila.enviado_at for fila in datos.comprobantes_recientes]
    assert envios == sorted(envios, reverse=True)


def test_el_docente_recibe_los_encuentros_de_sus_comisiones(
    api_client: TestClient, db_session: Session
) -> None:
    docente: Docente = crear_docente(db_session, email="docente.agenda@techacademy.invalid")
    crear_comision(
        db_session,
        docente=docente,
        fecha_inicio=HOY,
        fecha_fin=HOY + timedelta(days=20),
        horarios_semana=[(_dia(HOY), "18:00", "20:00")],
    )
    cuenta = crear_usuario_docente(db_session, docente=docente)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))

    respuesta = api_client.get("/docentes/mis-comisiones")

    assert respuesta.status_code == 200, respuesta.text
    (comision,) = respuesta.json()
    assert comision["proximos_encuentros"][0]["fecha"] == HOY.isoformat()
    assert comision["proximos_encuentros"][0]["horario"] == "18:00-20:00"


def test_un_comprobante_pendiente_aparece_en_recientes(db_session: Session) -> None:
    alumna: Alumno = crear_alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumna)
    crear_comprobante(
        db_session,
        alumno=alumna,
        inscripcion=inscripcion,
        estado=EstadoComprobanteAlumno.PENDIENTE_REVISION.value,
    )

    datos = dashboard.obtener_dashboard(db_session, hoy=HOY)

    assert datos.comprobantes_recientes[0].alumno == alumna.nombre
    assert datos.comprobantes_recientes[0].inscripcion.codigo == inscripcion.comision.codigo
