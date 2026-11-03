# Proposal

## Why

La inscripción actual guarda la categoría, pero no calcula cuánto debe abonar un alumno que se
incorpora después del inicio de la comisión. Esto hace que una alta tardía pueda cobrar el arancel
completo aunque el alumno solo curse una parte del período.

## What Changes

- Calcular el importe de una inscripción particular según las clases restantes del período.
- Usar la fórmula `arancel de la comisión × clases restantes / cantidad total de clases`.
- Persistir el importe calculado en la inscripción, redondeado a centavos.
- Mantener el arancel completo cuando la inscripción se realiza antes o el mismo día del inicio.
- Rechazar o informar que no se pudo prorratear cuando la comisión no tiene período o clases
  computables, sin inventar un importe.
- Exponer el importe calculado en la respuesta de inscripción y en las consultas que muestran la
  inscripción.
- Aplicar el porcentaje de beca después de calcular el importe proporcional de las clases restantes.
- Mantener fuera del prorrateo de comisión las inscripciones corporativas, cuyo importe depende del
  contrato empresarial.

## Capabilities

### New Capabilities

### Modified Capabilities

- `domain-schema`: las inscripciones deben conservar el importe arancelario calculado y aplicar el
  prorrateo por clases restantes para altas particulares tardías.

## Impact

- Modelo y migración de `inscripcion`.
- Servicio, esquema y endpoint de creación de inscripciones.
- Pruebas backend de fechas, períodos sin clases, redondeo y categorías.
- Consultas y frontend que muestran el detalle económico de una inscripción.
- No se modifican comisiones ni se recalculan importes históricos cuando cambia su período.
