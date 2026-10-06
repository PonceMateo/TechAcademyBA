"""Altas de cursos, comisiones, docentes y consulta de sedes contra PostgreSQL real.

Historias #1, #2, #5, #8 y #9. Cada test va contra la base de verdad, no contra un doble: el
código del curso lo produce una columna generada, el número de la comisión lo produce un índice
único y la cuenta del docente la sostiene un CHECK, así que un doble no probaría nada de lo que
importa.

Lo que estos tests afirma por debajo de la respuesta:
- el alta de un curso **no admite un campo de código** (`extra="forbid"`), y uno que lo mande
  recibe 422;
- el alta de un docente **no admite un campo de CUIL** (D33), y uno que lo mande recibe 422;
- la comisión sin docente, con cupo inválido, con arancel inválido o presencial sin sede se
  rechazan;
- el rechazo del DNI repetido dice **DNI** y el del email repetido dice **email**;
- la cuenta creada por el alta entra al sistema con la contraseña de demostración.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import Modalidad
from app.models.padron import Usuario
from app.services import catalogo, padron
from app.services.auth import autenticar
from app.tests.factories import (
    crear_alumno,
    crear_curso,
    crear_docente,
    crear_sede,
    crear_usuario_admin,
    crear_usuario_docente,
    encabezado_de_autorizacion,
    token_de_prueba,
)

#: Contraseña de las cuentas de demostración. La misma que la del seed, y la que el alta de
#: docente deja: es la forma de acceso durante esta fase.
CONTRASENA = "Demo2026!"


@pytest.fixture
def admin(db_session: Session) -> Usuario:
    return crear_usuario_admin(db_session)


@pytest.fixture
def cliente_admin(api_client: TestClient, admin: Usuario) -> TestClient:
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))
    return api_client


# --------------------------------------------------------------------- cursos


def test_alta_de_curso_devuelve_el_codigo_generado(cliente_admin: TestClient) -> None:
    """Historia #1: la respuesta trae el código que generó la base (D32)."""
    respuesta = cliente_admin.post("/cursos", json={"nombre": "Python Inicial"})

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Python Inicial"
    assert cuerpo["codigo"].startswith("CUR"), cuerpo
    assert len(cuerpo["codigo"]) >= 6, f"el código tiene al menos tres dígitos: {cuerpo['codigo']}"


def test_el_alta_de_curso_no_admite_un_codigo(cliente_admin: TestClient) -> None:
    """D32: el código no es un dato de entrada. Mandarlo es un 422, no un campo ignorado."""
    respuesta = cliente_admin.post(
        "/cursos", json={"nombre": "Python Inicial", "codigo": "CUR-101"}
    )

    assert respuesta.status_code == 422, respuesta.text


def test_nombre_de_curso_duplicado_por_normalizacion_nombra_el_curso_existente(
    api_client: TestClient, admin: Usuario, db_session: Session
) -> None:
    """D6: `"Curso Python"` y `"curso   python"` son el mismo curso, y el rechazo nombra
    cuál de los dos chocó.

    Lo que se compara es la forma normalizada, que colapsa mayúsculas, acentos y espacios. Notar
    que `"curso de python"` **no** es lo mismo que `"Curso Python"`: `de` es una palabra
    distinta, así que son dos cursos distintos y la base los tiene que dejar entrar.
    """
    existente = crear_curso(db_session, nombre="Curso Python")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))

    respuesta = api_client.post("/cursos", json={"nombre": "curso   python"})

    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"]
    assert existente.codigo in detalle, detalle
    assert "Curso Python" in detalle, detalle


def test_un_curso_con_una_palabra_mas_no_esta_duplicado(cliente_admin: TestClient) -> None:
    """La normalización no puede comerse palabras: `Curso Python` y `Curso de Python` son
    dos cursos distintos y los dos tienen que poder existir."""
    assert cliente_admin.post("/cursos", json={"nombre": "Curso Python"}).status_code == 201

    respuesta = cliente_admin.post("/cursos", json={"nombre": "Curso de Python"})

    assert respuesta.status_code == 201, respuesta.text


@pytest.mark.parametrize("nombre", ["", "   "])
def test_alta_de_curso_sin_nombre_es_rechazada(cliente_admin: TestClient, nombre: str) -> None:
    respuesta = cliente_admin.post("/cursos", json={"nombre": nombre})

    assert respuesta.status_code == 422, respuesta.text


def test_listado_de_cursos(cliente_admin: TestClient, db_session: Session) -> None:
    curso = crear_curso(db_session, nombre="Excel Intermedio")

    respuesta = cliente_admin.get("/cursos")

    assert respuesta.status_code == 200, respuesta.text
    assert [c["codigo"] for c in respuesta.json()] == [curso.codigo]


# ------------------------------------------------------------------ comisiones


def test_alta_de_comision_devuelve_el_codigo_derivado(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """Historia #2 y D34: el código es `{codigo del curso}-{número}`."""
    curso = crear_curso(db_session, nombre="Python Inicial")
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "docente_id": docente.id,
            "dias_horarios": "Lunes y miércoles 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": Modalidad.PRESENCIAL.value,
            "sede_id": sede.id,
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == f"{curso.codigo}-1", cuerpo
    assert cuerpo["docente_nombre"] == f"{docente.nombre} {docente.apellido}", cuerpo
    assert cuerpo["sede_nombre"] == sede.nombre, cuerpo
    assert cuerpo["vacantes"] == 20, "recién creada no tiene inscriptos, así que están todas"


def test_las_comisiones_de_un_curso_se_numeran_consecutivas(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D34: el número es incremental por curso."""
    curso = crear_curso(db_session, nombre="Python Inicial")
    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    cuerpo = {
        "curso_id": curso.id,
        "docente_id": docente.id,
        "dias_horarios": "Lunes 18:00 a 20:00",
        "arancel": "52000.00",
        "cupo_maximo": 20,
        "modalidad": Modalidad.PRESENCIAL.value,
        "sede_id": sede.id,
    }

    codigos = [cliente_admin.post("/comisiones", json=cuerpo).json()["codigo"] for _ in range(3)]

    assert codigos == [f"{curso.codigo}-1", f"{curso.codigo}-2", f"{curso.codigo}-3"]


def test_comision_sin_docente_es_rechazada(cliente_admin: TestClient, db_session: Session) -> None:
    """El criterio de #2: el docente es parte del alta completa."""
    curso = crear_curso(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": Modalidad.VIRTUAL.value,
        },
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "docente_id" in respuesta.text


@pytest.mark.parametrize("cupo", [0, -1])
def test_cupo_invalido_es_rechazado(
    cliente_admin: TestClient, db_session: Session, cupo: int
) -> None:
    """Historia #5: el cupo es un entero positivo."""
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "docente_id": docente.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": cupo,
            "modalidad": Modalidad.VIRTUAL.value,
        },
    )

    assert respuesta.status_code == 422, respuesta.text


@pytest.mark.parametrize("arancel", ["0", "-1"])
def test_arancel_invalido_es_rechazado(
    cliente_admin: TestClient, db_session: Session, arancel: str
) -> None:
    """Historia #2: el arancel tiene que ser mayor que cero."""
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "docente_id": docente.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": arancel,
            "cupo_maximo": 20,
            "modalidad": Modalidad.VIRTUAL.value,
        },
    )

    assert respuesta.status_code == 422, respuesta.text


@pytest.mark.parametrize("modalidad", [Modalidad.PRESENCIAL.value, Modalidad.HIBRIDO.value])
def test_modalidad_que_exige_sede_sin_sede_es_rechazada(
    cliente_admin: TestClient, db_session: Session, modalidad: str
) -> None:
    """Historia #8: Presencial e Híbrido exigen sede. Lo rechaza el CHECK de la base."""
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "docente_id": docente.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": modalidad,
        },
    )

    assert respuesta.status_code == 422, respuesta.text
    assert "sede" in respuesta.text.lower(), respuesta.text


def test_modalidad_virtual_no_exige_sede(cliente_admin: TestClient, db_session: Session) -> None:
    curso = crear_curso(db_session)
    docente = crear_docente(db_session)

    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": curso.id,
            "docente_id": docente.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": Modalidad.VIRTUAL.value,
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["sede_id"] is None


def test_alta_de_comision_con_curso_inexistente_es_404(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post(
        "/comisiones",
        json={
            "curso_id": 99999,
            "docente_id": 1,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": Modalidad.VIRTUAL.value,
        },
    )

    assert respuesta.status_code == 404, respuesta.text


def test_listado_de_comisiones_devuelve_las_vacantes_derivadas(
    cliente_admin: TestClient, db_session: Session
) -> None:
    """D10: las vacantes se derivan, no se guardan. Cupo 20 con 12 activas deja 8."""
    from app.tests.factories import crear_alumno, crear_comision, crear_inscripcion

    comision = crear_comision(db_session, cupo_maximo=20)
    for indice in range(12):
        crear_inscripcion(
            db_session,
            comision=comision,
            alumno=crear_alumno(
                db_session,
                nombre=f"Alumno {indice}",
                # El documento es único en el padrón de alumnos, así que cada uno necesita el
                # suyo: el de la fábrica ya lo usa la primera.
                documento=f"3811{indice:04d}",
                email=f"alumno{indice}@techacademy.invalid",
            ),
        )

    respuesta = cliente_admin.get("/comisiones")

    assert respuesta.status_code == 200, respuesta.text
    fila = respuesta.json()[0]
    assert fila["vacantes"] == 8, fila
    assert "vacantes" not in comision.__table__.columns, "D10: las vacantes no son columna"


# -------------------------------------------------------------------- docentes


def test_alta_de_docente_crea_el_docente_y_su_cuenta(
    api_client: TestClient, admin: Usuario, db_session: Session
) -> None:
    """Historia #9: el docente se crea con acceso por su mail, y las dos filas o ninguna."""
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))

    respuesta = api_client.post(
        "/docentes",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": "30111222",
            "email": "rita.molina@techacademy.invalid",
            "telefono": "+54 11 4000-0001",
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["cuil"] is None, "D33: el CUIL es opcional"
    assert cuerpo["cantidad_comisiones"] == 0

    # Y la cuenta existe con la contraseña de demostración: el criterio de #9 pide que el
    # docente pueda entrar a su panel.
    usuario = autenticar(db_session, "rita.molina@techacademy.invalid", CONTRASENA)
    assert usuario.rol == "DOCENTE"
    assert usuario.must_change_password is False, "D18: sin cambio pendiente"


def test_el_alta_de_docente_no_admite_un_cuil(cliente_admin: TestClient) -> None:
    """D33: la columna existe pero el contrato no la pide. Mandarla es un 422."""
    respuesta = cliente_admin.post(
        "/docentes",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": "30111222",
            "email": "rita.molina@techacademy.invalid",
            "cuil": "27345678907",
        },
    )

    assert respuesta.status_code == 422, respuesta.text


def test_dni_repetido_se_rechaza_diciendo_dni(
    api_client: TestClient, admin: Usuario, db_session: Session
) -> None:
    """Historia #9: el rechazo dice **qué** dato se repitió, para corregir el formulario."""
    crear_docente(db_session, dni="30111222")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))

    respuesta = api_client.post(
        "/docentes",
        json={
            "nombre": "Otro",
            "apellido": "Docente",
            "dni": "30.111.222",
            "email": "otro@techacademy.invalid",
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "DNI" in respuesta.json()["detail"]


def test_email_repetido_se_rechaza_diciendo_email(
    api_client: TestClient, admin: Usuario, db_session: Session
) -> None:
    crear_docente(db_session, email="rita.molina@techacademy.invalid")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))

    respuesta = api_client.post(
        "/docentes",
        json={
            "nombre": "Otro",
            "apellido": "Docente",
            "dni": "30111999",
            "email": "rita.molina@techacademy.invalid",
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"].lower()
    assert "email" in detalle, respuesta.json()


def test_email_ya_tomado_por_un_alumno_se_rechaza(
    api_client: TestClient, admin: Usuario, db_session: Session
) -> None:
    """M1: un índice único es por tabla, así que la unicidad cruzada entre padrones la sostiene
    el servicio, no la base."""
    crear_alumno(db_session, email="compartido@techacademy.invalid")
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(admin)))

    respuesta = api_client.post(
        "/docentes",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": "30111222",
            "email": "compartido@techacademy.invalid",
        },
    )

    assert respuesta.status_code == 409, respuesta.text
    assert "alumnos" in respuesta.json()["detail"]


def test_email_con_formato_invalido_es_rechazado(cliente_admin: TestClient) -> None:
    respuesta = cliente_admin.post(
        "/docentes",
        json={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": "30111222",
            "email": "esto-no-es-un-mail",
        },
    )

    assert respuesta.status_code == 422, respuesta.text


def test_varios_docentes_sin_cuil_conviven(cliente_admin: TestClient) -> None:
    """D33: el índice único del CUIL sobrevive a los nulos."""
    for indice in range(2):
        respuesta = cliente_admin.post(
            "/docentes",
            json={
                "nombre": "Docente",
                "apellido": f"Numero{indice}",
                "dni": f"3011122{indice}",
                "email": f"docente{indice}@techacademy.invalid",
            },
        )
        assert respuesta.status_code == 201, respuesta.text

    assert [d["cuil"] for d in cliente_admin.get("/docentes").json()] == [None, None]


def test_listado_de_docentes_cuenta_las_comisiones(
    cliente_admin: TestClient, db_session: Session
) -> None:
    from app.tests.factories import crear_comision

    docente = crear_docente(db_session)
    sede = crear_sede(db_session)
    for indice in range(2):
        # Cada comisión necesita su curso, y el nombre del curso es único.
        comision = crear_comision(
            db_session, sede=sede, curso=crear_curso(db_session, nombre=f"Curso {indice}")
        )
        comision.docente_id = docente.id
        db_session.flush()

    docente_sin_comisiones = crear_docente(
        db_session, dni="30111999", email="solo@techacademy.invalid"
    )

    respuesta = cliente_admin.get("/docentes")

    assert respuesta.status_code == 200, respuesta.text
    conteo = {d["id"]: d["cantidad_comisiones"] for d in respuesta.json()}
    assert conteo[docente.id] == 2
    assert conteo[docente_sin_comisiones.id] == 0


# ----------------------------------------------------------------------- sedes


def test_listado_de_sedes(cliente_admin: TestClient, db_session: Session) -> None:
    """Historia #8: el formulario de comisión necesita la lista para elegir la sede."""
    sede = crear_sede(db_session, nombre="Sede Villa Crespo")

    respuesta = cliente_admin.get("/sedes")

    assert respuesta.status_code == 200, respuesta.text
    assert {"id": sede.id, "nombre": "Sede Villa Crespo"} in respuesta.json()


# ------------------------------------------------------------- autorización


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("get", "/cursos"),
        ("get", "/comisiones"),
        ("get", "/sedes"),
        ("get", "/docentes"),
    ],
)
def test_las_lecturas_exigen_rol_de_administracion(
    api_client: TestClient, db_session: Session, metodo: str, ruta: str
) -> None:
    """Un docente no entra al catálogo ni al padrón: 403, no 404."""
    docente = crear_usuario_docente(db_session)
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(docente)))

    assert getattr(api_client, metodo)(ruta).status_code == 403


def test_el_alta_de_curso_sin_token_es_401(api_client: TestClient) -> None:
    assert api_client.post("/cursos", json={"nombre": "Sin token"}).status_code == 401


@pytest.mark.parametrize("ruta", ["/cursos", "/comisiones", "/docentes"])
def test_las_altas_exigen_rol_de_administracion(
    api_client: TestClient, db_session: Session, ruta: str
) -> None:
    """Un docente no escribe en el catálogo ni en el padrón: 403.

    Los tres cuerpos son válidos a propósito. Con un cuerpo inválido el 403 seguiría siendo la
    respuesta, pero el test pasaría por el motivo equivocado y dejaría de probar que lo que frena
    es el rol.
    """
    curso = crear_curso(db_session, nombre="Curso para la carrera")
    # Un solo docente: el factory de la cuenta crea el suyo si no le pasamos uno, y dos docentes
    # con el DNI por defecto chocarían por `uq_docente_dni_norm`.
    docente_del_padron = crear_docente(db_session)
    cuenta_docente = crear_usuario_docente(db_session, docente=docente_del_padron)
    cuerpos = {
        "/cursos": {"nombre": "Curso sin permiso"},
        "/comisiones": {
            "curso_id": curso.id,
            "docente_id": docente_del_padron.id,
            "dias_horarios": "Lunes 18:00 a 20:00",
            "arancel": "52000.00",
            "cupo_maximo": 20,
            "modalidad": Modalidad.VIRTUAL.value,
        },
        "/docentes": {
            "nombre": "Sin",
            "apellido": "Permiso",
            "dni": "39.888.777",
            "email": "sin.permiso@techacademy.invalid",
            "telefono": None,
        },
    }
    api_client.headers.update(encabezado_de_autorizacion(token_de_prueba(cuenta_docente)))

    respuesta = api_client.post(ruta, json=cuerpos[ruta])

    assert respuesta.status_code == 403
    # El 403 tiene que venir del guard de rol: es el único que declara a quién admite la ruta.
    assert respuesta.headers["X-Roles-Admitidos"] == "ADMIN"
    # Y lo que de verdad importa: el 403 no puede haber escrito nada.
    assert not any(c.nombre == "Curso sin permiso" for c in catalogo.listar_cursos(db_session))
    assert not any(
        d.email == "sin.permiso@techacademy.invalid" for d in padron.listar_docentes(db_session)
    )
    assert not catalogo.listar_comisiones(db_session)


def test_la_carrera_de_dos_altas_del_mismo_curso_es_409(
    cliente_admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D34: dos altas del mismo curso que calculan el mismo número se traducen a 409.

    La carrera real pide dos transacciones concurrentes, que es caro de montar y flaky. Lo que
    se prueba acá es la traducción, que es lo que importa: que el `IntegrityError` de
    `uq_comision_curso_numero` salga como 409 con la invitación a reintentar, y no como un 500
    que el operador no puede entender. Para eso se fuerza el número a uno que ya existe.
    """
    curso = crear_curso(db_session, nombre="Curso con carrera")
    docente = crear_docente(db_session)
    cuerpo = {
        "curso_id": curso.id,
        "docente_id": docente.id,
        "dias_horarios": "Lunes 18:00 a 20:00",
        "arancel": "52000.00",
        "cupo_maximo": 20,
        "modalidad": Modalidad.VIRTUAL.value,
    }
    primera = cliente_admin.post("/comisiones", json=cuerpo)
    assert primera.status_code == 201, primera.text

    monkeypatch.setattr(catalogo, "_siguiente_numero", lambda *_argumentos: 1)
    segunda = cliente_admin.post("/comisiones", json=cuerpo)

    assert segunda.status_code == 409, segunda.text
    assert "Probá de nuevo" in segunda.text
