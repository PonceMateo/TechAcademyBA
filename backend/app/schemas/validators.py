"""Validaciones compartidas entre los contratos del padrón.

**La regla de email es una sola para docentes y alumnos** (D-C del change `hu-13-alta-alumno`).
Dos copias de una regla que el spec exige igual tienden a divergir, y el costo de compartirla es
este módulo de una función. Se expone como tipo anotado de Pydantic para que cada esquema la
declare en el campo `email` sin repetir el validador.

Lo mismo vale para el DNI y el teléfono (D57): el DNI del docente se valida con la regla del
alumno y el teléfono de los dos padrones se guarda en E.164. La regla vive acá una sola vez.
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator

#: Lo único que puede aparecer en un DNI además de sus dígitos: puntos, espacios y guiones.
_SOLO_DIGITOS_Y_SEPARADORES = re.compile(r"[0-9.\s-]+")

#: Cantidad de dígitos de un DNI argentino.
_DIGITOS_DNI = (7, 8)

#: E.164: un `+`, un código de país que no empieza en cero y entre 7 y 15 dígitos en total.
_TELEFONO_E164 = re.compile(r"\+[1-9][0-9]{6,14}")

#: Un CUIL se escribe solo con dígitos y, a lo sumo, guiones.
_CUIL_CON_GUIONES = re.compile(r"[0-9-]+")

#: Prefijos de CUIL admitidos. El resto de los prefijos de AFIP no corresponden a una persona
#: física con DNI, que es el único padrón que carga CUIL.
PREFIJOS_CUIL = ("20", "23", "24", "27")


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


def validar_dni(valor: str) -> str:
    """Acepta un DNI de 7 u 8 dígitos, escrito con puntos, espacios o guiones o sin ellos.

    El rechazo de letras es explícito y no se deja a la base: un documento con letras
    terminaría en `documento_norm` nulo y el CHECK `documento_y_tipo_juntos` lo rechazaría
    con un error crudo, sin mensaje útil para el formulario. El valor se devuelve tal como lo
    escribió la secretaría; la forma normalizada la calcula el servicio.
    """
    if _SOLO_DIGITOS_Y_SEPARADORES.fullmatch(valor) is None:
        raise ValueError("El DNI debe tener 7 u 8 dígitos.")
    if len(re.sub(r"\D", "", valor)) not in _DIGITOS_DNI:
        raise ValueError("El DNI debe tener 7 u 8 dígitos.")
    return valor


def validar_telefono(valor: str) -> str:
    """Forma de transporte E.164: `+`, código de país y dígitos, sin espacios ni guiones.

    **No se valida que sea una línea real.** El formulario lo comprueba con la librería de
    teléfonos y acá solo se garantiza que lo que se guarda es un E.164 y no texto libre: sin esta
    regla, `particular` entraría a la base y ningún cliente podría marcar ese número.
    """
    if _TELEFONO_E164.fullmatch(valor) is None:
        raise ValueError(
            "El teléfono debe tener el formato internacional, por ejemplo +5491112345678."
        )
    return valor


def validar_cuil(cuil: str, dni: str) -> str:
    """CUIL de 11 dígitos con prefijo permitido y los 8 del medio iguales al DNI.

    **No se calcula ni se valida el dígito verificador** (D57): el formulario lo escribe a mano y
    la API guarda el que informó la secretaría. El DNI se compara por sus dígitos, sin puntos,
    espacios ni guiones, y se completa con ceros a la izquierda cuando tiene 7 dígitos. El valor
    devuelto son los 11 dígitos tal como se van a guardar.
    """
    if _CUIL_CON_GUIONES.fullmatch(cuil) is None:
        raise ValueError("El CUIL debe tener 11 dígitos.")
    digitos = cuil.replace("-", "")
    if len(digitos) != 11:
        raise ValueError("El CUIL debe tener 11 dígitos.")
    if digitos[:2] not in PREFIJOS_CUIL:
        raise ValueError("El prefijo del CUIL debe ser 20, 23, 24 o 27.")
    dni_digitos = re.sub(r"\D", "", dni)
    if digitos[2:10] != dni_digitos.zfill(8):
        raise ValueError("Los 8 dígitos del medio del CUIL deben coincidir con el DNI.")
    return digitos


#: Tipo de Pydantic para un campo `email` con la forma mínima del padrón. Los esquemas le suman
#: sus propios límites de longitud con `Field`.
EmailConForma = Annotated[str, AfterValidator(validar_email)]

#: Tipo de Pydantic para un DNI de 7 u 8 dígitos, con o sin separadores.
DniConForma = Annotated[str, AfterValidator(validar_dni)]

#: Tipo de Pydantic para un teléfono E.164.
TelefonoE164 = Annotated[str, AfterValidator(validar_telefono)]
