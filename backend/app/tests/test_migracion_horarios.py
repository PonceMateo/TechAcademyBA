"""El parser de la migración `0005_comision_horario` (historia #48).

**Por qué se carga la migración con `importlib`.** El parser vive dentro de la migración a
propósito: una conversión que importa código de la aplicación se rompe cuando ese código cambia,
porque la migración tiene que seguir haciendo lo mismo dentro de dos años. El costo es que el
módulo no es importable por su nombre, y este archivo lo resuelve una sola vez.

**Qué se prueba acá y qué no.** Acá va el parser, que es la parte con ramas: formatos aceptados,
textos que tienen que quedar sin filas y que lo que devuelve cumpla las restricciones de la tabla.
Que la migración corra sobre una base real —`upgrade head`, `downgrade -1` y otra vez— lo cubre
`test_migration.py`, que es el lugar de las pruebas del esquema.
"""

from __future__ import annotations

import importlib.util
from datetime import time
from pathlib import Path
from types import ModuleType

import pytest

RUTA_MIGRACION = (
    Path(__file__).resolve().parents[2] / "alembic" / "versions" / "0005_comision_horario.py"
)


def _cargar_migracion() -> ModuleType:
    especificacion = importlib.util.spec_from_file_location("migracion_0005", RUTA_MIGRACION)
    assert especificacion is not None and especificacion.loader is not None
    modulo = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(modulo)
    return modulo


@pytest.fixture(scope="module")
def migracion() -> ModuleType:
    return _cargar_migracion()


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        (
            "Lunes y miércoles 18:00 a 20:00",
            [("LUN", time(18, 0), time(20, 0)), ("MIE", time(18, 0), time(20, 0))],
        ),
        (
            "Mar y Jue 19 a 21 hs",
            [("MAR", time(19, 0), time(21, 0)), ("JUE", time(19, 0), time(21, 0))],
        ),
        (
            "Lun y Mié 18:30-21:00",
            [("LUN", time(18, 30), time(21, 0)), ("MIE", time(18, 30), time(21, 0))],
        ),
        (
            "Lunes, miércoles y viernes de 9 a 12",
            [
                ("LUN", time(9, 0), time(12, 0)),
                ("MIE", time(9, 0), time(12, 0)),
                ("VIE", time(9, 0), time(12, 0)),
            ],
        ),
        ("Sábados 9 a 13", [("SAB", time(9, 0), time(13, 0))]),
        ("Jue 21 a 22", [("JUE", time(21, 0), time(22, 0))]),
    ],
)
def test_el_parser_convierte_los_textos_que_entiende(migracion, texto, esperado) -> None:
    assert migracion.convertir_texto(texto) == esperado


@pytest.mark.parametrize(
    "texto",
    [
        "Sábados intensivo",
        "Mar y Jue 18:30",
        "Lunes 19:10 a 21:00",
        "Lunes 23 a 24",
        "Lunes 5 a 7",
        "Lunes y lunes 19-21",
        "Lun 19 a 21 y Mar 18 a 20",
        "19 a 21",
        "",
        "Franjas a convenir",
    ],
)
def test_el_parser_descarta_lo_que_no_puede_convertir(migracion, texto) -> None:
    """Un texto que no se entiende deja la comisión sin filas y con su texto intacto.

    «Lunes 19:10 a 21:00» y «Lunes 23 a 24» son los peligrosos: se leen sin problema, pero sus
    filas romperían los CHECK de la tabla y el `upgrade head` se cortaría en todos los entornos.
    """
    assert migracion.convertir_texto(texto) == []


def test_las_filas_del_parser_cumplen_las_restricciones_de_la_tabla(migracion) -> None:
    """La guarda previa al `INSERT` no es opcional: la tabla rechaza lo que esta prueba enumera."""
    for texto in ("Lun y Mié 18:30-21:00", "Mar y Jue 19 a 21 hs", "Sábados 9 a 13"):
        for dia, inicio, fin in migracion.convertir_texto(texto):
            assert dia in {"LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"}
            assert inicio.minute in {0, 15, 30, 45}
            assert fin.minute in {0, 15, 30, 45}
            assert inicio >= time(6, 0) and fin <= time(22, 0)
            assert fin > inicio
