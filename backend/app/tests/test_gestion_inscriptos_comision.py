"""Gestión de inscriptos de una comisión y baja lógica (HU 60)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.clases import AuditLog
from app.models.enums import CategoriaInscripcion, EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.tests.factories import (
    crear_alumno,
    crear_cobranza,
    crear_comision,
    crear_curso,
    crear_imputacion,
    crear_inscripcion,
    crear_usuario_admin,
    crear_usuario_alumno,
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


_ALUMNOS = 0


def _alumno(session: Session, nombre: str = "Alumno de Prueba") -> Alumno:
    """Alumno del padrón con documento y email únicos: el padrón los exige únicos."""
    global _ALUMNOS
    _ALUMNOS += 1
    return crear_alumno(
        session,
        nombre=nombre,
        documento=f"30{_ALUMNOS:06d}",
        email=f"alumno{_ALUMNOS}@techacademy.invalid",
    )


def _comision(db_session: Session, **cambios):
    datos = {
        "fecha_inicio": date.today() - timedelta(days=10),
        "fecha_fin": date.today() + timedelta(days=60),
    }
    datos.update(cambios)
    return crear_comision(db_session, **datos)


def _listado(cliente: TestClient, comision_id: int) -> dict:
    respuesta = cliente.get("/inscripciones", params={"comision_id": comision_id})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_listado_trae_activas_y_bajas_con_cupo_y_vacantes(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=10)
    activa = _alumno(db_session, "Ana Activa")
    inactiva = _alumno(db_session, "Beto Baja")
    crear_inscripcion(db_session, alumno=activa, comision=comision)
    crear_inscripcion(
        db_session,
        alumno=inactiva,
        comision=comision,
        estado=EstadoInscripcion.BAJA.value,
    )

    cuerpo = _listado(cliente_admin, comision.id)

    assert cuerpo["comision"]["id"] == comision.id
    assert cuerpo["comision"]["codigo"] == comision.codigo
    assert cuerpo["comision"]["nombre_curso"] == comision.curso.nombre
    assert cuerpo["comision"]["cupo_maximo"] == 10
    assert cuerpo["comision"]["inscriptos_activos"] == 1
    assert cuerpo["comision"]["vacantes"] == 9
    assert [fila["estado"] for fila in cuerpo["inscripciones"]] == ["ACTIVA", "BAJA"]
    fila_activa = cuerpo["inscripciones"][0]
    assert fila_activa["alumno"]["nombre"] == "Ana Activa"
    assert fila_activa["alumno"]["documento"] == "30000001"
    assert fila_activa["categoria"] == CategoriaInscripcion.PARTICULAR.value
    assert fila_activa["acceso"]["estado"] in {"HABILITADO", "BLOQUEADO"}
    assert cuerpo["inscripciones"][1]["acceso"] is None


def test_listado_de_comision_inexistente_es_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.get("/inscripciones", params={"comision_id": 999999})

    assert respuesta.status_code == 404


def test_comision_sin_inscriptos_informa_el_cupo_completo(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=7)

    cuerpo = _listado(cliente_admin, comision.id)

    assert cuerpo["comision"]["inscriptos_activos"] == 0
    assert cuerpo["comision"]["vacantes"] == 7
    assert cuerpo["inscripciones"] == []


def test_alta_desde_la_comision_actualiza_inscriptos_y_vacantes(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=5)
    alumno = _alumno(db_session)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )
    assert respuesta.status_code == 201, respuesta.text

    cuerpo = _listado(cliente_admin, comision.id)
    assert cuerpo["comision"]["inscriptos_activos"] == 1
    assert cuerpo["comision"]["vacantes"] == 4


def test_cupo_lleno_rechaza_el_alta_y_no_cambia_el_listado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=1)
    crear_inscripcion(db_session, alumno=_alumno(db_session), comision=comision)
    otro = _alumno(db_session, "Otro Alumno")

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": otro.id, "comision_id": comision.id},
    )

    assert respuesta.status_code == 409
    cuerpo = _listado(cliente_admin, comision.id)
    assert cuerpo["comision"]["inscriptos_activos"] == 1
    assert cuerpo["comision"]["vacantes"] == 0


def test_inscripcion_duplicada_activa_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=5)
    alumno = _alumno(db_session)
    crear_inscripcion(db_session, alumno=alumno, comision=comision)

    respuesta = cliente_admin.post(
        "/inscripciones",
        json={"alumno_id": alumno.id, "comision_id": comision.id},
    )

    assert respuesta.status_code == 409


def test_baja_cambia_el_estado_y_libera_la_vacante(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    alumno = _alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": comision.id},
    )

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == EstadoInscripcion.BAJA.value

    db_session.expire_all()
    fila = db_session.get(Inscripcion, inscripcion.id)
    assert fila is not None
    assert fila.estado == EstadoInscripcion.BAJA.value
    cuerpo = _listado(cliente_admin, comision.id)
    assert cuerpo["comision"]["inscriptos_activos"] == 0
    assert cuerpo["comision"]["vacantes"] == 3
    assert cuerpo["inscripciones"][0]["estado"] == "BAJA"


def test_baja_conserva_cobranzas_imputaciones_y_auditoria(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    alumno = _alumno(db_session)
    inscripcion = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    cobranza = crear_cobranza(db_session)
    imputacion = crear_imputacion(db_session, cobranza=cobranza, inscripcion=inscripcion)
    imputacion_id = imputacion.id
    cobranza_id = cobranza.id

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": comision.id},
    )
    assert respuesta.status_code == 200, respuesta.text

    from app.models.cobranza import Cobranza, Imputacion

    db_session.expire_all()
    conservada = db_session.get(Imputacion, imputacion_id)
    assert conservada is not None
    assert conservada.inscripcion_id == inscripcion.id
    assert db_session.get(Cobranza, cobranza_id) is not None

    auditoria = db_session.scalars(
        select(AuditLog).where(
            AuditLog.entidad == "inscripcion",
            AuditLog.entidad_id == inscripcion.id,
            AuditLog.accion == "inscripcion.baja",
        )
    ).all()
    assert len(auditoria) == 1


def test_baja_duplicada_es_409_y_no_repite_la_auditoria(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    inscripcion = crear_inscripcion(
        db_session, alumno=_alumno(db_session), comision=comision
    )

    primera = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": comision.id},
    )
    segunda = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": comision.id},
    )

    assert primera.status_code == 200
    assert segunda.status_code == 409
    assert (
        db_session.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.accion == "inscripcion.baja")
        )
        == 1
    )


def test_baja_de_una_inscripcion_de_otra_comision_es_404(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    otra = crear_comision(
        db_session, curso=crear_curso(db_session, "Otro Curso"), con_sede=False
    )
    inscripcion = crear_inscripcion(
        db_session, alumno=_alumno(db_session), comision=comision
    )

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": otra.id},
    )

    assert respuesta.status_code == 404
    db_session.expire_all()
    assert db_session.get(Inscripcion, inscripcion.id).estado == EstadoInscripcion.ACTIVA.value


def test_baja_de_una_inscripcion_completada_es_409(
    cliente_admin: TestClient, db_session: Session
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    inscripcion = crear_inscripcion(
        db_session,
        alumno=_alumno(db_session),
        comision=comision,
        estado=EstadoInscripcion.COMPLETADA.value,
    )

    respuesta = cliente_admin.post(
        f"/inscripciones/{inscripcion.id}/baja",
        json={"comision_id": comision.id},
    )

    assert respuesta.status_code == 409


def test_cambiar_categoria_solo_afecta_esa_inscripcion(
    cliente_admin: TestClient, db_session: Session
) -> None:
    alumno = _alumno(db_session)
    comision = _comision(db_session, cupo_maximo=3)
    otra_comision = crear_comision(
        db_session, curso=crear_curso(db_session, "Otro Curso"), con_sede=False
    )
    una = crear_inscripcion(db_session, alumno=alumno, comision=comision)
    otra = crear_inscripcion(db_session, alumno=alumno, comision=otra_comision)

    respuesta = cliente_admin.patch(
        f"/inscripciones/{una.id}",
        json={"categoria": CategoriaInscripcion.BECADO_TOTAL.value},
    )
    assert respuesta.status_code == 200, respuesta.text

    db_session.expire_all()
    assert db_session.get(Inscripcion, una.id).categoria == "BECADO_TOTAL"
    assert db_session.get(Inscripcion, otra.id).categoria == "PARTICULAR"
    listado = _listado(cliente_admin, comision.id)
    assert listado["inscripciones"][0]["categoria"] == "BECADO_TOTAL"


@pytest.mark.parametrize("ruta", ["get", "baja"])
def test_las_rutas_de_gestion_exigen_admin(
    api_client: TestClient, db_session: Session, ruta: str
) -> None:
    comision = _comision(db_session, cupo_maximo=3)
    inscripcion = crear_inscripcion(
        db_session, alumno=_alumno(db_session), comision=comision
    )
    docente = crear_usuario_docente(db_session)
    alumno = crear_usuario_alumno(
        db_session, alumno=_alumno(db_session, "Alumno con cuenta")
    )

    for usuario in (docente, alumno):
        headers = encabezado_de_autorizacion(token_de_prueba(usuario))
        if ruta == "get":
            respuesta = api_client.get(
                "/inscripciones", params={"comision_id": comision.id}, headers=headers
            )
        else:
            respuesta = api_client.post(
                f"/inscripciones/{inscripcion.id}/baja",
                json={"comision_id": comision.id},
                headers=headers,
            )
        assert respuesta.status_code == 403

    if ruta == "get":
        assert api_client.get(
            "/inscripciones", params={"comision_id": comision.id}
        ).status_code == 401
    else:
        assert api_client.post(
            f"/inscripciones/{inscripcion.id}/baja", json={"comision_id": comision.id}
        ).status_code == 401
