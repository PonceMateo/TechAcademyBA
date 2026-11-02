# Spec Delta

## ADDED Requirements

### Requirement: Importes por inscripción en el detalle del alumno

El detalle `GET /alumnos/{id}` SHALL incluir por inscripción `arancel`, `monto_requerido`,
`total_pagado`, `total_observado` y `saldo_pendiente`. `monto_requerido` SHALL ser el arancel de la
comisión ajustado por la beca parcial, cero en beca total y nulo en corporativo. `total_pagado`
SHALL sumar solo las imputaciones acreditadas y `total_observado` las observadas.
`saldo_pendiente` SHALL ser la diferencia entre requerido y pagado, nunca negativa y nula en
corporativo.

#### Scenario: Particular con pago parcial

- **WHEN** una inscripción particular tiene un arancel de 50000 y un pago acreditado de 20000
- **THEN** el detalle informa `monto_requerido` 50000, `total_pagado` 20000 y `saldo_pendiente` 30000

#### Scenario: Beca parcial con descuento

- **WHEN** una inscripción de beca parcial del 50% tiene un arancel de 50000 y un pago acreditado de 10000
- **THEN** `monto_requerido` es 25000 y `saldo_pendiente` es 15000

#### Scenario: Beca total exenta

- **WHEN** la inscripción es de beca total
- **THEN** `monto_requerido` y `saldo_pendiente` son cero, sin importar el arancel de la comisión

#### Scenario: Corporativo a cargo de la empresa

- **WHEN** la inscripción es corporativa
- **THEN** `monto_requerido` y `saldo_pendiente` son nulos, y `total_pagado` informa lo imputado a esa inscripción

#### Scenario: Cobro observado

- **WHEN** una inscripción tiene un cobro observado y ningún cobro acreditado
- **THEN** `total_observado` lo suma, `total_pagado` sigue en cero y `saldo_pendiente` no baja

#### Scenario: Pago que supera el requerido

- **WHEN** lo acreditado supera el monto requerido de la inscripción
- **THEN** `saldo_pendiente` es cero y no se informa un saldo negativo

#### Scenario: El saldo coincide con el estado

- **WHEN** una inscripción con arancel 12345.67 y beca parcial de 33.33% tiene un pago acreditado de 8230.85
- **THEN** `monto_requerido` es 8230.86 —redondeado a centavos con `ROUND_HALF_UP`—, la inscripción figura bloqueada y `saldo_pendiente` es 0.01; con un pago de 8230.86 figura habilitada y el saldo es cero

#### Scenario: Cambio del arancel de la comisión

- **WHEN** se edita el arancel de la comisión y se vuelve a consultar el detalle
- **THEN** `monto_requerido` y `saldo_pendiente` reflejan el arancel nuevo, porque no hay precio guardado en la inscripción

#### Scenario: Dos inscripciones no mezclan importes

- **WHEN** el alumno tiene dos inscripciones con pagos distintos
- **THEN** cada inscripción informa su propio requerido, su pagado y su saldo, sin sumar los de la otra
