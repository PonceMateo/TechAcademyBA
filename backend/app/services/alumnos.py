"""Reglas de negocio del padrón de alumnos: alta, lectura, búsqueda, edición y baja.

Historias #13, #16 y #17.

Vive en `services` y no en el router por D1, y confirma la transacción por la misma razón que
`app/services/padron.py`: `get_db` cierra la sesión sin confirmar.

**El alta crea dos filas o no crea ninguna.** El `Alumno` y su `Usuario` van juntos porque una
cuenta `ALUMNO` sin alumno la impide el CHECK `rol_vinculo_coherente`, y un alumno sin cuenta no
tiene acceso a la plataforma. Si falla cualquiera de las dos inserciones, se revierte la
transacción y no queda ninguna.

**La contraseña inicial se genera y se muestra una sola vez.** Es `<primer nombre><DNI>`, en
minúsculas y sin tildes: `Juan Ignacio Pérez` con `38.456.789` recibe `juan38456789` (D45). El
administrador la ve en la respuesta del alta y se la entrega al alumno; **no se envía por
correo**. En la base queda solo su hash bcrypt.

**La cuenta nace con `must_change_password = true`.** El alumno tiene que cambiar la contraseña
en su primer ingreso antes de usar el sistema: el backend rechaza las rutas de rol mientras el
indicador siga pendiente (D45).

**Los duplicados se buscan en este orden: documento y después email.** Cuando los dos están
repetidos, el mensaje habla del documento, que es el identificador que la secretaría tiene a
mano. La carrera entre dos altas simultáneas la traduce el `IntegrityError` por nombre de
restricción (D44).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import MAX_PASSWORD_BYTES, hashear_password
from app.models.catalogo import Comision
from app.models.enums import Rol, TipoDocumento
from app.models.inscripciones import Inscripcion
from app.models.padron import Alumno, Usuario
from app.schemas.alumnos import AlumnoCreate, AlumnoUpdate
from app.services.auth import PASSWORD_MIN_LENGTH, PasswordInvalida
from app.services.emails import ensure_email_available, find_patron_registrado
from app.services.habilitacion import derivar_estado
from app.services.normalization import generar_password_inicial, normalize_document

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AltaAlumno:
    """Resultado del alta: el alumno y la contraseña inicial que hay que entregar.

    La contraseña en claro **no se persiste**: viaja en esta respuesta y el administrador se la
    entrega al alumno. La base guarda solo el hash.
    """

    alumno: Alumno
    password_inicial: str

#: Restricciones que PostgreSQL levanta en el alta de un alumno, por nombre. La comparación va
#: por nombre de restricción y no por el texto del mensaje, porque el texto cambia entre
#: versiones de PostgreSQL y el nombre no.
INDICE_DOCUMENTO = "uq_alumno_documento_norm"
INDICE_EMAIL = "uq_alumno_email"
INDICE_USUARIO_EMAIL = "uq_usuario_email"

#: El campo que se nombra en el rechazo cuando el correo choca contra `usuario.email`.
CAMPO_EMAIL = "email"


class AlumnoDuplicado(Exception):
    """El documento o el email ya están registrados.

    `campo` dice **cuál de los dos** se repitió, porque el criterio de la historia #13 pide saber
    qué colisionó y "el alumno ya existe" no alcanza para corregir el formulario. El mensaje no
    incluye los datos del alumno existente (D44).
    """

    def __init__(self, campo: str) -> None:
        self.campo = campo
        super().__init__(f"Ya hay un alumno registrado con ese {campo}.")


class AlumnoNoEncontrado(Exception):
    """El `id` pedido no corresponde a ningún alumno."""

    def __init__(self) -> None:
        super().__init__("El alumno no existe.")


class AlumnoYaDadoDeBaja(Exception):
    """La operación no aplica sobre un alumno que ya está inactivo."""

    def __init__(self) -> None:
        super().__init__("El alumno ya está dado de baja.")


class AlumnoYaActivo(Exception):
    """La operación de reactivación no aplica sobre un alumno que ya está activo."""

    def __init__(self) -> None:
        super().__init__("El alumno ya está activo.")


class AlumnoSinCuenta(Exception):
    """El alumno no tiene un `Usuario` vinculado y no se puede restablecer su contraseña."""

    def __init__(self) -> None:
        super().__init__("El alumno no tiene una cuenta de acceso.")


def crear_alumno(session: Session, datos: AlumnoCreate) -> AltaAlumno:
    """Crea el alumno y su cuenta de acceso, en una sola transacción.

    El documento se guarda tal como lo informó la secretaría y la forma normalizada —solo
    dígitos— es la que sostiene el índice único, para que `38.456.789` colisione con `38456789`.
    La unicidad cruzada de correo entre los tres padrones la sigue sosteniendo
    `ensure_email_available` (M1): tres índices únicos son tres índices por tabla.

    Devuelve el alumno junto con la contraseña inicial en claro, que la ruta muestra al
    administrador. La base guarda solo su hash y la cuenta queda pendiente de cambio (D45).
    """
    documento_norm = normalize_document(datos.documento)
    existente = session.scalar(select(Alumno.id).where(Alumno.documento_norm == documento_norm))
    if existente is not None:
        raise AlumnoDuplicado("documento")

    ensure_email_available(session, datos.email)

    password_inicial = generar_password_inicial(datos.nombre, datos.documento)

    alumno = Alumno(
        nombre=datos.nombre,
        documento=datos.documento,
        documento_norm=documento_norm,
        tipo_documento=TipoDocumento.DNI.value,
        email=datos.email,
        telefono=datos.telefono,
    )
    session.add(alumno)

    try:
        session.flush()
        session.add(
            Usuario(
                email=datos.email,
                nombre=datos.nombre,
                password_hash=hashear_password(password_inicial),
                rol=Rol.ALUMNO.value,
                # El alumno tiene que cambiarla en su primer ingreso (D45).
                must_change_password=True,
                is_active=True,
                alumno_id=alumno.id,
            )
        )
        session.commit()
    except IntegrityError as error:
        session.rollback()
        _traducir_duplicado(error)
        raise
    except Exception:
        # Cualquier otro fallo al crear la cuenta (por ejemplo, el hash) revierte el alumno:
        # o quedan las dos filas o no queda ninguna.
        session.rollback()
        raise

    return AltaAlumno(alumno=alumno, password_inicial=password_inicial)


def listar_alumnos(session: Session, consulta: str | None = None) -> list[Alumno]:
    """Alumnos ordenados por id, con la comisión y categoría de su inscripción.

    La búsqueda por DNI, email o nombre admite coincidencias parciales (HU #16). La
    habilitación queda en `None`: es la HU #27 (Should) y no se inventa un estado.
    """
    alumnos = list(
        session.scalars(
            select(Alumno).where(Alumno.activo.is_(True)).order_by(Alumno.id)
        )
    )

    if consulta and consulta.strip():
        aguja = consulta.strip()
        aguja_lower = aguja.lower()
        normalizada = normalize_document(aguja)
        filtrados: list[Alumno] = []
        for alumno in alumnos:
            documento = (alumno.documento or "").lower()
            documento_norm = (alumno.documento_norm or "").lower()
            email = alumno.email.lower()
            nombre = alumno.nombre.lower()
            if (
                aguja_lower in email
                or aguja_lower in documento
                or aguja_lower in nombre
                or (normalizada is not None and normalizada in documento_norm)
            ):
                filtrados.append(alumno)
        alumnos = filtrados

    inscripciones = list(
        session.scalars(
            select(Inscripcion)
            .options(selectinload(Inscripcion.comision).selectinload(Comision.curso))
            .order_by(Inscripcion.id)
        )
    )
    por_alumno: dict[int, Inscripcion] = {}
    for inscripcion in inscripciones:
        por_alumno.setdefault(inscripcion.alumno_id, inscripcion)

    for alumno in alumnos:
        inscripcion = por_alumno.get(alumno.id)
        if inscripcion is not None:
            alumno.inscripcion_id = inscripcion.id  # type: ignore[attr-defined]
            if inscripcion.comision is not None:
                alumno.comision = SimpleNamespace(  # type: ignore[attr-defined]
                    codigo=inscripcion.comision.codigo,
                    nombre=inscripcion.comision.curso.nombre,
                )
            else:
                alumno.comision = None  # type: ignore[attr-defined]
            alumno.categoria = inscripcion.categoria  # type: ignore[attr-defined]
            alumno.porcentaje_beca = inscripcion.porcentaje_beca  # type: ignore[attr-defined]
            estado, causa, forzado = derivar_estado(session, inscripcion)
            alumno.acceso = SimpleNamespace(  # type: ignore[attr-defined]
                estado=estado,
                causa=causa,
                forzado=forzado,
            )
        else:
            alumno.inscripcion_id = None  # type: ignore[attr-defined]
            alumno.comision = None  # type: ignore[attr-defined]
            alumno.categoria = None  # type: ignore[attr-defined]
            alumno.porcentaje_beca = None  # type: ignore[attr-defined]
            alumno.acceso = None  # type: ignore[attr-defined]

    return alumnos


def obtener_alumno(session: Session, alumno_id: int) -> Alumno:
    """Devuelve el alumno por `id` o falla con `AlumnoNoEncontrado`."""
    alumno = session.get(Alumno, alumno_id)
    if alumno is None:
        raise AlumnoNoEncontrado
    return alumno


def editar_alumno(session: Session, alumno: Alumno, datos: AlumnoUpdate) -> Alumno:
    """Actualiza los datos personales y sincroniza la cuenta, en una sola transacción (HU #17).

    El `id` no cambia, así que las inscripciones, imputaciones y el historial siguen apuntando al
    mismo legajo. Los duplicados se buscan excluyendo al propio alumno: cambiar un dato por el
    mismo valor no puede chocar contra su propia fila.
    """
    documento_norm = normalize_document(datos.documento)
    existente = session.scalar(
        select(Alumno.id).where(
            Alumno.documento_norm == documento_norm,
            Alumno.id != alumno.id,
        )
    )
    if existente is not None:
        raise AlumnoDuplicado("documento")

    usuario = _usuario_del_alumno(session, alumno)
    ensure_email_available(
        session,
        datos.email,
        exclude_alumno_id=alumno.id,
        exclude_usuario_id=usuario.id if usuario is not None else None,
    )

    alumno.nombre = datos.nombre
    alumno.documento = datos.documento
    alumno.documento_norm = documento_norm
    alumno.tipo_documento = TipoDocumento.DNI.value
    alumno.email = datos.email
    alumno.telefono = datos.telefono

    if usuario is not None:
        usuario.nombre = datos.nombre
        usuario.email = datos.email

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        _traducir_duplicado(error)
        raise

    return alumno


def restablecer_password(session: Session, alumno: Alumno, nueva: str) -> Alumno:
    """Reemplaza la contraseña del alumno y exige su cambio en el próximo ingreso (HU #17).

    La contraseña anterior deja de servir porque el hash se reemplaza. La cuenta queda con
    `must_change_password = true`, el mismo mecanismo que usa el alta (D45), y no se envía correo.
    """
    usuario = _usuario_del_alumno(session, alumno)
    if usuario is None:
        raise AlumnoSinCuenta

    if len(nueva) < PASSWORD_MIN_LENGTH:
        raise PasswordInvalida(
            f"La contraseña nueva tiene que tener al menos {PASSWORD_MIN_LENGTH} caracteres."
        )
    if len(nueva.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise PasswordInvalida(
            f"La contraseña nueva no puede superar los {MAX_PASSWORD_BYTES} bytes."
        )

    usuario.password_hash = hashear_password(nueva)
    usuario.must_change_password = True
    session.commit()
    return alumno


def buscar_alumno_reactivable(
    session: Session, documento: str, email: str
) -> Alumno | None:
    """Devuelve el alumno inactivo que corresponde al alta, si se puede reactivar (HU #17).

    Solo hay reactivación cuando el DNI o el email pertenecen al mismo alumno inactivo y ninguno
    de los dos choca con un registro activo, otro padrón o otra cuenta. Si el DNI y el email
    apuntan a alumnos distintos, o alguno está activo, se devuelve `None`: el alta sigue su
    camino normal de rechazo y nunca se crea un duplicado.
    """
    documento_norm = normalize_document(documento)
    por_documento = session.scalar(
        select(Alumno).where(Alumno.documento_norm == documento_norm)
    )
    por_email = session.scalar(select(Alumno).where(Alumno.email == email))

    if (por_documento is not None and por_documento.activo) or (
        por_email is not None and por_email.activo
    ):
        return None
    if (
        por_documento is not None
        and por_email is not None
        and por_documento.id != por_email.id
    ):
        return None

    alumno = por_documento or por_email
    if alumno is None:
        return None

    usuario = _usuario_del_alumno(session, alumno)
    patron = find_patron_registrado(
        session,
        email,
        exclude_alumno_id=alumno.id,
        exclude_usuario_id=usuario.id if usuario is not None else None,
    )
    if patron is not None:
        return None
    return alumno


def reactivar_alumno(session: Session, alumno: Alumno, datos: AlumnoCreate) -> AltaAlumno:
    """Reactiva el mismo registro y renueva el acceso, sin crear un duplicado (HU #17).

    Conserva el `id`, el legajo, las inscripciones, los pagos y el historial. Genera una nueva
    contraseña inicial con la convención del alta (D45), guarda solo su hash y deja la cuenta con
    `must_change_password = true`. Los conflictos de unicidad se validan otra vez dentro de la
    transacción, porque entre la consulta del modal y la confirmación puede cambiar el padrón.
    """
    if alumno.activo:
        raise AlumnoYaActivo

    documento_norm = normalize_document(datos.documento)
    existente = session.scalar(
        select(Alumno.id).where(
            Alumno.documento_norm == documento_norm,
            Alumno.id != alumno.id,
        )
    )
    if existente is not None:
        raise AlumnoDuplicado("documento")

    usuario = _usuario_del_alumno(session, alumno)
    ensure_email_available(
        session,
        datos.email,
        exclude_alumno_id=alumno.id,
        exclude_usuario_id=usuario.id if usuario is not None else None,
    )

    password_inicial = generar_password_inicial(datos.nombre, datos.documento)

    alumno.nombre = datos.nombre
    alumno.documento = datos.documento
    alumno.documento_norm = documento_norm
    alumno.tipo_documento = TipoDocumento.DNI.value
    alumno.email = datos.email
    alumno.telefono = datos.telefono
    alumno.activo = True

    try:
        if usuario is None:
            session.add(
                Usuario(
                    email=datos.email,
                    nombre=datos.nombre,
                    password_hash=hashear_password(password_inicial),
                    rol=Rol.ALUMNO.value,
                    must_change_password=True,
                    is_active=True,
                    alumno_id=alumno.id,
                )
            )
        else:
            usuario.email = datos.email
            usuario.nombre = datos.nombre
            usuario.password_hash = hashear_password(password_inicial)
            usuario.must_change_password = True
            usuario.is_active = True
        session.commit()
    except IntegrityError as error:
        session.rollback()
        _traducir_duplicado(error)
        raise
    except Exception:
        session.rollback()
        raise

    return AltaAlumno(alumno=alumno, password_inicial=password_inicial)


def dar_de_baja(session: Session, alumno: Alumno) -> Alumno:
    """Baja lógica del alumno y de su cuenta de acceso (HU #17).

    No elimina filas: `alumno.activo` e `is_active` son la representación de la baja en el modelo.
    Las inscripciones, pagos e historial quedan intactos y el DNI y el email siguen reservados por
    los índices únicos existentes.
    """
    if not alumno.activo:
        raise AlumnoYaDadoDeBaja

    usuario = _usuario_del_alumno(session, alumno)
    alumno.activo = False
    if usuario is not None:
        usuario.is_active = False
    session.commit()
    return alumno


def _usuario_del_alumno(session: Session, alumno: Alumno) -> Usuario | None:
    """La cuenta de acceso vinculada al alumno, si existe."""
    return session.scalar(select(Usuario).where(Usuario.alumno_id == alumno.id))


def _traducir_duplicado(error: IntegrityError) -> None:
    """Convierte un `IntegrityError` del alta en el rechazo que nombra el campo repetido."""
    motivo = str(getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig)
    if INDICE_DOCUMENTO in motivo:
        raise AlumnoDuplicado("documento") from error
    if INDICE_EMAIL in motivo or INDICE_USUARIO_EMAIL in motivo:
        raise AlumnoDuplicado(CAMPO_EMAIL) from error
    logger.warning("El alta de alumno chocó con una restricción no prevista: %s", motivo)
