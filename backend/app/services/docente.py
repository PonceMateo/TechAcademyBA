"""Reglas del autoservicio del docente: su perfil y sus datos de contacto (HU 90).

**El docente nunca se recibe por parámetro.** Todas las funciones parten de la cuenta autenticada y
resuelven su legajo con `docente_de`, así que ninguna consulta de este módulo puede devolver ni
modificar datos de otro docente (D60).

**El email se sincroniza con la cuenta en una sola transacción.** `docente.email` es el del padrón
y `usuario.email` el del login: escribir solo uno dejaría al docente entrando con un correo y la
secretaría viendo otro, o directamente sin poder entrar (D52 y D63).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.padron import Docente, Usuario
from app.schemas.docente import ComisionDocenteOut, PerfilDocenteOut, PerfilDocenteUpdate
from app.services.emails import EmailAlreadyRegistered, ensure_email_available


class SinDocenteAsociado(Exception):
    """La cuenta no tiene legajo de docente. El CHECK del modelo lo impide, pero se nombra."""


def docente_de(usuario: Usuario) -> Docente:
    """El legajo del docente que está usando el sistema, resuelto desde su cuenta."""
    docente = usuario.docente
    if docente is None:
        raise SinDocenteAsociado("La cuenta no tiene un legajo de docente asociado.")
    return docente


def obtener_perfil(session: Session, usuario: Usuario) -> PerfilDocenteOut:
    """Los datos del docente autenticado y sus comisiones asignadas."""
    return _perfil(session, docente_de(usuario))


def actualizar_perfil(
    session: Session, usuario: Usuario, datos: PerfilDocenteUpdate
) -> PerfilDocenteOut:
    """Actualiza el email y el teléfono del docente **y el email de su cuenta** (HU 90).

    La unicidad la resuelve `ensure_email_available` excluyendo la propia fila del docente y la
    propia cuenta —guardar el mismo email no puede chocar contra uno mismo— y la carrera entre dos
    cuentas que piden el mismo correo la traduce el `IntegrityError` al mismo conflicto.
    """
    docente = docente_de(usuario)
    ensure_email_available(
        session,
        datos.email,
        exclude_docente_id=docente.id,
        exclude_usuario_id=usuario.id,
    )

    docente.email = datos.email
    docente.telefono = datos.telefono
    usuario.email = datos.email

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        motivo = str(
            getattr(getattr(error.orig, "diag", None), "constraint_name", "") or error.orig
        )
        if "uq_docente_email" in motivo or "uq_usuario_email" in motivo:
            raise EmailAlreadyRegistered(datos.email, "docentes") from error
        raise

    return _perfil(session, docente)


def _perfil(session: Session, docente: Docente) -> PerfilDocenteOut:
    comisiones = session.scalars(
        select(Comision)
        .where(Comision.docente_id == docente.id)
        .options(selectinload(Comision.curso))
        .order_by(Comision.id)
    ).all()

    return PerfilDocenteOut(
        nombre=docente.nombre,
        apellido=docente.apellido,
        dni=docente.dni,
        cuil=docente.cuil,
        email=docente.email,
        telefono=docente.telefono,
        comisiones=[
            ComisionDocenteOut(
                codigo=comision.codigo,
                nombre_curso=comision.curso.nombre,
                horario=comision.dias_horarios,
                # El modelo no tiene estado de comisión (M2): la única columna es `activo`.
                estado="Activa" if comision.activo else "Inactiva",
            )
            for comision in comisiones
        ],
    )
