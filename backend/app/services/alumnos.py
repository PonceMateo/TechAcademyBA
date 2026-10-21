"""Reglas de negocio del padrón de alumnos (alta, lectura y búsqueda; historias #13 y #16).

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
import re
import unicodedata
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
from app.schemas.alumnos import AlumnoCreate
from app.services.emails import ensure_email_available
from app.services.normalization import normalize_document

logger = logging.getLogger(__name__)

#: Parte del nombre que entra en la contraseña inicial. El DNI aporta hasta 8 dígitos, así que con
#: 32 caracteres la contraseña nunca se acerca al límite de 72 bytes que procesa bcrypt.
_MAX_NOMBRE_EN_PASSWORD = 32

#: Caracteres que se conservan del primer nombre: letras sin tildes y dígitos, en minúsculas.
_NON_ALPHANUMERIC_LOWER = re.compile(r"[^a-z0-9]+")


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


def generar_password_inicial(nombre: str, documento: str) -> str:
    """Genera la contraseña inicial del alumno: `<primer nombre><DNI>` (D45).

    El primer nombre va en minúsculas, sin tildes y sin signos; el DNI, solo sus dígitos. Así
    `Rocío Álvarez` con `30.111.222` recibe `rocio30111222`. Es una convención que la secretaría
    puede dictar en voz alta y que el alumno cambia en su primer ingreso.

    >>> generar_password_inicial("Juan Ignacio Pérez", "38.456.789")
    'juan38456789'
    >>> generar_password_inicial("Ángel", "30111222")
    'angel30111222'
    """
    primer_nombre = nombre.strip().split()[0] if nombre.strip() else ""
    descompuesto = unicodedata.normalize("NFKD", primer_nombre)
    sin_tildes = "".join(char for char in descompuesto if not unicodedata.combining(char))
    limpio = _NON_ALPHANUMERIC_LOWER.sub("", sin_tildes.lower())[:_MAX_NOMBRE_EN_PASSWORD]
    digitos = normalize_document(documento) or ""
    password = f"{limpio or 'alumno'}{digitos}"

    # El DNI del contrato tiene 7 u 8 dígitos y el nombre se corta, así que hoy no se alcanza.
    # La comprobación queda para que la convención no pueda producir una clave que bcrypt
    # truncaría en silencio si mañana cambia el contrato.
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("la contraseña inicial supera el límite de bcrypt")

    return password


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

    La búsqueda por DNI o email es la historia #16: se compara el documento normalizado y el
    email completo, sin inventar coincidencias parciales. La habilitación queda en `None`: es la
    HU #27 (Should) y no se inventa un estado.
    """
    alumnos = list(session.scalars(select(Alumno).order_by(Alumno.id)))

    if consulta and consulta.strip():
        aguja = consulta.strip()
        normalizada = normalize_document(aguja)
        filtrados: list[Alumno] = []
        for alumno in alumnos:
            coincide_documento = normalizada and alumno.documento_norm == normalizada
            coincide_email = alumno.email.lower() == aguja.lower()
            if coincide_documento or coincide_email:
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
        if inscripcion is not None and inscripcion.comision is not None:
            alumno.comision = SimpleNamespace(  # type: ignore[attr-defined]
                codigo=inscripcion.comision.codigo,
                nombre=inscripcion.comision.curso.nombre,
            )
            alumno.categoria = inscripcion.categoria  # type: ignore[attr-defined]
            alumno.porcentaje_beca = inscripcion.porcentaje_beca  # type: ignore[attr-defined]
        else:
            alumno.comision = None  # type: ignore[attr-defined]
            alumno.categoria = None  # type: ignore[attr-defined]
            alumno.porcentaje_beca = None  # type: ignore[attr-defined]
        alumno.acceso = None  # type: ignore[attr-defined]

    return alumnos


def _traducir_duplicado(error: IntegrityError) -> None:
    """Convierte un `IntegrityError` del alta en el rechazo que nombra el campo repetido."""
    motivo = str(getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig)
    if INDICE_DOCUMENTO in motivo:
        raise AlumnoDuplicado("documento") from error
    if INDICE_EMAIL in motivo or INDICE_USUARIO_EMAIL in motivo:
        raise AlumnoDuplicado(CAMPO_EMAIL) from error
    logger.warning("El alta de alumno chocó con una restricción no prevista: %s", motivo)
