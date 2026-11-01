"""Link de clase por comisión (HU #33)."""

from __future__ import annotations

from datetime import date
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.clases import Clase
from app.models.enums import EstadoHabilitacion, EstadoInscripcion, Rol
from app.models.inscripciones import Inscripcion
from app.models.padron import Usuario
from app.services import habilitacion


class ComisionNoEncontrada(Exception):
    """La comisión no existe."""


class NoAutorizado(Exception):
    """El usuario no puede consultar o cargar el link de esa comisión."""


class UrlInvalida(Exception):
    """El valor informado no es una URL válida."""


def _validar_url(url: str) -> None:
    if not url or " " in url:
        raise UrlInvalida("El link de la clase tiene que ser una URL válida.")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise UrlInvalida("El link de la clase tiene que ser una URL válida.")


def _resolver_comision(session: Session, codigo: str) -> Comision:
    buscado = (codigo or "").strip().upper()
    comisiones = session.scalars(
        select(Comision).options(selectinload(Comision.curso))
    ).all()
    for comision in comisiones:
        if comision.codigo.strip().upper() == buscado:
            return comision
    raise ComisionNoEncontrada("La comisión no existe.")


def _autorizar(usuario: Usuario, comision: Comision) -> None:
    if usuario.rol == Rol.ADMIN.value:
        return
    if usuario.rol == Rol.DOCENTE.value and comision.docente_id == usuario.docente_id:
        return
    raise NoAutorizado("No podés cargar el link de una comisión ajena.")


def _autorizar_lectura(session: Session, usuario: Usuario, comision: Comision) -> None:
    if usuario.rol == Rol.ADMIN.value:
        return
    if usuario.rol == Rol.DOCENTE.value and comision.docente_id == usuario.docente_id:
        return
    if usuario.rol != Rol.ALUMNO.value or usuario.alumno_id is None:
        raise NoAutorizado("No podés consultar el link de una comisión ajena.")

    inscripcion = session.scalar(
        select(Inscripcion).where(
            Inscripcion.alumno_id == usuario.alumno_id,
            Inscripcion.comision_id == comision.id,
            Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
        )
    )
    if (
        inscripcion is None
        or habilitacion.derivar_estado(session, inscripcion)[0]
        != EstadoHabilitacion.HABILITADO.value
    ):
        raise NoAutorizado("No podés consultar el link de una comisión ajena.")


def obtener_link(session: Session, codigo: str, usuario: Usuario) -> str | None:
    comision = _resolver_comision(session, codigo)
    _autorizar_lectura(session, usuario, comision)
    clase = session.scalar(
        select(Clase)
        .where(Clase.comision_id == comision.id)
        .order_by(Clase.fecha.desc())
    )
    return clase.link_virtual if clase is not None else None


def guardar_link(session: Session, codigo: str, url: str, usuario: Usuario) -> str:
    _validar_url(url)
    comision = _resolver_comision(session, codigo)
    _autorizar(usuario, comision)

    hoy = date.today()
    clase = session.scalar(
        select(Clase).where(Clase.comision_id == comision.id, Clase.fecha == hoy)
    )
    if clase is None:
        clase = Clase(comision_id=comision.id, fecha=hoy, link_virtual=url)
        session.add(clase)
    else:
        clase.link_virtual = url

    session.commit()
    session.refresh(clase)
    return url
