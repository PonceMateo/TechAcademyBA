"""Reglas de negocio del padrón de docentes (historia #9).

Vive en `services` y no en el router por D1, y confirma la transacción por la misma razón que
`app/services/catalogo.py`: `get_db` cierra la sesión sin confirmar.

**El alta crea dos filas o no crea ninguna.** El `Docente` y su `Usuario` van juntos porque una
cuenta sin docente es un estado que el CHECK `rol_vinculo_coherente` impide, y un docente sin
cuenta no cumple el criterio de #9 ("el docente se crea con acceso por su mail"). Con una sola
transacción, o quedan las dos o no queda ninguna.

**La contraseña es la de demostración y la cuenta nace sin cambio pendiente.** Es la decisión de
esta fase, coherente con D18, y vale la pena decir por qué no es un descuido: el flujo de cambio
de contraseña **no existe**, así que marcar la cuenta como pendiente mandaría al docente a un
cartel que textualmente dice que el flujo todavía no está disponible
(`frontend/src/components/session/AvisoCambioContrasena.jsx`). Una cuenta que crea la secretaría
con una contraseña que la secretaría conoce no tiene nada que cambiar. **Cuando exista el flujo,
esto se revierte** y la cuenta nace con `must_change_password = True`, como dice el modelo.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import CONTRASEÑA_DEMO, hashear_password
from app.models.catalogo import Comision
from app.models.enums import Rol
from app.models.padron import Docente, Usuario
from app.schemas.padron import DocenteCreate
from app.services.emails import ensure_email_available
from app.services.normalization import normalize_document

logger = logging.getLogger(__name__)

#: Restricciones que PostgreSQL levanta en el alta de un docente, por nombre. La comparación va
#: por nombre de restricción y no por el texto del mensaje, porque el texto cambia entre
#: versiones de PostgreSQL y el nombre no.
INDICE_DNI = "uq_docente_dni_norm"
INDICE_EMAIL = "uq_docente_email"


class DocenteDuplicado(Exception):
    """El DNI o el email ya están registrados.

    `campo` dice **cuál de los dos** se repitió, porque el criterio de la historia #9 pide saber
    qué colisionó y "el docente ya existe" no alcanza para corregir el formulario.
    """

    def __init__(self, campo: str) -> None:
        self.campo = campo
        super().__init__(f"Ya hay un docente registrado con ese {campo}.")


def crear_docente(session: Session, datos: DocenteCreate) -> Docente:
    """Crea el docente y su cuenta de acceso, en una sola transacción.

    La unicidad cruzada de correo entre los tres padrones la sigue sosteniendo
    `ensure_email_available` (M1): tres índices únicos son tres índices por tabla y no impiden
    que una dirección esté en dos padrones a la vez. Ese chequeo **no** excluye a nadie porque
    el docente es nuevo: su fila todavía no existe, y la del `usuario` se crea después.
    """
    ensure_email_available(session, datos.email)

    docente = Docente(
        nombre=datos.nombre,
        apellido=datos.apellido,
        dni=datos.dni,
        dni_norm=normalize_document(datos.dni),
        # D33: el CUIL no se pide. Un CUIL inventado es peor que ninguno.
        cuil=None,
        email=datos.email,
        telefono=datos.telefono,
    )
    session.add(docente)
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        _traducir_duplicado(error)
        raise

    session.add(
        Usuario(
            email=datos.email,
            nombre=f"{datos.nombre} {datos.apellido}",
            password_hash=hashear_password(CONTRASEÑA_DEMO),
            rol=Rol.DOCENTE.value,
            # Ver el docstring del módulo: el flujo de cambio de contraseña no existe.
            must_change_password=False,
            is_active=True,
            docente_id=docente.id,
        )
    )
    session.commit()
    return docente


def listar_docentes(session: Session) -> list[Docente]:
    """Docentes con la cantidad de comisiones asignadas ya resuelta.

    `cantidad_comisiones` sale de una sola consulta agrupada, por el mismo motivo que las
    vacantes del catálogo: recorrer las comisiones docente por docente sería una consulta por
    fila. La cuenta se arma desde `Comision` porque el modelo no declara la relación inversa.
    """
    docentes = list(session.scalars(select(Docente).order_by(Docente.id)))

    conteo = dict(
        session.execute(
            select(Comision.docente_id, func.count(Comision.id))
            .where(Comision.docente_id.is_not(None))
            .group_by(Comision.docente_id)
        ).all()
    )

    for docente in docentes:
        docente.cantidad_comisiones = conteo.get(docente.id, 0)
    return docentes


def _traducir_duplicado(error: IntegrityError) -> None:
    """Convierte un `IntegrityError` del alta en el rechazo que nombra el campo que se repitió."""
    motivo = str(getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig)
    if INDICE_DNI in motivo:
        raise DocenteDuplicado("DNI") from error
    if INDICE_EMAIL in motivo:
        raise DocenteDuplicado("email") from error
    logger.warning("El alta de docente chocó con una restricción no prevista: %s", motivo)
