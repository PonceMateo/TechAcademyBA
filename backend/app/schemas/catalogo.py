"""Contrato de entrada y salida del catálogo: cursos, comisiones y sedes.

Historias #1, #2, #5 y #8.

**El alta de un curso no tiene campo de código, a propósito.** No es que esté commented out:
`CursoCreate` no lo declara y los esquemas son `extra="forbid"`, así que un `POST /cursos` que
informe `codigo` se rechaza con 422. El código lo genera la base (D32) y un cliente que lo
informe está usando un contrato viejo. Lo mismo con el CUIL del docente, en
`app/schemas/padron.py`.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Modalidad


class CursoCreate(BaseModel):
    """Cuerpo de `POST /cursos`: **solo** el nombre y una descripción opcional.

    `extra="forbid"` es lo que hace que la ausencia de `codigo` sea una garantía y no una
    omisión: un cliente que mande el código recibe 422 en vez de que el campo se ignore en
    silencio.
    """

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str | None = Field(default=None, max_length=2000)

    @field_validator("nombre")
    @classmethod
    def _nombre_no_vacio(cls, valor: str) -> str:
        """Rechaza el nombre de puros espacios.

        El CHECK `curso_nombre_obligatorio` también lo rechaza, pero llegar ahí devuelve un
        500 con el texto de PostgreSQL. Acá es un 422 con el nombre del campo, que es lo que
        la pantalla sabe mostrar.
        """
        if not valor.strip():
            raise ValueError("El nombre del curso es obligatorio.")
        return valor


class CursoOut(BaseModel):
    """Fila de `GET /cursos` y respuesta de `POST /cursos`.

    `codigo` viene de la columna generada por la base, así que la respuesta dice la verdad
    aunque nadie la haya escrito: es lo que la pantalla muestra después del alta.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    descripcion: str | None


class ComisionCreate(BaseModel):
    """Cuerpo de `POST /comisiones`.

    `docente_id` es obligatorio **aunque la columna admita nulo**: la columna admite nulo para
    poder asignarle el docente a una comisión abierta antes de que haya docente, pero el alta
    de una comisión nueva sí lo exige, porque es lo que pide el criterio de la historia #2.

    `numero` **no** está en el contrato: sale del máximo de los números de ese curso más uno
    (D34). `sede_id` es opcional y solo se acepta cuando la modalidad la exige; el CHECK
    `modalidad_presencial_requiere_sede` es el que sostiene esa regla en la base.
    """

    model_config = ConfigDict(extra="forbid")

    curso_id: int = Field(gt=0)
    docente_id: int = Field(gt=0)
    dias_horarios: str = Field(min_length=1, max_length=255)
    arancel: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    cupo_maximo: int = Field(gt=0)
    modalidad: Modalidad
    sede_id: int | None = Field(default=None, gt=0)

    @field_validator("dias_horarios")
    @classmethod
    def _dias_horarios_no_vacio(cls, valor: str) -> str:
        if not valor.strip():
            raise ValueError("Los días y horarios son obligatorios.")
        return valor


class ComisionOut(BaseModel):
    """Fila de `GET /comisiones` y respuesta de `POST /comisiones`.

    `codigo` es el **derivado** `{curso.codigo}-{numero}` (D34): no es una columna, lo arma
    la propiedad `Comision.codigo` del ORM a partir del curso y del número.

    `vacantes` sale de `cupo_maximo` menos las inscripciones activas. No es una columna
    persistida porque una se desincroniza apenas alguien inscribe (D10). Va en la respuesta
    porque la tabla de Administración ya muestra esa columna y dejarla en blanco sería una
    regresión visible; esto **no** implementa la historia #6, que además necesita el caso de
    extremo a extremo con una inscripción real.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    curso: CursoOut
    docente_id: int | None
    docente_nombre: str | None
    dias_horarios: str
    cupo_maximo: int
    arancel: Decimal
    modalidad: Modalidad
    sede_id: int | None
    sede_nombre: str | None
    vacantes: int


class SedeOut(BaseModel):
    """Fila de `GET /sedes`. No hay historia de alta de sede: es un endpoint de lectura."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
