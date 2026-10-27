"""Reglas compartidas de validación de los contratos del padrón (D57).

Son pruebas de unidad: no tocan la base, porque lo que se afirma es qué acepta y qué rechaza el
contrato de entrada antes de llegar al servicio. La contracara contra PostgreSQL está en
`test_padron.py`, `test_altas_api.py`, `test_alumnos.py` y `test_edicion_docente.py`.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.alumnos import AlumnoCreate, AlumnoUpdate
from app.schemas.padron import DocenteCreate, DocenteUpdate
from app.schemas.validators import validar_cuil, validar_dni, validar_telefono

#: Cuerpo mínimo de un alta de docente válida, para cambiar un solo campo por test.
DOCENTE = {
    "nombre": "Rita",
    "apellido": "Molina",
    "dni": "30111222",
    "email": "rita.molina@techacademy.invalid",
}

#: Cuerpo mínimo de un alta de alumno válida.
ALUMNO = {
    "documento": "30111222",
    "nombre": "Agustina Benítez",
    "email": "agustina.benitez@techacademy.invalid",
}


@pytest.mark.parametrize("dni", ["30111222", "3011122", "30.111.222", "30 111 222", "30-111-222"])
def test_un_dni_de_7_u_8_digitos_se_acepta_con_o_sin_separadores(dni: str) -> None:
    assert validar_dni(dni) == dni


@pytest.mark.parametrize("dni", ["3011122a", "30.111.222/5", "123456", "301112229"])
def test_un_dni_con_letras_o_con_longitud_invalida_se_rechaza(dni: str) -> None:
    with pytest.raises(ValueError, match="7 u 8 dígitos"):
        validar_dni(dni)


def test_el_dni_del_docente_usa_la_misma_regla_que_el_del_alumno() -> None:
    """El mismo valor tiene que entrar o rebotar igual en los dos padrones y en sus ediciones."""
    for dni in ["30111222", "30.111.222", "3011122"]:
        assert DocenteCreate(**{**DOCENTE, "dni": dni}).dni == dni
        assert DocenteUpdate(**{**DOCENTE, "dni": dni}).dni == dni
        assert AlumnoCreate(**{**ALUMNO, "documento": dni}).documento == dni
        assert AlumnoUpdate(**{**ALUMNO, "documento": dni}).documento == dni

    for dni in ["3011122a", "123456", "301112229"]:
        for esquema in (DocenteCreate, DocenteUpdate):
            with pytest.raises(ValidationError):
                esquema(**{**DOCENTE, "dni": dni})
        for esquema in (AlumnoCreate, AlumnoUpdate):
            with pytest.raises(ValidationError):
                esquema(**{**ALUMNO, "documento": dni})


@pytest.mark.parametrize(
    "telefono", ["+5491112345678", "+541140000001", "+1234567", "+123456789012345"]
)
def test_un_telefono_e164_se_acepta(telefono: str) -> None:
    assert validar_telefono(telefono) == telefono


@pytest.mark.parametrize(
    "telefono",
    [
        "particular",  # texto libre
        "000",  # sin código de país
        "5491112345678",  # sin el `+`
        "+54 11 4000-0001",  # con espacios y guiones
        "+0123456789",  # código de país que empieza en cero
        "+123456",  # menos de 7 dígitos
        "+1234567890123456",  # más de 15 dígitos
    ],
)
def test_un_telefono_que_no_es_e164_se_rechaza(telefono: str) -> None:
    with pytest.raises(ValueError, match="formato internacional"):
        validar_telefono(telefono)


def test_el_telefono_es_opcional_en_los_dos_padrones() -> None:
    assert DocenteCreate(**DOCENTE).telefono is None
    assert AlumnoCreate(**ALUMNO).telefono is None
    assert DocenteUpdate(**{**DOCENTE, "telefono": None}).telefono is None
    assert AlumnoUpdate(**{**ALUMNO, "telefono": None}).telefono is None
    assert AlumnoCreate(**{**ALUMNO, "telefono": "+5491112345678"}).telefono == "+5491112345678"


@pytest.mark.parametrize(
    "cuil",
    [
        "27301112225",
        "27-30111222-5",
        "20301112229",  # el verificador no se calcula ni se valida
        "23301112220",
        "24301112221",
    ],
)
def test_un_cuil_valido_se_acepta_y_se_guarda_sin_guiones(cuil: str) -> None:
    assert validar_cuil(cuil, "30111222") == cuil.replace("-", "")


@pytest.mark.parametrize("dni", ["30.111.222", "30 111 222", "30-111-222"])
def test_un_cuil_valido_se_acepta_aunque_el_dni_tenga_separadores(dni: str) -> None:
    assert validar_cuil("27-30111222-5", dni) == "27301112225"


def test_un_dni_de_7_digitos_se_completa_con_cero_para_comparar_el_cuil() -> None:
    assert validar_cuil("27030111228", "3011122") == "27030111228"


def test_un_dni_de_7_digitos_con_separadores_tambien_coincide_con_el_cuil() -> None:
    assert validar_cuil("27030112225", "3.011.222") == "27030112225"


@pytest.mark.parametrize(
    ("cuil", "dni", "motivo"),
    [
        ("2730111222", "30111222", "11 dígitos"),
        ("273011122250", "30111222", "11 dígitos"),
        ("27-30111222", "30111222", "11 dígitos"),
        ("30111222", "30111222", "11 dígitos"),
        ("27.30111222.5", "30111222", "11 dígitos"),
        ("21301112225", "30111222", "prefijo"),
        ("25301112225", "30111222", "prefijo"),
        ("27301112226", "30111223", "DNI"),
    ],
)
def test_un_cuil_con_estructura_invalida_se_rechaza(cuil: str, dni: str, motivo: str) -> None:
    with pytest.raises(ValueError, match=motivo):
        validar_cuil(cuil, dni)


def test_el_cuil_es_opcional_en_el_alta_y_acepta_el_valor_valido() -> None:
    assert DocenteCreate(**DOCENTE).cuil is None
    assert DocenteCreate(**{**DOCENTE, "cuil": "27-30111222-5"}).cuil == "27301112225"


def test_un_cuil_parcial_da_422() -> None:
    for cuil in ["27", "2730111222", "5", "273011122255"]:
        with pytest.raises(ValidationError, match="CUIL"):
            DocenteCreate(**{**DOCENTE, "cuil": cuil})


def test_un_cuil_que_no_coincide_con_el_dni_da_422() -> None:
    with pytest.raises(ValidationError, match="coincidir con el DNI"):
        DocenteCreate(**{**DOCENTE, "cuil": "27999888776"})


def test_un_prefijo_de_cuil_no_permitido_da_422() -> None:
    with pytest.raises(ValidationError, match="prefijo"):
        DocenteCreate(**{**DOCENTE, "cuil": "30301112225"})


def test_un_verificador_que_no_cierra_modulo_11_se_acepta() -> None:
    """El dígito verificador no se calcula: se guarda el que informó la secretaría (D57)."""
    assert DocenteCreate(**{**DOCENTE, "cuil": "27301112220"}).cuil == "27301112220"


def test_un_dni_invalido_no_agrega_un_error_de_cuil() -> None:
    """El CUIL no puede compararse si el DNI rebotó: el formulario marca un solo campo."""
    with pytest.raises(ValidationError) as error:
        DocenteCreate(**{**DOCENTE, "dni": "123456", "cuil": "27301112225"})

    assert [detalle["loc"] for detalle in error.value.errors()] == [("dni",)]
