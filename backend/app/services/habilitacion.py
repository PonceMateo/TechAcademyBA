"""Derivación del estado de habilitación y de los importes de una inscripción (HU #27 y 61)."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.clases import OverrideHabilitacion
from app.models.cobranza import Cobranza, Imputacion
from app.models.enums import CategoriaInscripcion, EstadoCobranza, EstadoHabilitacion
from app.models.inscripciones import Empresa, Inscripcion

#: Los importes se muestran con dos decimales: el requerido se cuantiza antes de compararlo.
CENTAVOS = Decimal("0.01")


def derivar_montos(session: Session, inscripcion: Inscripcion) -> SimpleNamespace:
    """Arancel, requerido, pagado, observado y saldo de una inscripción (HU 61).

    Es la **única regla de dinero**: `derivar_estado` decide con el mismo `requerido` que la ficha
    muestra como saldo. El requerido se cuantiza a centavos con `ROUND_HALF_UP` porque la pantalla
    muestra dos decimales: sin eso, un arancel con centavos y una beca de dos decimales dejan
    fracciones que se leen como `$0,00` mientras el acceso sigue bloqueado.

    El saldo se deriva del importe **base** guardado en la inscripción —o del arancel actual cuando
    la fila es heredada y no lo tiene—, nunca es negativo y es nulo en corporativo. El descuento de
    beca se aplica siempre sobre ese base, así cambiar la categoría no deja un importe viejo. Lo
    observado no descuenta: se informa aparte. `causa`, `imputaciones` y `sin_acreditar` viajan acá
    porque el estado las necesita para explicar el bloqueo sin volver a leer las imputaciones.
    """
    categoria = inscripcion.categoria or CategoriaInscripcion.PARTICULAR.value
    comision = inscripcion.comision
    arancel = Decimal(comision.arancel) if comision is not None else Decimal(0)

    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        requerido: Decimal | None = None
    elif categoria == CategoriaInscripcion.BECADO_TOTAL.value:
        requerido = Decimal(0)
    else:
        # El importe guardado es el base prorrateado, sin descuento (D77). El descuento de la beca
        # se aplica siempre acá, sobre ese base, así un cambio de categoría no deja un monto viejo.
        requerido = (
            Decimal(inscripcion.importe_arancel)
            if inscripcion.importe_arancel is not None
            else arancel
        )
        if (
            categoria == CategoriaInscripcion.BECADO_PARCIAL.value
            and inscripcion.porcentaje_beca is not None
        ):
            descuento = Decimal(inscripcion.porcentaje_beca)
            requerido *= (Decimal(100) - descuento) / Decimal(100)
        requerido = requerido.quantize(CENTAVOS, rounding=ROUND_HALF_UP)

    imputaciones = list(
        session.scalars(select(Imputacion).where(Imputacion.inscripcion_id == inscripcion.id)).all()
    )
    acreditado = Decimal(0)
    observado = Decimal(0)
    sin_acreditar = 0
    causa: str | None = None
    for imputacion in imputaciones:
        cobranza = session.get(Cobranza, imputacion.cobranza_id)
        if cobranza is None:
            continue
        if cobranza.estado == EstadoCobranza.ACREDITADO.value:
            acreditado += Decimal(imputacion.monto)
            continue
        sin_acreditar += 1
        if cobranza.estado == EstadoCobranza.OBSERVADO.value:
            observado += Decimal(imputacion.monto)
            causa = cobranza.causa or "comprobante observado"
        elif cobranza.estado == EstadoCobranza.RECHAZADO.value:
            causa = cobranza.causa or "comprobante rechazado"

    saldo = None if requerido is None else max(requerido - acreditado, Decimal(0))

    return SimpleNamespace(
        arancel=arancel,
        requerido=requerido,
        acreditado=acreditado,
        observado=observado,
        saldo=saldo,
        causa=causa,
        imputaciones=len(imputaciones),
        sin_acreditar=sin_acreditar,
    )


def derivar_estado(
    session: Session,
    inscripcion: Inscripcion,
    montos: SimpleNamespace | None = None,
) -> tuple[str, str | None, bool]:
    """Devuelve `(estado, causa, forzado)` para una inscripción.

    `montos` permite reutilizar la derivación cuando quien llama ya la hizo (el detalle del alumno);
    si no viene, se calcula acá. El estado y el saldo salen siempre del mismo requerido.
    """
    override = session.scalar(
        select(OverrideHabilitacion).where(
            OverrideHabilitacion.inscripcion_id == inscripcion.id,
            OverrideHabilitacion.activo.is_(True),
        ).order_by(OverrideHabilitacion.fecha.desc())
    )
    if override is not None:
        return (override.estado_forzado, override.motivo, True)

    categoria = inscripcion.categoria or CategoriaInscripcion.PARTICULAR.value

    if categoria == CategoriaInscripcion.BECADO_TOTAL.value:
        return (EstadoHabilitacion.HABILITADO.value, None, False)

    if montos is None:
        montos = derivar_montos(session, inscripcion)

    if categoria == CategoriaInscripcion.CORPORATIVO.value:
        empresa = session.get(Empresa, inscripcion.empresa_id) if inscripcion.empresa_id else None
        if empresa is None:
            return (EstadoHabilitacion.BLOQUEADO.value, "falta la empresa", False)
        if montos.sin_acreditar:
            return (EstadoHabilitacion.BLOQUEADO.value, "empresa impaga", False)
        return (EstadoHabilitacion.HABILITADO.value, None, False)

    # Particular o becado parcial.
    if montos.acreditado >= montos.requerido and montos.requerido > 0:
        return (EstadoHabilitacion.HABILITADO.value, None, False)
    if montos.causa is not None:
        return (EstadoHabilitacion.BLOQUEADO.value, montos.causa, False)
    if montos.imputaciones == 0:
        return (EstadoHabilitacion.BLOQUEADO.value, "pago pendiente", False)
    return (EstadoHabilitacion.BLOQUEADO.value, "saldo pendiente", False)
