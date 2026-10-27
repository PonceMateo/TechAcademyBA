"""Derivación del estado de habilitación (HU #27)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.clases import OverrideHabilitacion
from app.models.cobranza import Cobranza, Imputacion
from app.models.enums import CategoriaInscripcion, EstadoCobranza, EstadoHabilitacion
from app.models.inscripciones import Empresa, Inscripcion


def derivar_estado(session: Session, inscripcion: Inscripcion) -> tuple[str, str | None, bool]:
    """Devuelve `(estado, causa, forzado)` para una inscripción."""
    override = session.scalar(
        select(OverrideHabilitacion).where(
            OverrideHabilitacion.inscripcion_id == inscripcion.id,
            OverrideHabilitacion.activo.is_(True),
        ).order_by(OverrideHabilitacion.fecha.desc())
    )
    if override is not None:
        return (override.estado_forzado, override.motivo, True)

    categoria = inscripcion.categoria or CategoriaInscripcion.PARTICULAR.value
    comision = inscripcion.comision
    arancel = Decimal(comision.arancel) if comision is not None else Decimal(0)

    if categoria == CategoriaInscripcion.BECADO_TOTAL.value:
        return (EstadoHabilitacion.HABILITADO.value, None, False)

    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        empresa = session.get(Empresa, inscripcion.empresa_id) if inscripcion.empresa_id else None
        if empresa is None:
            return (EstadoHabilitacion.BLOQUEADO.value, "falta la empresa", False)
        imputaciones = session.scalars(
            select(Imputacion).where(Imputacion.inscripcion_id == inscripcion.id)
        ).all()
        if any(
            session.get(Cobranza, imp.cobranza_id) is not None
            and session.get(Cobranza, imp.cobranza_id).estado != EstadoCobranza.ACREDITADO.value
            for imp in imputaciones
        ):
            return (EstadoHabilitacion.BLOQUEADO.value, "empresa impaga", False)
        return (EstadoHabilitacion.HABILITADO.value, None, False)

    # Particular o becado parcial.
    if (
        categoria == CategoriaInscripcion.BECADO_PARCIAL.value
        and inscripcion.porcentaje_beca is not None
    ):
        descuento = Decimal(inscripcion.porcentaje_beca)
        requerido = arancel * (Decimal(100) - descuento) / Decimal(100)
    else:
        requerido = arancel

    imputaciones = list(
        session.scalars(select(Imputacion).where(Imputacion.inscripcion_id == inscripcion.id)).all()
    )
    acreditado = Decimal(0)
    causa: str | None = None
    for imp in imputaciones:
        cobranza = session.get(Cobranza, imp.cobranza_id)
        if cobranza is None:
            continue
        if cobranza.estado == EstadoCobranza.ACREDITADO.value:
            acreditado += Decimal(imp.monto)
        elif cobranza.estado == EstadoCobranza.OBSERVADO.value:
            causa = cobranza.causa or "comprobante observado"
        elif cobranza.estado == EstadoCobranza.RECHAZADO.value:
            causa = cobranza.causa or "comprobante rechazado"

    if acreditado >= requerido and requerido > 0:
        return (EstadoHabilitacion.HABILITADO.value, None, False)
    if causa is not None:
        return (EstadoHabilitacion.BLOQUEADO.value, causa, False)
    if not imputaciones:
        return (EstadoHabilitacion.BLOQUEADO.value, "pago pendiente", False)
    return (EstadoHabilitacion.BLOQUEADO.value, "saldo pendiente", False)
