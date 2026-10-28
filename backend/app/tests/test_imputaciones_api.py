"""Imputaciones de una cobranza: distribución, saldo e historial del alumno (HU 23).

La carrera de dos imputaciones simultáneas se prueba como en D34: la fila de la cobranza se
bloquea con `FOR UPDATE`, y acá se verifica lo observable —que el saldo sale de la base y que la
segunda operación no puede sobreimputar— sin montar dos transacciones que hacen la prueba lenta y
flaky.
"""

from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.catalogo import Comision, ComisionHorario, Curso, Sede
from app.models.cobranza import Cobranza, Imputacion
from app.models.enums import EstadoCobranza
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.schemas.cobranzas import ImputacionesCreate
from app.services import cobranzas as servicio
from app.tests.factories import (
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_contrato,
    crear_curso,
    crear_empresa,
    crear_inscripcion,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_alumno,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)


@pytest.fixture
def admin_headers(db_session: Session) -> dict[str, str]:
    admin: Usuario = crear_usuario_admin(db_session)
    return encabezado_de_autorizacion(token_de_prueba(admin))


@pytest.fixture
def tres_alumnos(db_session: Session):
    """Tres alumnos con una inscripción activa cada uno, en la misma comisión."""
    comision = crear_comision(db_session)
    inscriptos = []
    for indice in range(3):
        alumno = crear_alumno(
            db_session,
            nombre=f"Alumno Repartido {indice}",
            documento=f"4000000{indice}",
            email=f"alumno{indice}@techacademy.invalid",
        )
        inscriptos.append((alumno, crear_inscripcion(db_session, alumno=alumno, comision=comision)))
    return inscriptos


def pago(**cambios):
    datos = {
        "fecha": (date.today() - timedelta(days=1)).isoformat(),
        "importe": "120000.00",
        "medio": "EFECTIVO",
        "titular": "Familiar de los tres",
        "estado": EstadoCobranza.ACREDITADO.value,
    }
    datos.update(cambios)
    return datos


def test_una_cobranza_se_reparte_entre_varios_alumnos(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    """Ejemplo de la historia: $120.000 en $50.000, $40.000 y $30.000, en una sola cobranza."""
    montos = ["50000.00", "40000.00", "30000.00"]
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(
            imputaciones=[
                {"inscripcion_id": inscripcion.id, "monto": monto}
                for (_, inscripcion), monto in zip(tres_alumnos, montos, strict=True)
            ]
        ),
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo["imputaciones"]) == 3
    assert [float(item["monto"]) for item in cuerpo["imputaciones"]] == [50000.0, 40000.0, 30000.0]
    assert float(cuerpo["monto_imputado"]) == 120000.0
    assert float(cuerpo["saldo_sin_imputar"]) == 0.0

    db_session.expire_all()
    assert len(db_session.scalars(select(Cobranza)).all()) == 1
    assert len(db_session.scalars(select(Imputacion)).all()) == 3


def test_la_distribucion_puede_ser_parcial_y_dejar_saldo(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    alumno, inscripcion = tres_alumnos[0]
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(imputaciones=[{"inscripcion_id": inscripcion.id, "monto": "70000.00"}]),
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert float(cuerpo["monto_imputado"]) == 70000.0
    assert float(cuerpo["saldo_sin_imputar"]) == 50000.0
    assert cuerpo["imputaciones"][0]["nombre"] == alumno.nombre


def test_la_suma_de_la_distribucion_no_puede_superar_el_importe(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(
            imputaciones=[
                {"inscripcion_id": tres_alumnos[0][1].id, "monto": "100000.00"},
                {"inscripcion_id": tres_alumnos[1][1].id, "monto": "30000.00"},
            ]
        ),
    )

    assert respuesta.status_code == 422, respuesta.text
    assert not db_session.scalars(select(Cobranza)).all()


@pytest.mark.parametrize("monto", ["0", "-1500.00"])
def test_un_importe_imputado_no_positivo_es_rechazado(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos, monto: str
) -> None:
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(imputaciones=[{"inscripcion_id": tres_alumnos[0][1].id, "monto": monto}]),
    )

    assert respuesta.status_code == 422, respuesta.text
    assert not db_session.scalars(select(Cobranza)).all()


def test_un_pago_sin_imputar_se_reparte_despues(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    creada = api_client.post("/cobranzas", headers=admin_headers, json=pago())
    assert creada.status_code == 201, creada.text
    assert creada.json()["imputaciones"] == []

    primera = api_client.post(
        f"/cobranzas/{creada.json()['id']}/imputaciones",
        headers=admin_headers,
        json={"imputaciones": [{"inscripcion_id": tres_alumnos[0][1].id, "monto": "50000.00"}]},
    )
    assert primera.status_code == 200, primera.text
    assert float(primera.json()["saldo_sin_imputar"]) == 70000.0

    segunda = api_client.post(
        f"/cobranzas/{creada.json()['id']}/imputaciones",
        headers=admin_headers,
        json={"imputaciones": [{"inscripcion_id": tres_alumnos[1][1].id, "monto": "20000.00"}]},
    )
    assert segunda.status_code == 200, segunda.text
    cuerpo = segunda.json()
    # Las imputaciones anteriores se conservan: son dos filas, no un reemplazo.
    assert [float(item["monto"]) for item in cuerpo["imputaciones"]] == [50000.0, 20000.0]
    assert float(cuerpo["saldo_sin_imputar"]) == 50000.0


def test_una_imputacion_posterior_no_puede_superar_el_saldo(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    cobranza = crear_cobranza(db_session, importe="120000.00")
    db_session.add(
        Imputacion(
            cobranza_id=cobranza.id,
            inscripcion_id=tres_alumnos[0][1].id,
            monto=Decimal("100000.00"),
        )
    )
    db_session.flush()

    respuesta = api_client.post(
        f"/cobranzas/{cobranza.id}/imputaciones",
        headers=admin_headers,
        json={"imputaciones": [{"inscripcion_id": tres_alumnos[1][1].id, "monto": "30000.00"}]},
    )

    assert respuesta.status_code == 422, respuesta.text
    db_session.expire_all()
    assert len(db_session.scalars(select(Imputacion)).all()) == 1


def test_imputar_una_cobranza_inexistente_es_404(
    api_client: TestClient, admin_headers, tres_alumnos
) -> None:
    respuesta = api_client.post(
        "/cobranzas/999/imputaciones",
        headers=admin_headers,
        json={"imputaciones": [{"inscripcion_id": tres_alumnos[0][1].id, "monto": "1000.00"}]},
    )

    assert respuesta.status_code == 404, respuesta.text


def test_la_imputacion_a_empresa_exige_contrato_activo(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    empresa = crear_empresa(db_session)

    sin_contrato = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(imputaciones=[{"empresa_id": empresa.id, "monto": "120000.00"}]),
    )
    assert sin_contrato.status_code == 422, sin_contrato.text
    assert "contrato" in sin_contrato.json()["detail"].lower()

    crear_contrato(db_session, empresa=empresa)
    con_contrato = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(imputaciones=[{"empresa_id": empresa.id, "monto": "120000.00"}]),
    )
    assert con_contrato.status_code == 201, con_contrato.text
    imputacion = con_contrato.json()["imputaciones"][0]
    assert imputacion["destino"] == "EMPRESA"
    assert imputacion["nombre"] == "Tech Solutions S.A."
    assert imputacion["alumno_id"] is None


def test_el_alumno_ve_solo_su_parte_del_pago_repartido(
    api_client: TestClient, db_session: Session, admin_headers, tres_alumnos
) -> None:
    alumno, inscripcion = tres_alumnos[0]
    otro_alumno, otra_inscripcion = tres_alumnos[1]
    api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(
            imputaciones=[
                {"inscripcion_id": inscripcion.id, "monto": "50000.00"},
                {"inscripcion_id": otra_inscripcion.id, "monto": "40000.00"},
            ]
        ),
    )
    api_client.post("/cobranzas", headers=admin_headers, json=pago(titular="Nadie"))

    cuenta = crear_usuario_alumno(db_session, alumno=alumno, email="reparto0@techacademy.invalid")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta)))
    respuesta = api_client.get("/alumno/pagos")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert float(cuerpo[0]["importe"]) == 50000.0
    # El pagador es un tercero y la fila lo dice.
    assert cuerpo[0]["pagado_por_tercero"] is True

    api_client.headers.update(
        encabezado_de_autorizacion(
            token_de_prueba(
                crear_usuario_alumno(
                    db_session, alumno=otro_alumno, email="reparto1@techacademy.invalid"
                )
            )
        )
    )
    del_otro = api_client.get("/alumno/pagos").json()
    assert [float(fila["importe"]) for fila in del_otro] == [40000.0]


def test_el_historial_del_alumno_exige_su_rol(
    api_client: TestClient, db_session: Session, admin_headers
) -> None:
    admin = api_client.get("/alumno/pagos", headers=admin_headers)
    assert admin.status_code == 403

    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))
    assert api_client.get("/alumno/pagos").status_code == 403

    sin_token = api_client.get("/alumno/pagos", headers={"Authorization": ""})
    assert sin_token.status_code == 401


def test_la_imputacion_a_un_alumno_sigue_siendo_automatica(
    api_client: TestClient, admin_headers, tres_alumnos
) -> None:
    """La HU 21 no cambia: con un alumno, el importe completo va a su inscripción."""
    alumno, inscripcion = tres_alumnos[0]
    respuesta = api_client.post(
        "/cobranzas",
        headers=admin_headers,
        json=pago(alumno_id=alumno.id, inscripcion_id=inscripcion.id),
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo["imputaciones"]) == 1
    assert float(cuerpo["imputaciones"][0]["monto"]) == 120000.0
    assert float(cuerpo["saldo_sin_imputar"]) == 0.0


def test_dos_imputaciones_simultaneas_no_sobreimputan(engine) -> None:
    """Dos transacciones reales, no dos pedidos secuenciales.

    Cada hilo abre su propia conexión. La cobranza bloqueada por el primero hace esperar al
    segundo; cuando se desbloquea, ya ve la imputación confirmada y se queda sin saldo. Los datos
    se confirman porque otras conexiones no ven una transacción abierta y se limpian al final: la
    suite asume que ningún test deja filas y el `downgrade` de `test_migration` no las tolera.
    """
    cobranza_id = None
    inscripciones: list[int] = []
    alumnos: list[int] = []
    comision_id = curso_id = sede_id = None
    preparacion = Session(bind=engine, expire_on_commit=False)
    try:
        # Nombres únicos: si una corrida anterior no pudo limpiar, la preparación no colisiona.
        sufijo = uuid.uuid4().hex[:8]
        curso = crear_curso(preparacion, nombre=f"Curso simultaneo {sufijo}")
        sede = crear_sede(preparacion, nombre=f"Sede simultanea {sufijo}")
        comision = crear_comision(preparacion, curso=curso, sede=sede)
        curso_id, sede_id, comision_id = curso.id, sede.id, comision.id
        for indice in range(2):
            alumno = crear_alumno(
                preparacion,
                nombre=f"Carrera Simultanea {indice}",
                documento=f"4511111{indice}",
                email=f"carrera.simultanea{indice}.{sufijo}@techacademy.invalid",
            )
            alumnos.append(alumno.id)
            inscripciones.append(
                crear_inscripcion(preparacion, alumno=alumno, comision=comision).id
            )
        cobranza = crear_cobranza(preparacion, importe="1000.00")
        preparacion.commit()
        cobranza_id = cobranza.id
    finally:
        preparacion.close()

    barrera = threading.Barrier(2)

    def imputar(inscripcion_id: int) -> bool:
        sesion = Session(bind=engine, expire_on_commit=False)
        try:
            barrera.wait(timeout=10)
            # Sin usuario: la auditoría de esta prueba no necesita autor y así no queda una
            # cuenta que el trigger de `audit_log` impide borrar al limpiar.
            servicio.agregar_imputaciones(
                sesion,
                cobranza_id,
                ImputacionesCreate(
                    imputaciones=[{"inscripcion_id": inscripcion_id, "monto": Decimal("1000.00")}]
                ),
                None,
            )
            return True
        except servicio.ImputacionesExcedenSaldo:
            return False
        finally:
            sesion.close()

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = [
                futuro.result(timeout=20)
                for futuro in [pool.submit(imputar, inscripcion) for inscripcion in inscripciones]
            ]

        verificacion = Session(bind=engine)
        try:
            total = verificacion.scalar(
                select(func.coalesce(func.sum(Imputacion.monto), 0)).where(
                    Imputacion.cobranza_id == cobranza_id
                )
            )
            cantidad = len(
                verificacion.scalars(
                    select(Imputacion).where(Imputacion.cobranza_id == cobranza_id)
                ).all()
            )
        finally:
            verificacion.close()

        assert resultados.count(True) == 1
        assert cantidad == 1
        assert total == Decimal("1000.00")
    finally:
        if cobranza_id is not None:
            limpieza = Session(bind=engine)
            try:
                limpieza.execute(delete(Imputacion).where(Imputacion.cobranza_id == cobranza_id))
                limpieza.execute(delete(Cobranza).where(Cobranza.id == cobranza_id))
                limpieza.execute(delete(Inscripcion).where(Inscripcion.id.in_(inscripciones)))
                limpieza.execute(delete(Alumno).where(Alumno.id.in_(alumnos)))
                limpieza.execute(
                    delete(ComisionHorario).where(ComisionHorario.comision_id == comision_id)
                )
                limpieza.execute(delete(Comision).where(Comision.id == comision_id))
                limpieza.execute(delete(Curso).where(Curso.id == curso_id))
                limpieza.execute(delete(Sede).where(Sede.id == sede_id))
                limpieza.commit()
            finally:
                limpieza.close()
