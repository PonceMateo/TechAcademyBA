"""Reglas del autoservicio del docente: su perfil y sus datos de contacto (HU 90).

**El docente nunca se recibe por parámetro.** Todas las funciones parten de la cuenta autenticada y
resuelven su legajo con `docente_de`, así que ninguna consulta de este módulo puede devolver ni
modificar datos de otro docente (D60).

**El email se sincroniza con la cuenta en una sola transacción.** `docente.email` es el del padrón
y `usuario.email` el del login: escribir solo uno dejaría al docente entrando con un correo y la
secretaría viendo otro, o directamente sin poder entrar (D52 y D63).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalogo import Comision
from app.models.enums import DiaSemana, EstadoHabilitacion, EstadoInscripcion
from app.models.inscripciones import Inscripcion
from app.models.padron import Docente, Usuario
from app.schemas.alumnos import AlumnoOut
from app.schemas.docente import (
    ComisionAsignadaDocenteOut,
    ComisionDocenteOut,
    PadronComisionDocenteOut,
    PerfilDocenteOut,
    PerfilDocenteUpdate,
)
from app.services import habilitacion
from app.services.emails import EmailAlreadyRegistered, ensure_email_available


class SinDocenteAsociado(Exception):
    """La cuenta no tiene legajo de docente. El CHECK del modelo lo impide, pero se nombra."""


class ComisionNoEncontrada(Exception):
    """La comisión no existe o no pertenece al docente autenticado."""


DIA_DE_LA_SEMANA = {
    DiaSemana.LUN: 0,
    DiaSemana.MAR: 1,
    DiaSemana.MIE: 2,
    DiaSemana.JUE: 3,
    DiaSemana.VIE: 4,
    DiaSemana.SAB: 5,
    DiaSemana.DOM: 6,
}


def _proxima_clase(comision: Comision, hoy: date | None = None) -> str | None:
    """Devuelve la próxima fecha y hora de la grilla de la comisión."""
    hoy = hoy or date.today()
    inicio = max(hoy, comision.fecha_inicio) if comision.fecha_inicio else hoy
    if comision.fecha_fin is not None and inicio > comision.fecha_fin:
        return None

    candidatos = []
    for horario in comision.horarios:
        dias_hasta = (DIA_DE_LA_SEMANA[DiaSemana(horario.dia)] - inicio.weekday()) % 7
        fecha = inicio + timedelta(days=dias_hasta)
        if comision.fecha_fin is None or fecha <= comision.fecha_fin:
            candidatos.append((fecha, horario.inicio))

    if not candidatos:
        return None

    fecha, hora = min(candidatos)
    momento = datetime.combine(fecha, hora)
    if fecha == hoy:
        etiqueta_fecha = "Hoy"
    elif fecha == hoy + timedelta(days=1):
        etiqueta_fecha = "Mañana"
    else:
        etiqueta_fecha = fecha.strftime("%d/%m/%Y")
    return f"{etiqueta_fecha} · {momento:%H:%M}"


def docente_de(usuario: Usuario) -> Docente:
    """El legajo del docente que está usando el sistema, resuelto desde su cuenta."""
    docente = usuario.docente
    if docente is None:
        raise SinDocenteAsociado("La cuenta no tiene un legajo de docente asociado.")
    return docente


def obtener_perfil(session: Session, usuario: Usuario) -> PerfilDocenteOut:
    """Los datos del docente autenticado y sus comisiones asignadas."""
    return _perfil(session, docente_de(usuario))


def listar_comisiones_asignadas(
    session: Session, usuario: Usuario
) -> list[ComisionAsignadaDocenteOut]:
    """Comisiones activas del docente autenticado y sus contadores de acceso."""
    docente = docente_de(usuario)
    comisiones = session.scalars(
        select(Comision)
        .where(Comision.docente_id == docente.id, Comision.activo.is_(True))
        .options(selectinload(Comision.curso), selectinload(Comision.horarios))
        .order_by(Comision.id)
    ).all()

    resultado = []
    for comision in comisiones:
        inscripciones = session.scalars(
            select(Inscripcion).where(
                Inscripcion.comision_id == comision.id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
            )
        ).all()
        habilitados = sum(
            habilitacion.derivar_estado(session, inscripcion)[0]
            == EstadoHabilitacion.HABILITADO.value
            for inscripcion in inscripciones
        )
        resultado.append(
            ComisionAsignadaDocenteOut(
                codigo=comision.codigo,
                nombre_curso=comision.curso.nombre,
                docente_nombre=f"{docente.nombre} {docente.apellido}",
                horario=comision.resumen_horarios,
                proxima_clase=_proxima_clase(comision),
                habilitados=habilitados,
                bloqueados=len(inscripciones) - habilitados,
            )
        )
    return resultado


def obtener_padron_comision(
    session: Session, usuario: Usuario, codigo: str
) -> PadronComisionDocenteOut:
    docente = docente_de(usuario)
    comisiones = session.scalars(
        select(Comision)
        .where(Comision.docente_id == docente.id, Comision.activo.is_(True))
        .options(selectinload(Comision.curso), selectinload(Comision.horarios))
    ).all()
    buscado = (codigo or "").strip().upper()
    comision = next(
        (candidata for candidata in comisiones if candidata.codigo.upper() == buscado),
        None,
    )
    if comision is None:
        raise ComisionNoEncontrada(
            "No encontré esa comisión entre las comisiones asignadas."
        )

    inscripciones = session.scalars(
        select(Inscripcion)
        .where(
            Inscripcion.comision_id == comision.id,
            Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
        )
        .options(selectinload(Inscripcion.alumno))
        .order_by(Inscripcion.id)
    ).all()
    alumnos = []
    for inscripcion in inscripciones:
        estado, causa, forzado = habilitacion.derivar_estado(session, inscripcion)
        alumnos.append(
            AlumnoOut(
                id=inscripcion.alumno.id,
                nombre=inscripcion.alumno.nombre,
                documento=inscripcion.alumno.documento,
                tipo_documento=inscripcion.alumno.tipo_documento,
                email=inscripcion.alumno.email,
                telefono=inscripcion.alumno.telefono,
                activo=inscripcion.alumno.activo,
                inscripcion_id=inscripcion.id,
                comision={"codigo": comision.codigo, "nombre": comision.curso.nombre},
                categoria=inscripcion.categoria,
                porcentaje_beca=inscripcion.porcentaje_beca,
                acceso={"estado": estado, "causa": causa, "forzado": forzado},
            )
        )
    return PadronComisionDocenteOut(
        codigo=comision.codigo,
        nombre_curso=comision.curso.nombre,
        horario=comision.resumen_horarios,
        alumnos=alumnos,
    )


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
