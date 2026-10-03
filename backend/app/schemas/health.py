"""Esquema de salida del endpoint de salud."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Respuesta de `GET /health`.

    Deliberadamente minimalista: el endpoint es público y no autenticado, así que no
    puede revelar versión, configuración, conexión a la base ni nada del entorno. El
    healthcheck del contenedor lo consulta en cada tick, o sea que su contenido es lo
    primero que ve cualquiera que alcance el puerto.
    """

    status: str
    service: str
