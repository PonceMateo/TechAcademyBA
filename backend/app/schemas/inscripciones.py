"""Contrato de entrada y salida de inscripciones (HU #14)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InscripcionCreate(BaseModel):
    """Cuerpo de `POST /inscripciones`.

    La categoría se elige al inscribir (HU 64): beca parcial pide el porcentaje y corporativo pide
    la empresa, con las mismas reglas que el `PATCH`. Los dos campos son opcionales en el esquema
    porque dependen de la categoría; la combinación la valida el servicio.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    alumno_id: int = Field(gt=0)
    comision_id: int = Field(gt=0)
    categoria: str = Field(default="PARTICULAR", min_length=1, max_length=20)
    porcentaje_beca: int | None = Field(default=None, ge=1, le=99)
    empresa_id: int | None = Field(default=None, gt=0)


class InscripcionOut(BaseModel):
    """Respuesta de `POST /inscripciones`."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    alumno_id: int
    comision_id: int
    categoria: str
    porcentaje_beca: Decimal | None = None
    empresa_id: int | None = None
    importe_arancel: Decimal | None = None
    estado: str


class InscripcionCategoriaUpdate(BaseModel):
    """Cuerpo de `PATCH /inscripciones/{id}` para asignar categoría (HU #15)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    categoria: str = Field(min_length=1, max_length=20)
    porcentaje_beca: int | None = Field(default=None, ge=1, le=99)
    empresa_id: int | None = Field(default=None, gt=0)


class InscripcionBaja(BaseModel):
    """Cuerpo de `POST /inscripciones/{id}/baja` (HU 60).

    La comisión viaja en el cuerpo para que el backend compruebe la relación: una baja pedida desde
    la pantalla de otra comisión no puede cambiar una fila que no le corresponde.
    """

    model_config = ConfigDict(extra="forbid")

    comision_id: int = Field(gt=0)


class AlumnoDeInscripcionOut(BaseModel):
    """El alumno tal como lo lista la gestión de la comisión: nombre y documento (HU 60)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    documento: str | None = None


class AccesoDeInscripcionOut(BaseModel):
    """Estado de habilitación derivado de la inscripción (D9)."""

    estado: str
    causa: str | None = None
    forzado: bool = False


class InscripcionDeComisionOut(BaseModel):
    """Una inscripción del listado de una comisión (HU 60).

    `acceso` es nulo cuando la inscripción no está `ACTIVA`: una baja no tiene bloqueo que derivar y
    la pantalla muestra su estado de inscripción en su lugar.
    """

    id: int
    alumno: AlumnoDeInscripcionOut
    categoria: str
    porcentaje_beca: Decimal | None = None
    empresa_id: int | None = None
    empresa_nombre: str | None = None
    estado: str
    acceso: AccesoDeInscripcionOut | None = None


class ComisionDeInscripcionesOut(BaseModel):
    """Encabezado y contadores de la comisión abierta (HU 60).

    `inscriptos_activos` y `vacantes` se derivan de las inscripciones `ACTIVA`, el mismo criterio
    del cupo (D10), así una baja libera el lugar en la misma respuesta.
    """

    id: int
    codigo: str
    nombre_curso: str
    cupo_maximo: int
    inscriptos_activos: int
    vacantes: int


class InscripcionesDeComisionOut(BaseModel):
    """Respuesta de `GET /inscripciones?comision_id=` (HU 60)."""

    comision: ComisionDeInscripcionesOut
    inscripciones: list[InscripcionDeComisionOut]


class ComisionDisponibleOut(BaseModel):
    """Comisión que la pantalla muestra al elegir a qué inscripción imputar (HU 21)."""

    codigo: str
    nombre: str


class InscripcionDisponibleOut(BaseModel):
    """Inscripción activa de un alumno para imputar una cobranza (HU 21 y HU 64).

    `categoria` viaja para que el selector de Cobranzas distinga dos inscripciones del mismo
    alumno sin adivinar por la comisión.
    """

    id: int
    estado: str
    categoria: str
    comision: ComisionDisponibleOut
