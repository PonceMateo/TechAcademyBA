# Spec Delta

## ADDED Requirements

### Requirement: Edición del estado de una cobranza

El sistema SHALL exponer `PATCH /cobranzas/{id}/estado` con rol `ADMIN`, que acepta `estado` y `justificacion` y solo permite `ACREDITADO → OBSERVADO | RECHAZADO`, `OBSERVADO → ACREDITADO | RECHAZADO` y `RECHAZADO → ACREDITADO`. WHEN el cambio es válido SHALL responder 200 con la cobranza actualizada y persistir el estado nuevo, su autor, su fecha y una entrada de `audit_log`; en cualquier otro caso SHALL rechazarlo sin modificar la cobranza ni crear un cobro nuevo.

#### Scenario: Acreditar una cobranza observada
- **WHEN** un administrador envía `ACREDITADO` y una justificación sobre una cobranza `OBSERVADO`
- **THEN** el sistema responde 200 con la cobranza en `ACREDITADO`, con el pagador y la imputación resueltos, y el estado queda persistido en PostgreSQL

#### Scenario: Acreditar una cobranza rechazada
- **WHEN** un administrador envía `ACREDITADO` y una justificación sobre una cobranza `RECHAZADO`
- **THEN** el sistema responde 200 con la cobranza en `ACREDITADO`, registra el administrador y la fecha en `estado_cambiado_por` y `estado_cambiado_at`, y el estado queda persistido en PostgreSQL

#### Scenario: Observar una cobranza acreditada por error
- **WHEN** un administrador envía `OBSERVADO` y una justificación sobre una cobranza `ACREDITADO`
- **THEN** el sistema responde 200, la cobranza queda en `OBSERVADO` con la justificación como causa y deja de contar como pago acreditado

#### Scenario: Rechazar una cobranza acreditada por error
- **WHEN** un administrador envía `RECHAZADO` y una justificación sobre una cobranza `ACREDITADO`
- **THEN** el sistema responde 200 y la cobranza queda en `RECHAZADO` con la justificación como causa

#### Scenario: Rechazar una cobranza observada
- **WHEN** un administrador envía `RECHAZADO` y una justificación sobre una cobranza `OBSERVADO`
- **THEN** el sistema responde 200 y la cobranza queda en `RECHAZADO` con la justificación como causa

#### Scenario: Historial de la modificación
- **WHEN** se cambia el estado de una cobranza
- **THEN** queda una entrada de `audit_log` con la cobranza, el estado anterior, el estado nuevo, la fecha y hora, el administrador y la justificación, en la misma transacción que el estado nuevo

#### Scenario: Cambio al mismo estado
- **WHEN** un administrador envía el estado que la cobranza ya tiene
- **THEN** el sistema responde 422, no cambia la cobranza y no agrega una entrada de auditoría

#### Scenario: Transición no permitida
- **WHEN** un administrador pide una combinación fuera de las cinco transiciones, por ejemplo `RECHAZADO → OBSERVADO`
- **THEN** el sistema responde 422 y la cobranza conserva su estado

#### Scenario: Justificación faltante
- **WHEN** el cuerpo no incluye `justificacion`, la envía vacía o incluye un campo desconocido
- **THEN** el sistema responde 422 y la cobranza conserva su estado

#### Scenario: Cobranza inexistente
- **WHEN** se envía el cambio sobre un identificador que no existe
- **THEN** el sistema responde 404

#### Scenario: Operación no autorizada
- **WHEN** la petición llega sin sesión o con un rol distinto de `ADMIN`
- **THEN** el sistema responde 401 o 403 y no modifica ninguna cobranza

#### Scenario: Importe e imputación intactos
- **WHEN** se cambia el estado de una cobranza imputada a una inscripción
- **THEN** el importe, el titular, la fecha, el medio y la imputación original quedan iguales y no aparecen una cobranza, un pagador ni una imputación nuevos
