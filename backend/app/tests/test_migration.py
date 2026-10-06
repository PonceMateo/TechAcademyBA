"""4.7 y 4.8 — Migración inicial contra PostgreSQL real, y ausencia de SQLite.

D15 y D16: la migración se aplica contra un PostgreSQL de verdad, no contra un motor
emulado. Una suite en SQLite pasaría y la migración fallaría después, porque SQLite no
tiene `num_nonnulls`, ni índices únicos sobre columnas normalizadas, ni CHECKs con
`CURRENT_DATE`, ni columnas `timestamptz`.
"""

from __future__ import annotations

import ast
import os
import subprocess
import sys
import tomllib

import pytest
from sqlalchemy import text

from app.tests.conftest import ALEMBIC_INI, BACKEND_ROOT, _run_alembic

#: Tablas que el esquema de dominio debe tener. Es el contrato de la migración inicial.
TABLAS_ESPERADAS = {
    "alumno",
    "asistencia",
    "audit_log",
    "clase",
    "cobranza",
    "comision",
    "contrato_corporativo",
    "curso",
    "docente",
    "empresa",
    "factura",
    "imputacion",
    "inscripcion",
    "nomina_empleado",
    "override_habilitacion",
    "pagador",
    "sede",
    "usuario",
}

#: CHECK que el dominio exige estar en el esquema. D16: un `autogenerate` en verde no
#: significa que la restricción exista, así que se listan y se comparan uno por uno.
CHECKS_ESPERADOS = {
    # Catálogo
    "ck_comision_cupo_maximo_positivo",
    "ck_comision_numero_positivo",
    "ck_comision_arancel_positivo",
    "ck_comision_modalidad_presencial_requiere_sede",
    "ck_comision_modalidad_valida",
    # Padrón
    "ck_usuario_rol_vinculo_coherente",
    "ck_usuario_rol_valido",
    "ck_alumno_documento_y_tipo_juntos",
    "ck_alumno_tipo_documento_valido",
    # Cuentas corporativas e inscripciones
    "ck_empresa_cuit_formato",
    "ck_empresa_cuit_digito",
    "ck_contrato_corporativo_tipo_contrato_valido",
    "ck_nomina_empleado_solo_curso_formal_tiene_nomina",
    "ck_inscripcion_porcentaje_beca_solo_para_becado_parcial",
    "ck_inscripcion_corporativo_requiere_empresa",
    "ck_inscripcion_categoria_valida",
    # Cobranzas
    "ck_cobranza_cobranza_importe_positivo",
    "ck_cobranza_cobranza_fecha_no_futura",
    "ck_cobranza_causa_obligatoria_si_no_acreditado",
    "ck_cobranza_estado_cobranza_valido",
    "ck_cobranza_estado_cambiado_registro_completo",
    "ck_pagador_pagador_documento_formato",
    "ck_imputacion_imputacion_destino_unico",
    "ck_imputacion_imputacion_monto_positivo",
    "ck_factura_factura_destino_unico",
    "ck_factura_factura_no_requerida_no_emitida",
    "ck_factura_tipo_factura_valido",
    # Clases y auditoría
    "ck_clase_clase_link_virtual_url",
    "ck_asistencia_asistencia_estado_valido",
    "ck_override_habilitacion_override_motivo_obligatorio",
    # Obligatorios: `NOT NULL` solo rechaza la ausencia de valor, no una cadena vacía.
    # `ck_curso_curso_codigo_obligatorio` queda aunque la expresión generada no pueda
    # producir una cadena vacía: forma parte del conjunto de M4 y `ck_comision_codigo_obligatorio`
    # y `ck_docente_cuil_obligatorio` sí se van, porque esas columnas ya no existen o ya no
    # son obligatorias (D32 y D33).
    "ck_curso_curso_codigo_obligatorio",
    "ck_curso_curso_nombre_obligatorio",
    "ck_sede_sede_nombre_obligatorio",
    "ck_comision_comision_dias_horarios_obligatorio",
    "ck_docente_docente_email_obligatorio",
    "ck_docente_docente_nombre_obligatorio",
    "ck_docente_docente_apellido_obligatorio",
    "ck_alumno_alumno_nombre_obligatorio",
    "ck_alumno_alumno_email_obligatorio",
    "ck_usuario_usuario_email_obligatorio",
    "ck_usuario_usuario_nombre_obligatorio",
}

#: D6: la unicidad tolerante a formato vive en índices sobre columnas normalizadas.
INDICES_ESPERADOS = {
    "uq_curso_codigo",
    "uq_curso_nombre_norm",
    "uq_docente_dni_norm",
    "uq_docente_cuil",
    "uq_docente_email",
    "uq_alumno_documento_norm",
    "uq_alumno_email",
    "uq_usuario_email",
    "uq_empresa_cuit_norm",
    "uq_comision_curso_numero",
    "uq_inscripcion_alumno_comision",
    "uq_asistencia_clase_alumno",
}

#: D11: nada de esto puede aparecer en la migración inicial. La entidad de cuotas y el
#: esquema de cobro se definen con el cliente antes de implementar la historia #27.
#: `cobranza` e `imputacion` sí están: son el registro de pagos, no el esquema de cobro.
PATRONES_DE_CUOTAS = ("cuota", "cobro", "deuda", "mora", "plan_pago", "pago", "vencimiento")
TABLAS_EXENTENTES_POR_EL_REGISTRO_DE_PAGOS = {
    "alembic_version",
    "cobranza",
    "imputacion",
    "factura",
    "pagador",
}


def _tablas_publicas(db_session) -> set[str]:
    return set(
        db_session.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        ).scalars()
    )


def test_la_migracion_inicial_deja_el_esquema_completo(db_session) -> None:
    """Spec `dev-infrastructure`, "Migraciones de base de datos": el esquema de dominio
    completo queda creado."""
    assert _tablas_publicas(db_session) - {"alembic_version"} == TABLAS_ESPERADAS


def test_la_version_de_alembic_queda_registrada(db_session) -> None:
    versiones = db_session.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
    assert versiones == ["0002_altas_catalogo"]


def test_la_migracion_escrita_a_mano_cuadra_con_los_modelos(
    test_database_url: str,
) -> None:
    """Si `alembic check` no detecta diferencias, la migración escrita a mano y el
    metadata dicen exactamente lo mismo.

    Esto es el control que le da sentido a la revisión manual de D16: la revisión manual
    puede agregar CHECKs que el autogenerate no emite, siempre que el metadata los
    declare también; si divergen, esta prueba lo dice.
    """
    environment = {**os.environ, "DATABASE_URL": test_database_url}
    environment.setdefault("JWT_SECRET_KEY", "tests-only-not-a-real-secret")
    resultado = subprocess.run(  # noqa: S603
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), "check"],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert resultado.returncode == 0, (
        f"alembic check detectó diferencias entre la migración y los modelos.\n"
        f"stdout:\n{resultado.stdout}\nstderr:\n{resultado.stderr}"
    )


def test_downgrade_y_upgrade_vuelven_a_dejar_el_esquema(test_database_url: str) -> None:
    """La reversión tiene que ser completa: si `downgrade base` deja tablas, la base de
    pruebas se ensucia entre corridas."""
    _run_alembic(test_database_url, "downgrade", "base")
    _run_alembic(test_database_url, "upgrade", "head")


def test_upgrade_cuando_no_hay_migraciones_pendientes_no_hace_nada(
    test_database_url: str,
) -> None:
    """Spec `dev-infrastructure`: correr migraciones sobre una base ya migrada
    finaliza correctamente sin volver a aplicar nada."""
    _run_alembic(test_database_url, "upgrade", "head")


def test_no_hay_esquema_de_cuotas(db_session) -> None:
    """D11 y tarea 4.7: la migración inicial no crea ninguna entidad de cuotas ni
    ninguna tabla del esquema de cobro.

    La historia #27 habla de "cuota vigente" y "cuota vencida": esa regla **no** se puede
    escribir hasta que el equipo defina el esquema de cobro con el cliente. Agregar la
    tabla acá sería adivinar, y desarmar una migración aplicada es más caro que esperar.
    """
    intrusos = {
        tabla
        for tabla in _tablas_publicas(db_session)
        if any(patron in tabla for patron in PATRONES_DE_CUOTAS)
        and tabla not in TABLAS_EXENTENTES_POR_EL_REGISTRO_DE_PAGOS
    }
    assert not intrusos, f"la migración inicial no debe crear tablas de cobro: {intrusos}"


def test_el_modelo_no_declara_una_entidad_de_cuotas() -> None:
    """`app.models` es la fuente del autogenerate: si acá apareciera una entidad de
    cuotas, la próxima migración la crearía."""
    from app.models import Base

    assert not [nombre for nombre in Base.metadata.tables if "cuota" in nombre]


def test_imputacion_admite_una_cuota_futura_sin_romper_lo_existente() -> None:
    """Spec `domain-schema`, "Imputaciones compatibles con cuotas futuras": la estructura
    tiene que admitir agregar `cuota_id` más adelante sin alterar las imputaciones
    existentes. Hoy eso se comprueba sobre el CHECK de destino único (D7)."""
    from app.models.cobranza import Imputacion

    checks = [
        str(constraint.sqltext)
        for constraint in Imputacion.__table__.constraints
        if constraint.__class__.__name__ == "CheckConstraint"
    ]
    destino = [texto for texto in checks if "num_nonnulls" in texto]
    assert destino, "imputacion tiene que conservar el CHECK de destino único de D7"
    assert "inscripcion_id" in destino[0]
    assert "empresa_id" in destino[0]


def test_no_hay_ninguna_ruta_de_sqlite_en_el_codigo() -> None:
    """Tarea 4.8: ninguna ruta del código depende de SQLite."""
    ofensores: list[str] = []
    for path in sorted((BACKEND_ROOT / "app").rglob("*.py")):
        arbol = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for nodo in ast.walk(arbol):
            modulos: list[str] = []
            if isinstance(nodo, ast.Import):
                modulos = [alias.name for alias in nodo.names]
            elif isinstance(nodo, ast.ImportFrom):
                modulos = [nodo.module or ""]
            for modulo in modulos:
                if modulo.split(".")[0] in {"sqlite3", "sqlite", "aiosqlite"}:
                    ofensores.append(f"{path.relative_to(BACKEND_ROOT)}:{nodo.lineno}: {modulo}")
    assert not ofensores, f"el proyecto no usa SQLite (D15), pero aparece en: {ofensores}"


def test_no_hay_ninguna_ruta_de_sqlite_en_la_configuracion() -> None:
    """Una URL `sqlite://` en la configuración sería la otra forma de colarse."""
    configuracion = tomllib.loads((BACKEND_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    assert "sqlite" not in str(configuracion).lower()


def test_la_url_de_la_base_es_postgresql() -> None:
    from app.core.config import get_settings

    assert get_settings().database_url.startswith("postgresql+psycopg://")


def test_la_conexion_de_prueba_es_postgresql(test_database_url: str) -> None:
    """La prueba se corre contra un PostgreSQL real, no contra un emulador. Si alguien
    cambia la URL de la base de pruebas, esto lo dice."""
    assert test_database_url.startswith("postgresql")


def test_la_zona_horaria_de_la_conexion_es_la_del_dominio(db_session) -> None:
    """Spec `domain-schema`, "Moneda y zona horaria": las fechas incluyen la zona del
    dominio, no la del contenedor."""
    zona = db_session.execute(text("SHOW TIMEZONE")).scalar_one()
    assert zona == "America/Argentina/Buenos_Aires"


def test_las_marcas_de_tiempo_son_timestamptz(db_session) -> None:
    columnas = db_session.execute(
        text(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name IN ('created_at', 'updated_at')
            """
        )
    ).all()
    assert columnas, "el esquema tiene que tener marcas de tiempo"
    assert {tipo for _, tipo in columnas} == {"timestamp with time zone"}


def test_los_montos_son_numericos_exactos(db_session) -> None:
    """Spec `domain-schema`: los montos se expresan en pesos argentinos con precisión
    decimal, no en punto flotante."""
    columnas = db_session.execute(
        text(
            """
            SELECT column_name, data_type, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name IN ('arancel', 'monto', 'importe')
            """
        )
    ).all()
    assert columnas
    assert {tipo for _, tipo, _ in columnas} == {"numeric"}
    assert {escala for _, _, escala in columnas} == {2}


def test_los_checks_del_dominio_estan_en_el_esquema(db_session) -> None:
    """D16: un `autogenerate` en verde no significa que la restricción de la historia #15
    exista. Se listan los CHECK reales del esquema y se comparan con los que el dominio
    exige, uno por uno."""
    nombres = set(
        db_session.execute(
            text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE contype = 'c' AND connamespace = 'public'::regnamespace
                """
            )
        ).scalars()
    )
    faltantes = CHECKS_ESPERADOS - nombres
    assert not faltantes, f"la migración inicial no tiene estos CHECK: {sorted(faltantes)}"


def test_los_indices_unicos_sobre_columnas_normalizadas_existen(db_session) -> None:
    nombres = set(
        db_session.execute(
            text("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
        ).scalars()
    )
    faltantes = INDICES_ESPERADOS - nombres
    assert not faltantes, f"faltan estos índices o restricciones únicas: {sorted(faltantes)}"


def test_el_curso_no_tiene_una_forma_normalizada_del_codigo(db_session) -> None:
    """D32: `curso.codigo_norm` y su índice único desaparecieron.

    El otro test de esta migración afirma que `uq_curso_codigo` existe. Este afirma lo que lo
    acompaña: un valor generado no tiene dos representaciones que puedan diferir, así que la
    columna normalizada y su índice no tienen por qué estar, y si alguien los volviera a agregar
    el catálogo tendría dos verdades para el mismo código.
    """
    from app.models.catalogo import Curso

    assert "codigo_norm" not in Curso.__table__.columns

    nombres = set(
        db_session.execute(
            text("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
        ).scalars()
    )
    assert "uq_curso_codigo_norm" not in nombres
    assert "uq_curso_codigo" in nombres


def test_el_trigger_de_auditoria_inmutable_existe(db_session) -> None:
    filas = db_session.execute(
        text(
            """
            SELECT trigger_name, event_manipulation
            FROM information_schema.triggers
            WHERE event_object_table = 'audit_log'
            """
        )
    ).all()
    assert filas, "audit_log necesita el trigger de solo agregado"
    disparadores = {nombre for nombre, _ in filas}
    assert "trg_audit_log_solo_agregado" in disparadores
    eventos = {
        evento for nombre, evento in filas if nombre == "trg_audit_log_solo_agregado"
    }
    assert eventos == {"UPDATE", "DELETE"}


@pytest.mark.parametrize("tabla", sorted(TABLAS_ESPERADAS))
def test_cada_tabla_tiene_su_marca_de_creacion(db_session, tabla: str) -> None:
    """Spec `domain-schema`, "Convenciones transversales del esquema": toda entidad del
    dominio tiene marca de creación y de última actualización. `audit_log` es la única
    excepción, y a propósito."""
    tiene_created_at = db_session.execute(
        text(
            """
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :tabla AND column_name = 'created_at'
            """
        ),
        {"tabla": tabla},
    ).scalar_one()
    assert tiene_created_at == 1, f"{tabla} no tiene created_at"

    if tabla == "audit_log":
        return

    tiene_updated_at = db_session.execute(
        text(
            """
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :tabla AND column_name = 'updated_at'
            """
        ),
        {"tabla": tabla},
    ).scalar_one()
    assert tiene_updated_at == 1, f"{tabla} no tiene updated_at"
