"""3.2 — Tooling declarado y configurado: ruff, pytest y la prohibición de unittest."""

from __future__ import annotations

import ast
import json
import subprocess
import sys
import tomllib
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
PYPROJECT = BACKEND_ROOT / "pyproject.toml"
VERCEL_CONFIG = REPO_ROOT / "vercel.json"


@pytest.fixture(scope="module")
def pyproject() -> dict:
    return tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def vercel() -> dict:
    return json.loads(VERCEL_CONFIG.read_text(encoding="utf-8"))


def test_las_dependencias_de_aplicacion_estan_fijadas(pyproject: dict) -> None:
    declaradas = " ".join(pyproject["project"]["dependencies"]).lower()
    for paquete in (
        "fastapi",
        "sqlalchemy",
        "alembic",
        "pydantic",
        "pydantic-settings",
        "psycopg",
        "pyjwt",
        "bcrypt",
    ):
        assert paquete in declaradas, f"falta la dependencia {paquete}"
    assert "sqlalchemy>=2." in declaradas, "SQLAlchemy tiene que ser 2.x"
    assert any(d.startswith("pydantic>=2.") for d in pyproject["project"]["dependencies"]), (
        "Pydantic tiene que ser v2"
    )
    assert any("psycopg" in d and "3." in d for d in pyproject["project"]["dependencies"]), (
        "psycopg tiene que ser 3.x"
    )


def test_las_dependencias_de_desarrollo_estan_en_el_extra_dev(pyproject: dict) -> None:
    """`backend/Dockerfile` instala con `pip install -e ".[dev]"`, así que la clave
    tiene que ser `dev` en `[project.optional-dependencies]` y no
    `[dependency-groups]`, que pip no resuelve como extra."""
    assert "optional-dependencies" in pyproject["project"], (
        "falta [project.optional-dependencies]: el Dockerfile instala con .[dev]"
    )
    dev = pyproject["project"]["optional-dependencies"]["dev"]
    declaradas = " ".join(dev).lower()
    for paquete in ("pytest", "httpx", "ruff"):
        assert paquete in declaradas, f"falta la dependencia de desarrollo {paquete}"


def test_ruff_esta_configurado(pyproject: dict) -> None:
    assert "ruff" in pyproject["tool"], "falta [tool.ruff]"
    ruff = pyproject["tool"]["ruff"]
    assert ruff["target-version"] == "py312", "el linter tiene que apuntar a Python 3.12"
    assert ruff["line-length"] >= 88


def test_pytest_esta_configurado(pyproject: dict) -> None:
    assert "pytest" in pyproject["tool"], "falta [tool.pytest.ini_options]"
    pytest_config = pyproject["tool"]["pytest"]["ini_options"]
    assert pytest_config["testpaths"] == ["app/tests"], "la suite vive en app/tests"
    assert pytest_config["python_files"] == ["test_*.py"]


def test_ruff_check_pasa_sin_errores_de_configuracion() -> None:
    """`ruff check` tiene que ejecutar limpio, incluida la carga de la configuración."""
    resultado = subprocess.run(  # noqa: S603
        [sys.executable, "-m", "ruff", "check", "."],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert resultado.returncode == 0, (
        f"ruff check falló.\nstdout:\n{resultado.stdout}\nstderr:\n{resultado.stderr}"
    )


def test_ninguna_prueba_usa_unittest() -> None:
    """La spec pide pytest y prohíbe unittest de forma explícita."""
    ofensores: list[str] = []
    for path in sorted((BACKEND_ROOT / "app").rglob("*.py")):
        arbol = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Import):
                nombres = [alias.name for alias in nodo.names]
            elif isinstance(nodo, ast.ImportFrom):
                nombres = [nodo.module or ""]
            else:
                continue
            for nombre in nombres:
                if nombre == "unittest" or nombre.startswith("unittest."):
                    ofensores.append(f"{path.relative_to(BACKEND_ROOT)}:{nodo.lineno}")
    assert not ofensores, f"unittest no se usa en este proyecto: {ofensores}"


def test_no_hay_archivos_de_test_de_unittest() -> None:
    """`unittest` descubre por `test*.py`; toda la suite tiene que ser pytest."""
    for patron in ("test*.py",):
        for path in sorted((BACKEND_ROOT / "app").rglob(patron)):
            if not path.name.startswith("test_"):
                raise AssertionError(
                    f"{path.name} no sigue la convención de pytest: los archivos de prueba "
                    "se llaman test_<que_prueban>.py, no test<lo que sea>.py"
                )


def test_el_rewrite_de_api_llega_al_servicio_backend(vercel: dict) -> None:
    """Lo único que vercel.json tiene que resolver es el ruteo: un servicio es interno y
    solo recibe tráfico público si un rewrite de primer nivel lo apunta.

    El prefijo `/api` no lo saca vercel.json: lo saca `root_path` de la aplicación, y eso
    lo comprueba `test_health.py`. Un `transforms` de `request.path` en el servicio se
    declaró antes y no tuvo efecto en el despliegue, así que no se vuelve a poner.
    """
    rewrites = vercel["rewrites"]
    de_api = [r for r in rewrites if r["source"].startswith("/api")]

    assert [r["destination"]["service"] for r in de_api] == ["backend"]
    assert rewrites.index(de_api[0]) < len(rewrites) - 1, "/api se evalúa antes del catch-all"
    assert rewrites[-1]["destination"]["service"] == "frontend", "el resto es la SPA"
