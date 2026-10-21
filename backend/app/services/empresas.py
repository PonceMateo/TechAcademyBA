"""Reglas de negocio de empresas (historia #18).

Vive en `services` y no en el router por D1, y confirma la transacción por la misma razón
que `app/services/catalogo.py`: `get_db` cierra la sesión sin confirmar.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.inscripciones import Empresa
from app.schemas.empresas import EmpresaCreate
from app.services.normalization import normalize_document


class EmpresaDuplicada(Exception):
    """El CUIT ya está registrado.

    Lleva la empresa existente porque el criterio de la historia #18 pide **mostrar** la
    empresa con la que colisionó: un "CUIT ya registrado" no alcanza para saber a qué
    empresa volver.
    """

    def __init__(self, existente: Empresa) -> None:
        self.existente = existente
        super().__init__(
            f"Ya hay una empresa registrada con ese CUIT: "
            f"{existente.razon_social} (CUIT {existente.cuit})."
        )


def listar_empresas(session: Session) -> list[Empresa]:
    return list(session.scalars(select(Empresa).order_by(Empresa.id)))


def crear_empresa(session: Session, datos: EmpresaCreate) -> Empresa:
    """Crea la empresa. El duplicado se decide por `cuit_norm` (D6), para que un CUIT
    escrito con guiones colisione con el mismo sin guiones.
    """
    cuit_norm = normalize_document(datos.cuit)

    existente = session.scalar(select(Empresa).where(Empresa.cuit_norm == cuit_norm))
    if existente is not None:
        raise EmpresaDuplicada(existente)

    empresa = Empresa(
        razon_social=datos.razon_social,
        cuit=datos.cuit,
        cuit_norm=cuit_norm,
        requiere_factura_a=datos.requiere_factura_a,
    )
    session.add(empresa)
    try:
        session.flush()
    except IntegrityError as error:
        # La carrera entre dos altas simultáneas del mismo CUIT: el chequeo previo no alcanza,
        # y el mensaje tiene que ser el mismo que da el camino normal.
        session.rollback()
        chocada = session.scalar(select(Empresa).where(Empresa.cuit_norm == cuit_norm))
        if chocada is None:
            raise
        raise EmpresaDuplicada(chocada) from error

    session.commit()
    return empresa
