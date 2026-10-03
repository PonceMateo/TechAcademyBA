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
