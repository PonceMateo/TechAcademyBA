"""Modelos de dominio (SQLAlchemy 2.x).

Este módulo importa todos los modelos para que `Base.metadata` esté completo. Alembic
lo usa como fuente del autogenerate, así que un modelo que no se importe acá tampoco
aparece en el esquema.
"""

from app.models.base import Base, TimestampMixin
from app.models.catalogo import MONEY, Comision, Curso, Sede
from app.models.clases import Asistencia, AuditLog, Clase, OverrideHabilitacion
from app.models.cobranza import Cobranza, Factura, Imputacion, Pagador
from app.models.enums import (
    CategoriaInscripcion,
    EstadoAsistencia,
    EstadoCobranza,
    EstadoContrato,
    EstadoHabilitacion,
    EstadoInscripcion,
    MedioPago,
    Modalidad,
    OrigenCobranza,
    Rol,
    TipoContrato,
    TipoDocumento,
    TipoFactura,
)
from app.models.inscripciones import (
    ContratoCorporativo,
    Empresa,
    Inscripcion,
    NominaEmpleado,
)
from app.models.padron import Alumno, Docente, Usuario

__all__ = [
    "MONEY",
    "Alumno",
    "Asistencia",
    "AuditLog",
    "Base",
    "CategoriaInscripcion",
    "Clase",
    "Cobranza",
    "Comision",
    "ContratoCorporativo",
    "Curso",
    "Docente",
    "Empresa",
    "EstadoAsistencia",
    "EstadoCobranza",
    "EstadoContrato",
    "EstadoHabilitacion",
    "EstadoInscripcion",
    "Factura",
    "Imputacion",
    "Inscripcion",
    "MedioPago",
    "Modalidad",
    "NominaEmpleado",
    "OrigenCobranza",
    "OverrideHabilitacion",
    "Pagador",
    "Rol",
    "Sede",
    "TimestampMixin",
    "TipoContrato",
    "TipoDocumento",
    "TipoFactura",
    "Usuario",
]
