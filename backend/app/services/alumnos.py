"""Reglas de negocio del padrón de alumnos (historia #13).

Vive en `services` y no en el router por D1, y confirma la transacción por la misma razón que
`app/services/padron.py`: `get_db` cierra la sesión sin confirmar.

**El alta crea dos filas o no crea ninguna.** El `Alumno` y su `Usuario` van juntos porque una
cuenta `ALUMNO` sin alumno la impide el CHECK `rol_vinculo_coherente`, y un alumno sin cuenta no
tiene acceso a la plataforma. Si falla cualquiera de las dos inserciones, se revierte la
transacción y no queda ninguna.

**La contraseña es la de demostración y la cuenta nace sin cambio pendiente.** Es la misma
decisión que el alta de docente y el seed (D18), y por el mismo motivo: el flujo de cambio de
contraseña no existe, así que marcar la cuenta como pendiente mandaría al alumno a un cartel que
dice que todavía no está disponible. La contraseña es **solo para desarrollo** (D44).

**El alta no envía ningún correo.** El envío de credenciales está pendiente de una decisión del
equipo y llamar a `EmailService` simularía un envío que no existe; la pantalla aclara que la
cuenta se creó pero las credenciales no se enviaron.

**Los duplicados se buscan en este orden: documento y después email.** Cuando los dos están
repetidos, el mensaje habla del documento, que es el identificador que la secretaría tiene a
mano. La carrera entre dos altas simultáneas la traduce el `IntegrityError` por nombre de
restricción (D44).
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import CONTRASEÑA_DEMO, hashear_password
from app.models.enums import Rol, TipoDocumento
from app.models.padron import Alumno, Usuario
from app.schemas.alumnos import AlumnoCreate
from app.services.emails import ensure_email_available
from app.services.normalization import normalize_document

logger = logging.getLogger(__name__)

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


def crear_alumno(session: Session, datos: AlumnoCreate) -> Alumno:
    """Crea el alumno y su cuenta de acceso, en una sola transacción.

    El documento se guarda tal como lo informó la secretaría y la forma normalizada —solo
    dígitos— es la que sostiene el índice único, para que `38.456.789` colisione con `38456789`.
    La unicidad cruzada de correo entre los tres padrones la sigue sosteniendo
    `ensure_email_available` (M1): tres índices únicos son tres índices por tabla.
    """
    documento_norm = normalize_document(datos.documento)
    existente = session.scalar(select(Alumno.id).where(Alumno.documento_norm == documento_norm))
    if existente is not None:
        raise AlumnoDuplicado("documento")

    ensure_email_available(session, datos.email)

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
                password_hash=hashear_password(CONTRASEÑA_DEMO),
                rol=Rol.ALUMNO.value,
                # Ver el docstring del módulo: el flujo de cambio de contraseña no existe.
                must_change_password=False,
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

    return alumno


def listar_alumnos(session: Session) -> list[Alumno]:
    """Padrón completo, en el orden en que se dio de alta cada alumno."""
    return list(session.scalars(select(Alumno).order_by(Alumno.id)))


def _traducir_duplicado(error: IntegrityError) -> None:
    """Convierte un `IntegrityError` del alta en el rechazo que nombra el campo repetido."""
    motivo = str(getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig)
    if INDICE_DOCUMENTO in motivo:
        raise AlumnoDuplicado("documento") from error
    if INDICE_EMAIL in motivo or INDICE_USUARIO_EMAIL in motivo:
        raise AlumnoDuplicado(CAMPO_EMAIL) from error
    logger.warning("El alta de alumno chocó con una restricción no prevista: %s", motivo)
