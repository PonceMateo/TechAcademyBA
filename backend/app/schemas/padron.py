"""Contrato de entrada y salida del padrón de docentes (historias #9 y #11).

**El CUIL es opcional y forma parte del contrato** (D57, que amplía D33). `DocenteCreate` lo
declara después del DNI y lo valida contra ese DNI: 11 dígitos, prefijo `20`, `23`, `24` o `27` y
los 8 dígitos del medio iguales al DNI completado con ceros a la izquierda. **No se calcula ni se
valida el dígito verificador**, que se guarda como lo escribió la secretaría. Sin CUIL el docente
queda con `cuil` en `None`.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.validators import DniConForma, EmailConForma, TelefonoE164, validar_cuil


class DocenteCreate(BaseModel):
    """Cuerpo de `POST /docentes`.

    Nombre, apellido, DNI y email; teléfono y CUIL son opcionales. El CUIL se valida contra el DNI
    del mismo cuerpo porque el formulario y la API tienen que rechazar lo mismo.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=80)
    apellido: str = Field(min_length=1, max_length=80)
    # Las reglas de DNI, email y teléfono son las mismas del padrón de alumnos (D57).
    dni: DniConForma = Field(min_length=1, max_length=20)
    cuil: str | None = Field(default=None, max_length=20)
    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: TelefonoE164 | None = Field(default=None, max_length=40)

    @field_validator("cuil")
    @classmethod
    def _cuil_coherente_con_el_dni(cls, valor: str | None, info: ValidationInfo) -> str | None:
        """Valida el CUIL contra el DNI del mismo cuerpo y devuelve sus 11 dígitos.

        Se declara después del DNI a propósito: `info.data` solo trae los campos ya validados. Si
        el DNI no está, es porque ya tiene su propio error y repetirlo en el CUIL no agrega nada.
        """
        if valor is None:
            return None
        dni = info.data.get("dni")
        if dni is None:
            return valor
        return validar_cuil(valor, dni)


class DocenteUpdate(DocenteCreate):
    """Cuerpo de `PUT /docentes/{id}` (historia #11): los mismos datos del alta, con CUIL opcional.

    Hereda las validaciones del alta a propósito: editar no admite nada que el alta no admita. La
    diferencia está en el servicio: omitir `cuil` conserva el actual y un `null` explícito lo
    borra, porque el campo se hereda y el servicio mira `model_fields_set`. El `id`, sus comisiones
    y su historial se conservan porque el formulario no los envía.
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

    `cuil` viene en 11 dígitos o `None` (D57), `comisiones` sale de las relaciones reales de
    `comision` (historia #10) y `cantidad_comisiones` se conserva como derivación de esa misma
    lista.
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
