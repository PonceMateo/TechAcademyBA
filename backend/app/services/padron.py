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
import re
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import CONTRASEÑA_DEMO, hashear_password
from app.models.catalogo import Comision
from app.models.enums import Rol
from app.models.padron import Docente, Usuario
from app.schemas.padron import DocenteCreate
from app.services.emails import ensure_email_available
from app.services.normalization import normalize_document, normalize_name

logger = logging.getLogger(__name__)

#: Un DNI se busca solo cuando la consulta tiene dígitos y separadores, no cuando mezcla letras.
_DNI_CON_SEPARADORES = re.compile(r"^[0-9.\s-]+$")

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


def listar_docentes(session: Session, consulta: str | None = None) -> list[Docente]:
    """Docentes activos, con sus comisiones y ordenados por coincidencia (historia #10).

    La búsqueda compara desde el comienzo de las palabras del nombre y del apellido, en orden, y
    desde el comienzo del DNI o del email. El orden resultante prioriza la coincidencia en la
    primera palabra del nombre, después las palabras posteriores o el apellido, después el DNI y
    al final el email; `id` desempata.

    Las comisiones salen de una sola consulta con `selectinload(Comision.curso)`: recorrer las
    comisiones docente por docente sería una consulta por fila. `cantidad_comisiones` se deriva
    de esa misma lista y se conserva por compatibilidad con la pantalla anterior.
    """
    docentes = list(
        session.scalars(select(Docente).where(Docente.activo.is_(True)).order_by(Docente.id))
    )

    aguja = consulta.strip() if consulta else ""
    if aguja:
        palabras = _palabras(aguja)
        encontrados: list[tuple[tuple[int, int, int], Docente]] = []
        for docente in docentes:
            clave = _clave_de_coincidencia(docente, aguja, palabras)
            if clave is not None:
                encontrados.append((clave, docente))
        encontrados.sort(key=lambda par: par[0])
        docentes = [docente for _, docente in encontrados]

    _asignar_comisiones(session, docentes)
    return docentes


def _palabras(texto: str) -> list[str]:
    """Parte un texto en palabras normalizadas, sin tildes ni signos."""
    palabras: list[str] = []
    for parte in texto.split():
        normalizada = normalize_name(parte)
        if normalizada:
            palabras.append(normalizada)
    return palabras


def _posicion_en_nombre(docente: Docente, palabras: list[str]) -> int | None:
    """Índice de la primera palabra del nombre que coincide, o `None` si no hay coincidencia.

    Cada palabra de la consulta tiene que empezar una palabra distinta del nombre completo, en
    orden. Así `ana gom` encuentra `Ana María Gómez`, pero `gom ana` no invierte el orden.
    """
    nombre = _palabras(f"{docente.nombre} {docente.apellido}")
    if not palabras or not nombre:
        return None

    posicion = 0
    primera: int | None = None
    for palabra in palabras:
        encontrada = next(
            (
                indice
                for indice in range(posicion, len(nombre))
                if nombre[indice].startswith(palabra)
            ),
            None,
        )
        if encontrada is None:
            return None
        if primera is None:
            primera = encontrada
        posicion = encontrada + 1

    return primera


def _coincide_dni(docente: Docente, aguja: str) -> bool:
    """El DNI se busca con o sin separadores y por el comienzo de sus dígitos."""
    if not _DNI_CON_SEPARADORES.fullmatch(aguja):
        return False
    digitos = normalize_document(aguja)
    return bool(digitos and docente.dni_norm.startswith(digitos))


def _coincide_email(docente: Docente, aguja: str) -> bool:
    """El email se busca por el comienzo de su valor normalizado."""
    normalizada = normalize_name(aguja)
    return bool(normalizada and normalize_name(docente.email).startswith(normalizada))


def _clave_de_coincidencia(
    docente: Docente, aguja: str, palabras: list[str]
) -> tuple[int, int, int] | None:
    """Clave de orden del docente, o `None` si no coincide con la consulta.

    La primera componente prioriza nombre sobre DNI y email; la segunda, la posición de la
    primera palabra que coincide dentro del nombre; la tercera es el desempate estable. Una sola
    letra solo puede coincidir con el nombre o el apellido: el spec pide que no arrastre filas
    por el comienzo de un email.
    """
    posicion = _posicion_en_nombre(docente, palabras)
    if posicion is not None:
        return (0, posicion, docente.id)
    if len(palabras) == 1 and len(palabras[0]) == 1 and palabras[0].isalpha():
        return None
    if _coincide_dni(docente, aguja):
        return (1, 0, docente.id)
    if len(palabras) == 1 and _coincide_email(docente, aguja):
        return (2, 0, docente.id)
    return None


def _asignar_comisiones(session: Session, docentes: list[Docente]) -> None:
    """Carga las comisiones de todos los docentes en una sola consulta."""
    identificadores = [docente.id for docente in docentes]
    por_docente: dict[int, list[SimpleNamespace]] = {}

    if identificadores:
        comisiones = session.scalars(
            select(Comision)
            .where(Comision.docente_id.in_(identificadores))
            .options(selectinload(Comision.curso))
            .order_by(Comision.id)
        )
        for comision in comisiones:
            por_docente.setdefault(comision.docente_id, []).append(
                SimpleNamespace(
                    id=comision.id,
                    codigo=comision.codigo,
                    nombre=comision.curso.nombre,
                )
            )

    for docente in docentes:
        asignadas = por_docente.get(docente.id, [])
        docente.comisiones = asignadas  # type: ignore[attr-defined]
        docente.cantidad_comisiones = len(asignadas)  # type: ignore[attr-defined]


def _traducir_duplicado(error: IntegrityError) -> None:
    """Convierte un `IntegrityError` del alta en el rechazo que nombra el campo que se repitió."""
    motivo = str(getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig)
    if INDICE_DNI in motivo:
        raise DocenteDuplicado("DNI") from error
    if INDICE_EMAIL in motivo:
        raise DocenteDuplicado("email") from error
    logger.warning("El alta de docente chocó con una restricción no prevista: %s", motivo)
