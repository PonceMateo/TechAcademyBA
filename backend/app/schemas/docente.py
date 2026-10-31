"""Contrato del autoservicio del docente (HU 90).

**La edición tiene dos campos y nada más.** `PerfilDocenteUpdate` es `extra="forbid"` con `email` y
`telefono`: nombre, apellido, DNI y CUIL no están declarados, así que un cuerpo que los intente
mandar es un `422` y nunca llega al servicio. Las validaciones son las mismas de la HU 43, incluido
el teléfono vacío como "no informado".

`PerfilDocenteOut` describe lo que la pantalla puede mostrar: datos propios y comisiones. No
incluye el identificador del sistema ni la contraseña, que no se editan ni se exponen.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.validators import EmailConForma, TelefonoOpcional


class ComisionDocenteOut(BaseModel):
    """Comisión asignada al docente, con lo que muestra la tabla de su perfil."""

    codigo: str
    nombre_curso: str
    horario: str
    estado: str


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
