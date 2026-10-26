"""Reglas de negocio del padrón de docentes (historias #9 y #11).

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

from app.core.security import CONTRASEÑA_DEMO, MAX_PASSWORD_BYTES, hashear_password
from app.models.catalogo import Comision
from app.models.enums import Rol
from app.models.padron import Docente, Usuario
from app.schemas.padron import DocenteCreate, DocenteUpdate
from app.services.auth import PASSWORD_MIN_LENGTH, PasswordInvalida
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

#: La cuenta tiene su propio índice de email (D5). En la edición es el que corta la carrera entre
#: dos personas que guardan el mismo correo al mismo tiempo, y se traduce al mismo rechazo.
INDICE_USUARIO_EMAIL = "uq_usuario_email"


class DocenteNoEncontrado(Exception):
    """El `id` pedido no corresponde a ningún docente."""

    def __init__(self) -> None:
        super().__init__("El docente no existe.")


class DocenteSinCuenta(Exception):
    """El docente no tiene una cuenta de acceso y no se puede restablecer su contraseña."""

    def __init__(self) -> None:
        super().__init__("El docente no tiene una cuenta de acceso.")


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
        # Ya viene con 11 dígitos o `None`: el esquema validó que coincida con el DNI (D57).
        cuil=datos.cuil,
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


def obtener_docente(session: Session, docente_id: int) -> Docente:
    """El docente por identificador, o `DocenteNoEncontrado` para que la ruta responda 404."""
    docente = session.get(Docente, docente_id)
    if docente is None:
        raise DocenteNoEncontrado
    return docente


def editar_docente(session: Session, docente: Docente, datos: DocenteUpdate) -> Docente:
    """Actualiza los datos personales y sincroniza la cuenta, en una sola transacción (HU #11).

    El `id` no cambia, así que las comisiones asignadas y su historial siguen apuntando al mismo
    docente. El DNI se compara solo contra el padrón de docentes —excluyendo al propio— y el email
    contra los tres padrones con `ensure_email_available`, excluyendo también la cuenta propia:
    guardar los mismos datos no choca contra sí mismo.

    Un docente sin `Usuario` se edita igual: la sincronización se saltea y **no** se crea una
    cuenta implícita. El alta garantiza que todo docente nuevo tenga una, así que el caso es solo
    de datos históricos.

    El CUIL se actualiza solo cuando viene en el cuerpo (D57): el formulario lo manda siempre y un
    cliente que no lo manda no lo pierde.
    """
    dni_norm = normalize_document(datos.dni)
    existente = session.scalar(
        select(Docente.id).where(Docente.dni_norm == dni_norm, Docente.id != docente.id)
    )
    if existente is not None:
        raise DocenteDuplicado("DNI")

    usuario = _usuario_del_docente(session, docente)
    ensure_email_available(
        session,
        datos.email,
        exclude_docente_id=docente.id,
        exclude_usuario_id=usuario.id if usuario is not None else None,
    )

    docente.nombre = datos.nombre
    docente.apellido = datos.apellido
    docente.dni = datos.dni
    docente.dni_norm = dni_norm
    docente.email = datos.email
    docente.telefono = datos.telefono
    # El CUIL solo se toca si vino en el cuerpo: omitirlo conserva el actual y un `null` explícito
    # lo borra. `DocenteUpdate` hereda el campo del alta, así que `model_fields_set` es lo único
    # que distingue "no vino" de "vino en null" (D57).
    if "cuil" in datos.model_fields_set:
        docente.cuil = datos.cuil

    if usuario is not None:
        usuario.nombre = f"{datos.nombre} {datos.apellido}"
        usuario.email = datos.email

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        _traducir_duplicado(error)
        raise

    # La respuesta del contrato incluye las comisiones asignadas, que la edición no vuelve a
    # calcular: se leen después de confirmar para no mostrar una lista vieja.
    _asignar_comisiones(session, [docente])
    return docente


def restablecer_password(session: Session, docente: Docente, nueva: str) -> Docente:
    """Reemplaza la contraseña del docente y exige su cambio en el próximo ingreso (HU #11).

    La contraseña anterior deja de servir porque el hash se reemplaza. La cuenta queda con
    `must_change_password = true`, el mismo mecanismo que el alta de alumno (D45), así que el
    docente la cambia al entrar y la contraseña que definió Administración no queda vigente.

    **No se toca `is_active`:** una cuenta dada de baja sigue de baja (D52). Si el docente no tiene
    cuenta, la ruta responde 409 en vez de crear una implícitamente.
    """
    usuario = _usuario_del_docente(session, docente)
    if usuario is None:
        raise DocenteSinCuenta

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

    _asignar_comisiones(session, [docente])
    return docente


def _usuario_del_docente(session: Session, docente: Docente) -> Usuario | None:
    """La cuenta de acceso vinculada al docente, si existe."""
    return session.scalar(select(Usuario).where(Usuario.docente_id == docente.id))


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
    if INDICE_EMAIL in motivo or INDICE_USUARIO_EMAIL in motivo:
        raise DocenteDuplicado("email") from error
    logger.warning("El alta de docente chocó con una restricción no prevista: %s", motivo)
