"""Normalización de valores para las unicidades tolerantes a formato (D6).

La normalización es mayúsculas, sin acentos y solo alfanuméricos para códigos y
nombres, y solo dígitos para documentos. Se mantiene en Python, y no en un índice
funcional de PostgreSQL, porque así es testeable en aislamiento y reutilizable entre
tablas: el `alternativa descartada` de D6.

`CUR-101`, `cur 101` y `cur-101` colisionan. `30-71665544-9` y `30716655449`
también.
"""

from __future__ import annotations

import re
import unicodedata

_NON_ALPHANUMERIC = re.compile(r"[^0-9A-Z]+")
_NON_DIGIT = re.compile(r"\D+")


def normalize_code(value: str) -> str:
    """Normaliza un código: mayúsculas, sin acentos y solo alfanuméricos.

    >>> normalize_code("cur-101")
    'CUR101'
    >>> normalize_code("Curso de Categoría Ónica")
    'CURSODECATEGORIAONICA'
    """
    stripped = unicodedata.normalize("NFKD", value.strip())
    without_accents = "".join(char for char in stripped if not unicodedata.combining(char))
    return _NON_ALPHANUMERIC.sub("", without_accents.upper())


def normalize_name(value: str) -> str:
    """Normaliza un nombre para comparar dos cursos que solo difieren en formato.

    Además de lo de `normalize_code`, colapsa espacios: `"Python  Inicial"` y
    `"Python Inicial"` son el mismo curso.
    """
    stripped = unicodedata.normalize("NFKD", value.strip())
    without_accents = "".join(char for char in stripped if not unicodedata.combining(char))
    collapsed = re.sub(r"\s+", " ", without_accents.upper())
    return _NON_ALPHANUMERIC.sub("", collapsed)


def normalize_document(value: str | None) -> str | None:
    """Deja solo los dígitos de un documento. `None` o vacío se devuelve como `None`.

    Un documento sin dígitos es un documento ausente, no un documento vacío: si no, un
    índice único sobre la columna normalizada rechazaría al segundo alumno que no
    tenga DNI (D30).

    >>> normalize_document("30-71665544-9")
    '30716655449'
    >>> normalize_document("sin digitos") is None
    True
    """
    if value is None:
        return None
    digits = _NON_DIGIT.sub("", value)
    return digits or None


#: Pesos del dígito verificador del CUIT, según la regla de AFIP. Son los mismos que usa el
#: CHECK `ck_empresa_cuit_digito` de la base (historia #18): esta función le habla al operador
#: con un 422 claro, y la base le habla a cualquier otro camino que intente escribir el dato.
_CUIT_PESOS = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def cuit_digito_verificador(primeros_diez: str) -> str:
    """Dígito verificador de un CUIT a partir de sus diez primeros dígitos.

    >>> cuit_digito_verificador("3012345678")
    '1'
    """
    total = sum(int(digito) * peso for digito, peso in zip(primeros_diez, _CUIT_PESOS, strict=True))
    resto = total % 11
    if resto == 0:
        return "0"
    if resto == 1:
        return "9"
    return str(11 - resto)


def cuit_es_valido(value: str) -> bool:
    """¿El valor tiene once dígitos y un dígito verificador correcto? (historia #18)

    >>> cuit_es_valido("30-12345678-1")
    True
    >>> cuit_es_valido("30123456782")
    False
    >>> cuit_es_valido("3012345678")
    False
    """
    digitos = normalize_document(value)
    if digitos is None or len(digitos) != 11:
        return False
    return cuit_digito_verificador(digitos[:10]) == digitos[10]
