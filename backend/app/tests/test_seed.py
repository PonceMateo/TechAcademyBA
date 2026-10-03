"""6.2 — La carga inicial de las tres cuentas de demostración.

Lo importante acá es la idempotencia: el comando se puede correr dos veces seguidas sin
duplicar registros ni fallar, y la segunda corrida deja lo mismo que la primera. Es lo que
permite que un compañero nuevo levante el proyecto y repita el comando sin pensarlo.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hashear_password, verificar_password
from app.models.enums import Rol
from app.models.padron import Alumno, Docente, Usuario
from app.services.emails import EmailAlreadyRegistered
from app.services.notificaciones import Mensaje, ResultadoEnvio
from app.services.seed import CONTRASEÑA_DEMO, CUENTAS_DEMO, cargar_datos_iniciales


class ServicioDeCorreoQueFalla:
    """Implementación que informa el fallo, como manda D17."""

    def __init__(self) -> None:
        self.intentos: list[Mensaje] = []

    def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
        self.intentos.append(mensaje)
        return ResultadoEnvio.fallido(mensaje, "el proveedor no está disponible")


class ServicioDeCorreoContado:
    def __init__(self) -> None:
        self.enviados: list[Mensaje] = []

    def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
        self.enviados.append(mensaje)
        return ResultadoEnvio.enviado(mensaje)


def _contar(session: Session, modelo) -> int:
    return session.scalar(select(func.count()).select_from(modelo)) or 0


def test_la_primera_carga_deja_las_tres_cuentas(db_session: Session) -> None:
    """Spec, "Primera ejecución": administración, docente y alumno."""
    resultado = cargar_datos_iniciales(db_session)

    assert resultado.creadas == 3
    assert resultado.actualizadas == 0
    assert [cuenta.rol for cuenta in resultado.cuentas] == ["ADMIN", "DOCENTE", "ALUMNO"]
    assert _contar(db_session, Usuario) == 3


def test_cada_cuenta_queda_vinculada_con_su_registro_de_padron(db_session: Session) -> None:
    """D4: la cuenta `DOCENTE` con su docente, la `ALUMNO` con su alumno, y la `ADMIN` con
    ninguno. Lo exige el CHECK de la base; la carga tiene que respetarlo."""
    cargar_datos_iniciales(db_session)

    admin = db_session.scalar(select(Usuario).where(Usuario.rol == Rol.ADMIN.value))
    docente = db_session.scalar(select(Usuario).where(Usuario.rol == Rol.DOCENTE.value))
    alumno = db_session.scalar(select(Usuario).where(Usuario.rol == Rol.ALUMNO.value))

    assert (admin.docente_id, admin.alumno_id) == (None, None)
    assert docente.docente_id is not None and docente.alumno_id is None
    assert alumno.alumno_id is not None and alumno.docente_id is None
    assert _contar(db_session, Docente) == 1
    assert _contar(db_session, Alumno) == 1


def test_las_cuentas_nacen_sin_cambio_de_password_pendiente(db_session: Session) -> None:
    """D18. Si quedaran pendientes, el usuario caería en un flujo que este change no
    implementa y no llegaría al shell."""
    cargar_datos_iniciales(db_session)

    cuentas = db_session.scalars(select(Usuario)).all()

    assert [cuenta.must_change_password for cuenta in cuentas] == [False, False, False]
    assert all(cuenta.is_active for cuenta in cuentas)


def test_las_contrasenas_son_las_documentadas(db_session: Session) -> None:
    """Spec, "Contraseñas del seed": las tres quedan con la contraseña del README, y
    guardan un hash de verdad."""
    cargar_datos_iniciales(db_session)

    for cuenta in CUENTAS_DEMO:
        usuario = db_session.scalar(select(Usuario).where(Usuario.email == cuenta.email))
        assert usuario is not None
        assert usuario.password_hash != CONTRASEÑA_DEMO
        assert usuario.password_hash.startswith("$2b$")
        assert verificar_password(CONTRASEÑA_DEMO, usuario.password_hash)


def test_las_contrasenas_del_seed_sirven_para_entrar(api_client, db_session: Session) -> None:
    """De punta a punta: la contraseña del README abre la sesión."""
    cargar_datos_iniciales(db_session)

    for cuenta in CUENTAS_DEMO:
        respuesta = api_client.post(
            "/auth/login",
            json={"email": cuenta.email, "password": CONTRASEÑA_DEMO},
        )
        assert respuesta.status_code == 200, cuenta.email
        assert respuesta.json()["rol"] == cuenta.rol.value


def test_correrla_dos_veces_no_duplica_ni_falla(db_session: Session) -> None:
    """La tarea 6.2 y el escenario "Ejecución repetida"."""
    primera = cargar_datos_iniciales(db_session)
    ids_primera = [cuenta.usuario_id for cuenta in primera.cuentas]

    segunda = cargar_datos_iniciales(db_session)

    assert segunda.creadas == 0
    assert segunda.actualizadas == 3
    assert [cuenta.usuario_id for cuenta in segunda.cuentas] == ids_primera
    assert _contar(db_session, Usuario) == 3
    assert _contar(db_session, Docente) == 1
    assert _contar(db_session, Alumno) == 1


def test_la_termera_corrida_tampoco_cambia_nada(db_session: Session) -> None:
    """Idempotente de verdad: no es que la segunda compense, es que ninguna agrega."""
    for _ in range(3):
        cargar_datos_iniciales(db_session)

    assert _contar(db_session, Usuario) == 3


def test_la_carga_actualiza_el_hash_si_alguien_cambio_la_password(db_session: Session) -> None:
    """La cuenta vuelve a quedar con la contraseña documentada, que es lo que promete el
    comando, y sin gastar un hash nuevo si ya estaba bien."""
    cargar_datos_iniciales(db_session)
    usuario = db_session.scalar(select(Usuario).where(Usuario.email == CUENTAS_DEMO[0].email))
    usuario.password_hash = hashear_password("una-clave-que-no-es-la-del-readme")

    cargar_datos_iniciales(db_session)

    assert verificar_password(CONTRASEÑA_DEMO, usuario.password_hash)
    assert not verificar_password("una-clave-que-no-es-la-del-readme", usuario.password_hash)


def test_cada_cuenta_recibe_su_aviso(db_session: Session) -> None:
    """El aviso lleva las credenciales de esa cuenta y texto de es-AR."""
    correo = ServicioDeCorreoContado()

    resultado = cargar_datos_iniciales(db_session, email_service=correo)

    assert len(correo.enviados) == 3
    for cuenta in CUENTAS_DEMO:
        recibido = next(m for m in correo.enviados if m.destinatario == cuenta.email)
        assert CONTRASEÑA_DEMO in recibido.cuerpo
        assert cuenta.email in recibido.cuerpo
        assert cuenta.nombre in recibido.cuerpo
    assert all(cuenta.correo.exito for cuenta in resultado.cuentas)


def test_un_correo_fallido_no_revierte_las_cuentas(db_session: Session) -> None:
    """El requisito de D17 y de la historia #13: el alta se completa aunque el correo
    falle, y el administrador queda informado del fallo."""
    correo = ServicioDeCorreoQueFalla()

    resultado = cargar_datos_iniciales(db_session, email_service=correo)

    # Las tres cuentas existen...
    assert resultado.creadas == 3
    cuentas = db_session.scalars(select(Usuario)).all()
    assert len(cuentas) == 3
    assert {cuenta.email for cuenta in cuentas} == {cuenta.email for cuenta in CUENTAS_DEMO}

    # ...y el fallo está informado, no escondido.
    assert len(correo.intentos) == 3
    assert len(resultado.correos_fallidos) == 3
    assert resultado.correos_fallidos[0].correo.detalle == "el proveedor no está disponible"


def test_un_correo_fallido_no_impide_que_las_cuentas_sirvan_para_entrar(
    api_client, db_session: Session
) -> None:
    """La consecuencia de la anterior, de punta a punta: el correo no llegó y el login
    funciona igual."""
    cargar_datos_iniciales(db_session, email_service=ServicioDeCorreoQueFalla())

    respuesta = api_client.post(
        "/auth/login",
        json={"email": CUENTAS_DEMO[0].email, "password": CONTRASEÑA_DEMO},
    )

    assert respuesta.status_code == 200


def test_la_carga_respeta_la_unicidad_de_correo_entre_padrones(db_session: Session) -> None:
    """M1: si el correo del docente de demostración ya está tomado por un alumno, la carga
    se detiene en vez de dejar dos personas con la misma dirección."""
    db_session.add(
        Alumno(
            nombre="Otra alumna",
            documento="99999999",
            documento_norm="99999999",
            tipo_documento="DNI",
            email=CUENTAS_DEMO[1].email,
        )
    )
    db_session.flush()

    with pytest.raises(EmailAlreadyRegistered):
        cargar_datos_iniciales(db_session)


def test_la_carga_no_toca_las_cuentas_que_no_son_de_demostracion(db_session: Session) -> None:
    """Una cuenta real no se ve afectada: la carga solo converge las suyas."""
    docente = Docente(
        nombre="Docente",
        apellido="Real",
        dni="33444555",
        dni_norm="33444555",
        cuil="20345678902",
        email="docente.real@techacademy.invalid",
    )
    db_session.add(docente)
    db_session.flush()
    ajena = Usuario(
        email=docente.email,
        nombre="Docente real",
        password_hash=hashear_password("su-clave"),
        rol=Rol.DOCENTE.value,
        must_change_password=True,
        docente_id=docente.id,
    )
    db_session.add(ajena)
    db_session.flush()

    cargar_datos_iniciales(db_session)

    assert ajena.nombre == "Docente real"
    assert verificar_password("su-clave", ajena.password_hash)
    assert ajena.must_change_password is True


def test_el_aviso_menciona_que_es_un_entorno_de_demostracion(db_session: Session) -> None:
    """D22: nada del texto puede hacer creer que hay datos reales o una contraseña de
    producción."""
    correo = ServicioDeCorreoContado()

    cargar_datos_iniciales(db_session, email_service=correo)

    for mensaje in correo.enviados:
        assert "demostración" in mensaje.cuerpo
