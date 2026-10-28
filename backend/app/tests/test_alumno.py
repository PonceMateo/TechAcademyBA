"""Contrato del autoservicio del alumno (HUs #38, #42 y #43).

**Pruebas de unidad del esquema**: no tocan la base, porque lo que afirman es qué acepta y qué
rechaza el contrato de entrada antes de llegar al servicio. La contracara contra PostgreSQL está en
`test_alumno_api.py`.

La edición del perfil es el caso que importa: el alumno puede cambiar su email y su teléfono, y
**nada más**. El documento, el nombre y el identificador del sistema no están en el contrato, así
que un cuerpo que los mande tiene que caer acá y no depender de que el servicio los ignore.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.alumno import PerfilAlumnoUpdate

#: Cuerpo válido de la edición del perfil, para cambiar un solo campo por test.
PERFIL = {
    "email": "agustina.benitez@techacademy.invalid",
    "telefono": "+5491140000002",
}


@pytest.mark.parametrize("campo", ["documento", "nombre", "id"])
def test_el_perfil_rechaza_los_campos_que_no_son_de_contacto(campo: str) -> None:
    """Documento, nombre e identificador no se editan desde el panel del alumno."""
    with pytest.raises(ValidationError) as error:
        PerfilAlumnoUpdate(**{**PERFIL, campo: "otro valor"})

    assert campo in str(error.value)


def test_el_perfil_acepta_email_y_telefono() -> None:
    perfil = PerfilAlumnoUpdate(**PERFIL)

    assert perfil.email == PERFIL["email"]
    assert perfil.telefono == PERFIL["telefono"]


@pytest.mark.parametrize("vacio", ["", "   ", None])
def test_borrar_el_telefono_es_mandar_vacio(vacio: str | None) -> None:
    """Vacío o nulo significan "no informado": el servicio guarda `None` y no un `422`."""
    assert PerfilAlumnoUpdate(**{**PERFIL, "telefono": vacio}).telefono is None


def test_un_telefono_sin_forma_internacional_se_rechaza() -> None:
    with pytest.raises(ValidationError, match="formato internacional"):
        PerfilAlumnoUpdate(**{**PERFIL, "telefono": "011 4788-1122"})


def test_un_email_sin_forma_se_rechaza() -> None:
    with pytest.raises(ValidationError, match="formato válido"):
        PerfilAlumnoUpdate(**{**PERFIL, "email": "agustina"})
