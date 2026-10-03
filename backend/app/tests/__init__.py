"""Suite de pruebas del backend.

pytest contra PostgreSQL real, nunca SQLite (D15).

Este `__init__` ajusta **una** variable de entorno antes de que se importe nada de la
aplicación. pytest importa este paquete como parte de `app.tests.conftest`, así que se
ejecuta antes de que `app.core.database` construya la configuración del proceso, y por eso
el valor es el que llega a `Settings`.

El motivo es el que anticipa `design.md` en *Riesgos*: bcrypt es lento a propósito y con el
costo de producción (12 rondas, unos 250 ms por hash) una suite de autenticación que hashea
en cada prueba duplicaría el tiempo de la corrida. Bajar el costo **de la suite** no baja
el de producción: la variable no está en el `docker-compose.yml` ni en el `.env`, así que
el contenedor y el entorno local siguen usando 12. `test_security.py` falla si este ajuste
alguna vez deja de tener efecto.
"""

from __future__ import annotations

import os

#: Costo de bcrypt para las pruebas: el mínimo que acepta la biblioteca.
BCRYPT_ROUNDS_EN_LA_SUITE = 4

os.environ.setdefault("BCRYPT_ROUNDS", str(BCRYPT_ROUNDS_EN_LA_SUITE))
