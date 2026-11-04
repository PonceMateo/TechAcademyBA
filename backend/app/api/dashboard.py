"""Tablero de Administración (H/U 55).

**El rol se exige con `require_roles`** y el agregado se arma en el servicio. Esta capa solo
traduce a HTTP, como el resto de los routers (D1).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.dashboard import DashboardAdminOut
from app.services import dashboard

router = APIRouter(prefix="/admin", tags=["dashboard"])

_solo_admin = require_roles(Rol.ADMIN)


@router.get(
    "/dashboard",
    response_model=DashboardAdminOut,
    summary="Consultar el tablero de Administración",
)
def obtener_dashboard(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> DashboardAdminOut:
    """Indicadores, cobros por mes, ocupación, comprobantes recientes y agenda."""
    return dashboard.obtener_dashboard(session)
