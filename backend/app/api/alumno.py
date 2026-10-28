"""Rutas del propio alumno (HU 23).

Solo rol `ALUMNO`. El legajo sale del usuario autenticado (`usuario.alumno_id`), nunca de un
parámetro: pedir el historial de otro alumno no es una consulta que esta ruta acepte. La lógica
está en `app/services/cobranzas.py`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.cobranzas import PagoAlumnoOut
from app.services import cobranzas

router = APIRouter(prefix="/alumno", tags=["alumno"])

_solo_alumno = require_roles(Rol.ALUMNO)


@router.get("/pagos", response_model=list[PagoAlumnoOut], summary="Consultar mis pagos")
def listar_mis_pagos(
    session: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(_solo_alumno)],
) -> list[PagoAlumnoOut]:
    """Comprobantes imputados al legajo del alumno que entra, del más reciente al más viejo.

    `importe` es lo que se le imputó a él: si el pago se repartió entre varios alumnos, cada uno ve
    su parte. Un comprobante sin imputar a su legajo no aparece. Sin token responde 401 y con otro
    rol, 403.
    """
    return [
        PagoAlumnoOut.model_validate(
            cobranzas.serializar_pago_de_alumno(cobranza, usuario.alumno_id)
        )
        for cobranza in cobranzas.listar_pagos_de_alumno(session, usuario.alumno_id)
    ]
