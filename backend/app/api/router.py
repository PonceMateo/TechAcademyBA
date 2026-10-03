"""Agregador de rutas.

Cada módulo de `app/api` expone un `APIRouter` y este los junta. Un router por
concernimiento, para que agregar una HU no toque este archivo más que una línea.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api import health

api_router = APIRouter()
api_router.include_router(health.router)
