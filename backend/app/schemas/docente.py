"""Contrato del autoservicio del docente (HU 90).

**La edición tiene dos campos y nada más.** `PerfilDocenteUpdate` es `extra="forbid"` con `email` y
`telefono`: nombre, apellido, DNI y CUIL no están declarados, así que un cuerpo que los intente
mandar es un `422` y nunca llega al servicio. Las validaciones son las mismas de la HU 43, incluido
el teléfono vacío como "no informado".

`PerfilDocenteOut` describe lo que la pantalla puede mostrar: datos propios y comisiones. No
incluye el identificador del sistema ni la contraseña, que no se editan ni se exponen.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.alumno import EncuentroOut
from app.schemas.alumnos import AccesoAlumnoOut, ComisionAsignadaOut
from app.schemas.validators import EmailConForma, TelefonoOpcional


class ComisionDocenteOut(BaseModel):
    """Comisión asignada al docente, con lo que muestra la tabla de su perfil."""

    codigo: str
    nombre_curso: str
    horario: str
    estado: str


class ComisionAsignadaDocenteOut(BaseModel):
    """Comisión que el docente puede operar desde su espacio."""

    codigo: str
    nombre_curso: str
    docente_nombre: str
    horario: str
    # H/U 70: mismo estado derivado que ve Administración, sin columna (D75).
    estado: str
    proxima_clase: str | None = None
    #: Clases de los próximos días, para la agenda del tablero (H/U 56).
    proximos_encuentros: list[EncuentroOut] = Field(default_factory=list)
    habilitados: int = 0
    bloqueados: int = 0


class AlumnoPadronDocenteOut(BaseModel):
    """Fila del padrón de la comisión, con el acceso derivado (10.3).

    `AlumnoOut` no sirve para esto: describe solo los datos del alumno y no declara `acceso`, así
    que serializar el padrón con ese esquema borraba el estado de habilitación y la pantalla del
    docente rompía al filtrar los habilitados.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    documento: str | None = None
    tipo_documento: str | None = None
    email: str
    telefono: str | None = None
    activo: bool
    inscripcion_id: int
    comision: ComisionAsignadaOut
    categoria: str
    porcentaje_beca: Decimal | None = None
    acceso: AccesoAlumnoOut


class PadronComisionDocenteOut(BaseModel):
    """Padrón de una comisión que el docente tiene asignada."""

    codigo: str
    nombre_curso: str
    horario: str
    alumnos: list[AlumnoPadronDocenteOut] = Field(default_factory=list)


class PerfilDocenteOut(BaseModel):
    """Perfil del docente autenticado: identidad de solo lectura, contacto y comisiones."""

    nombre: str
    apellido: str
    dni: str
    cuil: str | None = None
    email: str
    telefono: str | None = None
    comisiones: list[ComisionDocenteOut] = Field(default_factory=list)


class PerfilDocenteUpdate(BaseModel):
    """Cuerpo de `PUT /docente/mi-perfil`: email y teléfono, los dos únicos datos editables."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: TelefonoOpcional
