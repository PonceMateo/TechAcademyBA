"""Link de clase por comisión (HU #33)."""

from __future__ import annotations

from datetime import date
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalogo import Comision
from app.models.clases import Clase
from app.models.enums import Rol
from app.models.padron import Usuario


class ComisionNoEncontrada(Exception):
    """La comisión no existe."""


class NoAutorizado(Exception):
    """El usuario no puede cargar el link de esa comisión."""


class UrlInvalida(Exception):
    """El valor informado no es una URL válida."""


def _validar_url(url: str) -> None:
    if not url or " " in url:
        raise UrlInvalida("El link de la clase tiene que ser una URL válida.")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise UrlInvalida("El link de la clase tiene que ser una URL válida.")


def _resolver_comision(session: Session, codigo: str) -> Comision:
    comision = session.scalar(select(Comision).where(Comision.codigo == codigo))
    if comision is None:
        raise ComisionNoEncontrada("La comisión no existe.")
    return comision


def _autorizar(usuario: Usuario, comision: Comision) -> None:
    if usuario.rol == Rol.ADMIN.value:
        return
    if usuario.rol == Rol.DOCENTE.value and comision.docente_id == usuario.docente_id:
        return
    raise NoAutorizado("No podés cargar el link de una comisión ajena.")


def obtener_link(session: Session, codigo: str) -> str | None:
    comision = _resolver_comision(session, codigo)
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
