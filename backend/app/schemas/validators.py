"""Validaciones compartidas entre los contratos del padrón.

**La regla de email es una sola para docentes y alumnos** (D-C del change `hu-13-alta-alumno`).
Dos copias de una regla que el spec exige igual tienden a divergir, y el costo de compartirla es
este módulo de una función. Se expone como tipo anotado de Pydantic para que cada esquema la
declare en el campo `email` sin repetir el validador.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator


def validar_email(valor: str) -> str:
    """Formato mínimo de correo: algo, una arroba, un dominio con punto que no termina en punto.

    No se baja a la regla completa de RFC 5322 porque acepta direcciones que no existen y rechaza
    direcciones que sí. Lo que importa es que un correo mal escrito no llegue a ser el acceso de
    alguien, y `str_strip_whitespace` de los esquemas ya evita el espacio de más que rompe la
    comparación con `usuario.email`.
    """
    local, _, dominio = valor.partition("@")
    if not local or not dominio or "." not in dominio or dominio.endswith("."):
        raise ValueError("El email no tiene un formato válido.")
    return valor


#: Tipo de Pydantic para un campo `email` con la forma mínima del padrón. Los esquemas le suman
#: sus propios límites de longitud con `Field`.
EmailConForma = Annotated[str, AfterValidator(validar_email)]
