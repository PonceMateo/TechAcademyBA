"""Carga transaccional de empleados corporativos (HU #19)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import hashear_password
from app.models.catalogo import Comision
from app.models.enums import CategoriaInscripcion, EstadoContrato, EstadoInscripcion, Rol, TipoContrato, TipoDocumento
from app.models.inscripciones import ContratoCorporativo, Empresa, Inscripcion, NominaEmpleado
from app.models.padron import Alumno, Usuario
from app.schemas.nomina import NominaCreate
from app.services.emails import ensure_email_available
from app.services.normalization import generar_password_inicial, normalize_document


class EmpresaNoEncontrada(Exception):
    pass


class ComisionNoEncontrada(Exception):
    pass


class NominaInvalida(Exception):
    pass


class CupoInsuficiente(Exception):
    pass


def cargar_nomina(session: Session, empresa_id: int, datos: NominaCreate):
    empresa = session.get(Empresa, empresa_id)
    if empresa is None or not empresa.activo:
        raise EmpresaNoEncontrada("La empresa no existe.")

    documentos = [normalize_document(empleado.documento) for empleado in datos.empleados]
    if len(set(documentos)) != len(documentos):
        raise NominaInvalida("La nómina contiene documentos repetidos.")

    comision = session.scalar(
        select(Comision)
        .where(Comision.id == datos.comision_id, Comision.activo.is_(True))
        .options(selectinload(Comision.curso))
        .with_for_update()
    )
    if comision is None:
        raise ComisionNoEncontrada("La comisión no existe.")

    inscriptas = len(
        session.scalars(
            select(Inscripcion.id)
            .where(
                Inscripcion.comision_id == comision.id,
                Inscripcion.estado == EstadoInscripcion.ACTIVA.value,
            )
            .with_for_update()
        ).all()
    )
    if inscriptas + len(datos.empleados) > comision.cupo_maximo:
        disponibles = max(comision.cupo_maximo - inscriptas, 0)
        raise CupoInsuficiente(
            f"La nómina supera las vacantes disponibles: quedan {disponibles}."
        )

    contrato = session.scalar(
        select(ContratoCorporativo)
        .where(
            ContratoCorporativo.empresa_id == empresa.id,
            ContratoCorporativo.comision_id == comision.id,
            ContratoCorporativo.tipo == TipoContrato.CURSO_FORMAL.value,
            ContratoCorporativo.estado == EstadoContrato.ACTIVO.value,
        )
    )
    if contrato is None:
        contrato = ContratoCorporativo(
            empresa_id=empresa.id,
            comision_id=comision.id,
            tipo=TipoContrato.CURSO_FORMAL.value,
            estado=EstadoContrato.ACTIVO.value,
            monto=0,
        )
        session.add(contrato)
        session.flush()

    creados = 0
    reutilizados = 0
    try:
        for empleado, documento_norm in zip(datos.empleados, documentos, strict=True):
            alumno = session.scalar(
                select(Alumno).where(Alumno.documento_norm == documento_norm).with_for_update()
            )
            if alumno is None:
                ensure_email_available(session, empleado.email)
                alumno = Alumno(
                    nombre=empleado.nombre,
                    documento=empleado.documento,
                    documento_norm=documento_norm,
                    tipo_documento=TipoDocumento.DNI.value,
                    email=empleado.email,
                    telefono=empleado.telefono,
                )
                session.add(alumno)
                session.flush()
                session.add(
                    Usuario(
                        email=empleado.email,
                        nombre=empleado.nombre,
                        password_hash=hashear_password(
                            generar_password_inicial(empleado.nombre, empleado.documento)
                        ),
                        rol=Rol.ALUMNO.value,
                        must_change_password=True,
                        is_active=True,
                        alumno_id=alumno.id,
                    )
                )
                creados += 1
            else:
                reutilizados += 1

            existente = session.scalar(
                select(Inscripcion).where(
                    Inscripcion.alumno_id == alumno.id,
                    Inscripcion.comision_id == comision.id,
                )
            )
            if existente is not None:
                raise NominaInvalida(
                    f"El empleado con documento {empleado.documento} ya está inscripto en la comisión."
                )

            session.add(
                Inscripcion(
                    alumno_id=alumno.id,
                    comision_id=comision.id,
                    categoria=CategoriaInscripcion.CORPORATIVO.value,
                    porcentaje_beca=None,
                    empresa_id=empresa.id,
                    estado=EstadoInscripcion.ACTIVA.value,
                )
            )
            session.add(
                NominaEmpleado(
                    contrato_id=contrato.id,
                    tipo_contrato=TipoContrato.CURSO_FORMAL.value,
                    alumno_id=alumno.id,
                )
            )

        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise NominaInvalida("La nómina no pudo guardarse porque contiene datos repetidos.") from error
    except Exception:
        session.rollback()
        raise

    return {
        "contrato_id": contrato.id,
        "empresa_id": empresa.id,
        "comision_id": comision.id,
        "cantidad": len(datos.empleados),
        "alumnos_creados": creados,
        "alumnos_reutilizados": reutilizados,
        "inscripciones_creadas": len(datos.empleados),
    }
