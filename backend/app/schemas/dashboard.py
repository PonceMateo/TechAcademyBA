"""Contrato del tablero de Administración (H/U 55).

**Una sola respuesta.** El tablero pide `GET /admin/dashboard` y recibe indicadores, serie,
ocupación, comprobantes recientes y agenda juntos: cinco lecturas separadas podrían devolver
números que no cierran entre sí y obligarían a la pantalla a calcular agregados, que el spec
prohíbe.

**Los valores nulos son información.** `cupo_promedio_ocupado` es `None` cuando no hay comisiones
vigentes; la pantalla muestra `—`. Una cantidad real es `0`, no `None`: el frontend tiene que poder
distinguir "no hay" de "todavía no sé".
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.comprobantes import ComprobantePendienteOut


class IndicadoresDashboardOut(BaseModel):
    """Los conteos que muestran las tarjetas y las alertas del tablero."""

    alumnos_inscriptos: int = 0
    inscripciones_activas: int = 0
    cupo_promedio_ocupado: Decimal | None = None
    comisiones: int = 0
    comisiones_vigentes: int = 0
    cobros_pendientes: int = 0
    comprobantes_pendientes: int = 0
    cobranzas_observadas: int = 0
    cobrado_mes_actual: Decimal = Decimal("0")


class CobroMesOut(BaseModel):
    """Un mes de la serie de cobros acreditados: `YYYY-MM` e importe."""

    mes: str
    importe: Decimal


class OcupacionComisionOut(BaseModel):
    """Ocupación de una comisión vigente, para el bloque del gráfico."""

    codigo: str
    nombre_curso: str
    inscriptos: int
    cupo: int
    porcentaje: Decimal


class EncuentroAgendaOut(BaseModel):
    """Una clase de la agenda del administrador, con su comisión y su docente."""

    fecha: date
    horario: str | None = None
    tema: str | None = None
    codigo: str
    nombre_curso: str
    docente_nombre: str | None = None


class DashboardAdminOut(BaseModel):
    """Respuesta completa del tablero de Administración."""

    indicadores: IndicadoresDashboardOut
    cobros_por_mes: list[CobroMesOut] = Field(default_factory=list)
    ocupacion_por_comision: list[OcupacionComisionOut] = Field(default_factory=list)
    comprobantes_recientes: list[ComprobantePendienteOut] = Field(default_factory=list)
    agenda: list[EncuentroAgendaOut] = Field(default_factory=list)
