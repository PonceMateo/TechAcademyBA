"""Contrato de entrada y salida del padrón de docentes (historia #9).

**El alta no tiene campo de CUIL, a propósito** (D33). No es que esté comentado: `DocenteCreate`
no lo declara y los esquemas son `extra="forbid"`, así que un `POST /docentes` que informe
`cuil` se rechaza con 422. La columna existe en la base para cuando haya docentes reales, pero
en esta fase no se pide: un CUIL inventado es peor que ningún CUIL.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.validators import EmailConForma


class DocenteCreate(BaseModel):
    """Cuerpo de `POST /docentes`.

    Nombre, apellido, DNI, email y teléfono opcional. El teléfono es el único opcional: el
    resto es lo que el criterio de la historia #9 llama a registrar.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=80)
    apellido: str = Field(min_length=1, max_length=80)
    dni: str = Field(min_length=1, max_length=20)
    # La forma del email la valida `app.schemas.validators`, la misma que usa el alta de alumno.
    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: str | None = Field(default=None, max_length=40)


class DocenteUpdate(DocenteCreate):
    """Cuerpo de `PUT /docentes/{id}` (historia #11): los mismos datos del alta, sin CUIL.

    Hereda las validaciones del alta a propósito: editar no admite nada que el alta no admita, y
    un `cuil` en el cuerpo sigue siendo un 422 (D33 y D52). El `id`, sus comisiones y su historial
    se conservan porque el formulario no los envía.
    """


class RestablecerPasswordRequest(BaseModel):
    """Cuerpo de `POST /docentes/{id}/password` (historia #11).

    La contraseña la define Administración y el docente la cambia en su próximo ingreso. Se guarda
    solo su hash y no se devuelve en claro. La regla de longitud es la misma del cambio de
    contraseña y del restablecimiento de alumnos.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)


class ComisionDeDocenteOut(BaseModel):
    """Comisión asignada a un docente, tal como la muestra el padrón (historia #10).

    `codigo` es el derivado `{curso.codigo}-{numero}` (D34) y `nombre` es el nombre del curso. No
    se devuelve el `curso_id` ni la comisión completa: la pantalla solo necesita identificar la
    comisión y decir qué se dicta.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str


class DocenteOut(BaseModel):
    """Fila de `GET /docentes` y respuesta de `POST /docentes`.

    `cuil` puede venir `None` (D33), `comisiones` sale de las relaciones reales de `comision`
    (historia #10) y `cantidad_comisiones` se conserva como derivación de esa misma lista.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    cuil: str | None
    email: str
    telefono: str | None
    activo: bool
    cantidad_comisiones: int
    comisiones: list[ComisionDeDocenteOut] = Field(default_factory=list)
