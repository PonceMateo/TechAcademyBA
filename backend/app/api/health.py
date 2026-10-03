"""Endpoint de verificación de salud (3.4).

Sin autenticación: el healthcheck del contenedor lo consulta en cada tick y no puede
llevar credenciales. Spec `dev-infrastructure`, "Endpoint de verificación de salud".

Es un **liveness** check, no un readiness: no consulta la base. El servicio `db` del
compose tiene su propio healthcheck y `backend` depende de él en condiciones de salud,
así que si la base está caída el contenedor de la base lo informa y este endpoint sigue
diciendo que el proceso de aplicación está vivo.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Verificación de salud")
def health() -> HealthResponse:
    """Responde que el servicio está disponible. No expone nada del entorno."""
    return HealthResponse(status="ok", service="techacademyba-backend")
