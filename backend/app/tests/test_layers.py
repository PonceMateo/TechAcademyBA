"""3.1 — Estructura por capas, sin imports circulares.

La prueba del grafo de imports es la que realmente importa: importar los paquetes en un
proceso limpio demuestra que el orden no importa, y el análisis estático del grafo
`app.*` demuestra que no hay ningún ciclo, ni siquiera de uno que solo se manifestaría
en un orden de importación distinto al de esta corrida.
"""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = APP_ROOT.parent

LAYERS = ("core", "models", "schemas", "api", "services")


def test_los_cinco_directorios_de_capa_existen() -> None:
    for layer in LAYERS:
        paquete = APP_ROOT / layer
        assert paquete.is_dir(), f"falta el directorio de capa app/{layer}"
        assert (paquete / "__init__.py").is_file(), f"app/{layer} no es un paquete"


def test_app_tests_es_un_paquete() -> None:
    assert (APP_ROOT / "tests" / "__init__.py").is_file()


def _imports_de_app(path: Path) -> set[str]:
    """Módulos de `app.*` que el archivo importa."""
    arbol = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    encontrados: set[str] = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            encontrados.update(alias.name for alias in nodo.names if alias.name.startswith("app"))
        elif isinstance(nodo, ast.ImportFrom) and nodo.module and nodo.module.startswith("app"):
            encontrados.add(nodo.module)
            encontrados.update(
                f"{nodo.module}.{alias.name}"
                for alias in nodo.names
                if not alias.name.startswith("*")
            )
    return encontrados


def _es_modulo_existente(nombre: str) -> bool:
    return (BACKEND_ROOT / Path(*nombre.split("."))).with_suffix(".py").exists()


def _grafo_de_imports() -> dict[str, set[str]]:
    grafo: dict[str, set[str]] = {}
    for path in sorted(APP_ROOT.rglob("*.py")):
        modulo = ".".join(path.relative_to(BACKEND_ROOT).with_suffix("").parts)
        grafo[modulo] = {
            destino
            for destino in _imports_de_app(path)
            if destino != modulo and _es_modulo_existente(destino)
        }
    return grafo


def _es_modulo_de_app(nombre: str) -> bool:
    return nombre == "app" or nombre.startswith("app.")


def test_no_hay_imports_circulares_entre_modulos_de_app() -> None:
    """Recorre el grafo en profundidad y falla si encuentra un ciclo."""
    grafo = _grafo_de_imports()
    en_pila: set[str] = set()
    visitados: set[str] = set()

    def visitar(modulo: str, camino: list[str]) -> None:
        if modulo in en_pila:
            ciclo = " -> ".join([*camino, modulo])
            raise AssertionError(f"hay un ciclo de imports entre módulos de app: {ciclo}")
        if modulo in visitados:
            return
        en_pila.add(modulo)
        for destino in sorted(grafo.get(modulo, ())):
            if _es_modulo_de_app(destino):
                visitar(destino, [*camino, modulo])
        en_pila.discard(modulo)
        visitados.add(modulo)

    for modulo in sorted(grafo):
        visitar(modulo, [])


@pytest.mark.parametrize(
    "paquetes",
    [
        ("core", "models", "schemas", "api", "services"),
        ("services", "api", "schemas", "models", "core"),
        ("api", "services", "core", "schemas", "models"),
    ],
    ids=["enorden", "inverso", "intercalado"],
)
def test_los_cinco_paquetes_importan_sin_errores(paquetes: tuple[str, ...]) -> None:
    """Importa los cinco paquetes en un subproceso limpio, en el orden dado."""
    script = "; ".join(f"import app.{paquete}" for paquete in paquetes)
    resultado = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert resultado.returncode == 0, (
        f"importar {paquetes} falló.\nstdout:\n{resultado.stdout}\nstderr:\n{resultado.stderr}"
    )


def test_las_capas_no_se_importan_entre_si_de_modo_inesperado() -> None:
    """`core` no puede depender de las capas de arriba: es la base de la pirámide."""
    grafo = _grafo_de_imports()
    for modulo, destinos in grafo.items():
        if not modulo.startswith("app.core"):
            continue
        for destino in destinos:
            assert not destino.startswith(
                ("app.models", "app.schemas", "app.api", "app.services")
            ), f"app/core no debería importar {destino}: es la base de la pirámide (D1)"
