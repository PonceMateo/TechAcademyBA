"""Contrato de entrada y salida del padrón de alumnos (historias #13 y #16).

**El alta acepta solo DNI.** No hay campo `tipo_documento` y los esquemas son `extra="forbid"`,
así que un `POST /alumnos` que lo informe se rechaza con 422: el servicio guarda
`tipo_documento = DNI` siempre. El pasaporte y el documento nulo siguen admitidos por el modelo
(D30), pero el alta con pasaporte queda diferida a la HU 47, que está en `Won't`.

El DNI se acepta con puntos, espacios o guiones y se guarda tal como lo escribió la secretaría;
la forma normalizada —solo dígitos— la calcula el servicio para el índice único (D-B del change
`hu-13-alta-alumno`). La regla del DNI y la del teléfono son compartidas con el padrón de docentes
(D57), y el teléfono se guarda en E.164 o nulo.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import MAX_PASSWORD_BYTES
from app.schemas.validators import DniConForma, EmailConForma, TelefonoE164


class AlumnoCreate(BaseModel):
    """Cuerpo de `POST /alumnos`.

    DNI, nombre y email son obligatorios; el teléfono es opcional y sin él queda en `None`.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # La regla del DNI es la misma del docente: `app.schemas.validators.DniConForma` (D57).
    documento: DniConForma = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=160)
    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: TelefonoE164 | None = Field(default=None, max_length=40)


class AlumnoUpdate(AlumnoCreate):
    """Cuerpo de `PUT /alumnos/{id}` (historia #17).

    Repite el contrato del alta a propósito: el modal edita el formulario completo y así ningún
    campo puede quedar afuera. Las validaciones de DNI y email son las mismas del alta.
    """


class RestablecerPasswordRequest(BaseModel):
    """Cuerpo de `POST /alumnos/{id}/password` (historia #17).

    El administrador define la nueva contraseña; se guarda solo su hash y la cuenta queda con
    cambio obligatorio en el siguiente ingreso. La contraseña no se devuelve en claro.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)


class ComisionAsignadaOut(BaseModel):
    """La comisión de la fila del padrón. `None` mientras el alumno no tenga inscripción."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str


class AccesoAlumnoOut(BaseModel):
    """El estado de habilitación derivado (HU #27)."""

    model_config = ConfigDict(from_attributes=True)

    estado: str
    causa: str | None = None
    forzado: bool = False


class AlumnoOut(BaseModel):
    """Fila de `GET /alumnos` y respuesta de `POST /alumnos`.

    `comision`, `categoria`, `porcentaje_beca` y `acceso` salen en `null` mientras el alumno no
    tenga inscripción: pertenecen a historias posteriores y no se inventan datos para llenar la
    tabla (D43). La pantalla los muestra como `Sin comisión` y `—`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    documento: str | None
    tipo_documento: str | None
    email: str
    telefono: str | None
    activo: bool
    inscripcion_id: int | None = None
    comision: ComisionAsignadaOut | None = None
    categoria: str | None = None
    porcentaje_beca: Decimal | None = None
    acceso: AccesoAlumnoOut | None = None


class AlumnoCreadoOut(AlumnoOut):
    """Respuesta de `POST /alumnos`: la fila del padrón más la contraseña inicial (D45).

    `password_inicial` viaja **solo en el alta**, y en claro una única vez, para que el
    administrador se la entregue al alumno. No se envía por correo y la base guarda solo el hash.
    `GET /alumnos` usa `AlumnoOut` y no la expone.
    """

    password_inicial: str
