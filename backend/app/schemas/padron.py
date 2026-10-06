"""Contrato de entrada y salida del padrón de docentes (historia #9).

**El alta no tiene campo de CUIL, a propósito** (D33). No es que esté comentado: `DocenteCreate`
no lo declara y los esquemas son `extra="forbid"`, así que un `POST /docentes` que informe
`cuil` se rechaza con 422. La columna existe en la base para cuando haya docentes reales, pero
en esta fase no se pide: un CUIL inventado es peor que ningún CUIL.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR: es la
distribución de D19.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocenteCreate(BaseModel):
    """Cuerpo de `POST /docentes`.

    Nombre, apellido, DNI, email y teléfono opcional. El teléfono es el único opcional: el
    resto es lo que el criterio de la historia #9 llama a registrar.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=80)
    apellido: str = Field(min_length=1, max_length=80)
    dni: str = Field(min_length=1, max_length=20)
    email: str = Field(min_length=3, max_length=255)
    telefono: str | None = Field(default=None, max_length=40)

    @field_validator("email")
    @classmethod
    def _email_con_forma(cls, valor: str) -> str:
        """Formato mínimo de correo: algo, una arroba, algo.

        No se baja a la regla completa de RFC 5322 porque acepta direcciones que no existen y
        rechaza direcciones que sí. Lo que importa es que un correo mal escrito no llegue a
        ser el acceso de alguien, y `str_strip_whitespace` ya evita el espacio de más que
        rompe la comparación con `usuario.email`.
        """
        local, _, dominio = valor.partition("@")
        if not local or not dominio or "." not in dominio or dominio.endswith("."):
            raise ValueError("El email no tiene un formato válido.")
        return valor


class DocenteOut(BaseModel):
    """Fila de `GET /docentes` y respuesta de `POST /docentes`.

    `cuil` puede venir `None` (D33) y `cantidad_comisiones` es una derivación por consulta,
    consistente con D10: la pantalla ya la muestra y no vale la pena guardarla.
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
