"""Contrato de entrada y salida del padrón de alumnos (historia #13).

**El alta acepta solo DNI.** No hay campo `tipo_documento` y los esquemas son `extra="forbid"`,
así que un `POST /alumnos` que lo informe se rechaza con 422: el servicio guarda
`tipo_documento = DNI` siempre. El pasaporte y el documento nulo siguen admitidos por el modelo
(D30), pero el alta con pasaporte queda diferida a la HU 47, que está en `Won't`.

El DNI se acepta con puntos, espacios o guiones y se guarda tal como lo escribió la secretaría;
la forma normalizada —solo dígitos— la calcula el servicio para el índice único (D-B del change
`hu-13-alta-alumno`).

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

import re
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import EmailConForma

#: Lo único que puede aparecer en un DNI además de sus dígitos: puntos, espacios y guiones.
_SOLO_DIGITOS_Y_SEPARADORES = re.compile(r"[0-9.\s-]+")
_SOLO_DIGITOS = re.compile(r"\D+")

#: Cantidad de dígitos de un DNI argentino.
_DIGITOS_DNI = (7, 8)


class AlumnoCreate(BaseModel):
    """Cuerpo de `POST /alumnos`.

    DNI, nombre y email son obligatorios; el teléfono es opcional y sin él queda en `None`.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    documento: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=160)
    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: str | None = Field(default=None, max_length=40)

    @field_validator("documento")
    @classmethod
    def _documento_es_dni(cls, valor: str) -> str:
        """Acepta un DNI de 7 u 8 dígitos, escrito con puntos, espacios o guiones o sin ellos.

        El rechazo de letras es explícito y no se deja a la base: un documento con letras
        terminaría en `documento_norm` nulo y el CHECK `documento_y_tipo_juntos` lo rechazaría
        con un error crudo, sin mensaje útil para el formulario.
        """
        if _SOLO_DIGITOS_Y_SEPARADORES.fullmatch(valor) is None:
            raise ValueError("El DNI debe tener 7 u 8 dígitos.")
        if len(_SOLO_DIGITOS.sub("", valor)) not in _DIGITOS_DNI:
            raise ValueError("El DNI debe tener 7 u 8 dígitos.")
        return valor


class ComisionAsignadaOut(BaseModel):
    """La comisión de la fila del padrón. Hoy siempre `None`: la inscripción es la HU 14."""

    codigo: str
    nombre: str


class AccesoAlumnoOut(BaseModel):
    """El acceso derivado de la fila. Hoy siempre `None`: la habilitación es posterior."""

    estado: str
    causa: str | None = None


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
