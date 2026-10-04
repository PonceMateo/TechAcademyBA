"""Punto de entrada de la aplicación.

Este es el objeto que arranca `uvicorn app.main:app`, tanto en el contenedor como
en los tests.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="TechAcademy BA API",
    # D14: el navegador siempre habla con `/api` y el backend nunca publica el prefijo. En
    # Vercel el servicio se sirve bajo `/api` y recibe el path completo, así que sin esto
    # `/api/health` no matchea `/health`. El proxy de Vite de desarrollo saca el prefijo, y
    # esto no lo rompe: Starlette solo lo saca si el path arranca con él.
    root_path="/api",
    # D22: los datos del maquetado son placeholders, no datos reales, así que no se
    # publica la documentación de la API en el entorno de desarrollo.
    docs_url=None if not settings.debug else "/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
