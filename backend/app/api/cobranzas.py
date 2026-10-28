"""Cobranzas manuales: alta y consulta (HU 21).

Todas las rutas son de Administración, igual que el padrón y las inscripciones. La lógica está en
`app/services/cobranzas.py`; acá solo se traduce el resultado a códigos HTTP y se evitan detalles
internos en los mensajes.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import Rol
from app.models.padron import Usuario
from app.schemas.cobranzas import (
    CobranzaCreate,
    CobranzaEstadoUpdate,
    CobranzaOut,
    ImputacionesCreate,
)
from app.services import cobranzas

router = APIRouter(prefix="/cobranzas", tags=["cobranzas"])

_solo_admin = require_roles(Rol.ADMIN)


@router.get("", response_model=list[CobranzaOut], summary="Consultar las cobranzas")
def listar_cobranzas(
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
    q: str | None = Query(default=None, max_length=160),
) -> list[CobranzaOut]:
    """Historial de ingresos, del más reciente al más viejo.

    `q` busca por coincidencia parcial del nombre del titular. La imputación y el pagador viajan
    resueltos para que la tabla no tenga que cruzar listados.
    """
    return [
        CobranzaOut.model_validate(cobranzas.serializar_cobranza(cobranza))
        for cobranza in cobranzas.listar_cobranzas(session, q)
    ]


@router.post(
    "",
    response_model=CobranzaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una cobranza manual",
)
def registrar_cobranza(
    cuerpo: CobranzaCreate,
    session: Annotated[Session, Depends(get_db)],
    _admin: Annotated[Usuario, Depends(_solo_admin)],
) -> CobranzaOut:
    """Registra el pago y lo imputa al alumno o lo reparte entre varios (HU 21 y HU 23).

    201 con la fila creada. 404 si el alumno, la inscripción o la empresa no existen; 422 si la
    inscripción no es del alumno, no está activa, falta elegir entre varias, no hay ninguna, la
    empresa no tiene contrato activo, la distribución supera el importe o los datos no cumplen las
    reglas. Los mensajes son de interfaz y no incluyen detalles de la base.
    """
    try:
        cobranza = cobranzas.crear_cobranza(session, cuerpo)
    except cobranzas.AlumnoNoEncontrado as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except cobranzas.InscripcionNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except cobranzas.EmpresaNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (
        cobranzas.EmpresaSinContrato,
        cobranzas.InscripcionDeOtroAlumno,
        cobranzas.InscripcionNoActiva,
        cobranzas.InscripcionNoDisponible,
        cobranzas.InscripcionAmbigua,
        cobranzas.CobranzaInvalida,
    ) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return CobranzaOut.model_validate(cobranzas.serializar_cobranza(cobranza))


@router.post(
    "/{cobranza_id}/imputaciones",
    response_model=CobranzaOut,
    summary="Imputar el saldo pendiente de una cobranza",
)
def agregar_imputaciones(
    cobranza_id: int,
    cuerpo: ImputacionesCreate,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Usuario, Depends(_solo_admin)],
) -> CobranzaOut:
    """Reparte el saldo sin imputar entre uno o varios destinos (HU 23).

    200 con la cobranza actualizada. 404 si la cobranza no existe; 422 si la distribución supera
    el saldo, si un importe no es positivo o si la inscripción o la empresa no son válidas. Las
    imputaciones anteriores se conservan y la cobranza no se duplica.
    """
    try:
        cobranza = cobranzas.agregar_imputaciones(session, cobranza_id, cuerpo, admin.id)
    except cobranzas.CobranzaNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (
        cobranzas.EmpresaNoEncontrada,
        cobranzas.EmpresaSinContrato,
        cobranzas.InscripcionNoEncontrada,
        cobranzas.InscripcionDeOtroAlumno,
        cobranzas.InscripcionNoActiva,
        cobranzas.ImputacionesExcedenSaldo,
        cobranzas.CobranzaInvalida,
    ) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return CobranzaOut.model_validate(cobranzas.serializar_cobranza(cobranza))


@router.patch(
    "/{cobranza_id}/estado",
    response_model=CobranzaOut,
    summary="Cambiar el estado de una cobranza",
)
def cambiar_estado_cobranza(
    cobranza_id: int,
    cuerpo: CobranzaEstadoUpdate,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Usuario, Depends(_solo_admin)],
) -> CobranzaOut:
    """Cambia el estado y/o completa el titular de la cobranza sin crear otro cobro.

    200 con la cobranza actualizada. 404 si no existe; 422 si la transición no está permitida, si
    el estado nuevo es el mismo sin otro dato, si falta la justificación de un cambio de estado o
    si se intenta cambiar un titular ya identificado. El titular solo se completa cuando quedó
    "Sin identificar", con o sin cambio de estado y sin justificación si el estado no cambia. El
    importe, la fecha y la imputación quedan como estaban, y el cambio queda auditado.
    """
    try:
        cobranza = cobranzas.cambiar_estado_cobranza(session, cobranza_id, cuerpo, admin.id)
    except cobranzas.CobranzaNoEncontrada as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except (
        cobranzas.CambioEstadoInvalido,
        cobranzas.TitularNoModificable,
        cobranzas.CobranzaInvalida,
    ) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    return CobranzaOut.model_validate(cobranzas.serializar_cobranza(cobranza))
