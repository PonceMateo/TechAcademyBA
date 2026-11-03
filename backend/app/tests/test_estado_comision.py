"""Estado derivado de una comisión (H/U 70).

El estado no es una columna: sale de comparar `fecha_fin` con el día corriente en la zona del
dominio (D75). Los bordes que importan son el día de hoy y la comisión heredada sin fecha de fin.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.models.catalogo import ZONA_HORARIA_DOMINIO, Comision, estado_comision


def _hoy() -> date:
    return datetime.now(ZONA_HORARIA_DOMINIO).date()


def test_una_comision_que_termina_hoy_sigue_vigente() -> None:
    comision = Comision(fecha_fin=_hoy())

    assert estado_comision(comision) == "Vigente"


def test_una_comision_que_termino_ayer_esta_finalizada() -> None:
    comision = Comision(fecha_fin=_hoy() - timedelta(days=1))

    assert estado_comision(comision) == "Finalizada"


def test_una_comision_que_termina_manana_esta_vigente() -> None:
    comision = Comision(fecha_fin=_hoy() + timedelta(days=1))

    assert estado_comision(comision) == "Vigente"


def test_la_comision_heredada_sin_fecha_de_fin_queda_vigente() -> None:
    """Sin fecha no se puede afirmar que terminó, y bloquearla impediría inscribir."""
    comision = Comision(fecha_fin=None)

    assert estado_comision(comision) == "Vigente"


def test_la_propiedad_usa_la_zona_del_dominio() -> None:
    assert Comision(fecha_fin=_hoy() + timedelta(days=30)).estado == "Vigente"
    assert Comision(fecha_fin=_hoy() - timedelta(days=30)).estado == "Finalizada"
