# Spec Delta

## ADDED Requirements

### Requirement: Forzado manual del estado de una inscripción

El sistema SHALL exponer `POST /inscripciones/{id}/habilitacion` solo para Administración. El
forzado SHALL aplicarse solo a esa inscripción, ser el estado contrario al automático y prevalecer
sobre la regla automática en toda consulta. El motivo es obligatorio, no vacío ni solo espacios. El
administrador sale de la sesión. Se persisten estado, motivo, usuario y fecha, con un único forzado
vigente por inscripción.

#### Scenario: Forzar HABILITADO sobre una inscripción bloqueada
- **WHEN** un administrador envía un motivo válido para una inscripción `ACTIVA` cuyo estado automático es `BLOQUEADO`
- **THEN** el sistema registra el forzado `HABILITADO` con usuario, fecha y motivo, y la consulta de habilitación devuelve `HABILITADO` identificado como forzado

#### Scenario: Forzar BLOQUEADO sobre una inscripción habilitada
- **WHEN** un administrador envía un motivo válido para una inscripción `ACTIVA` cuyo estado automático es `HABILITADO`
- **THEN** el sistema registra el forzado `BLOQUEADO` y la consulta de habilitación devuelve `BLOQUEADO` con el motivo como causa

#### Scenario: Motivo vacío
- **WHEN** el administrador envía un motivo vacío o compuesto solo por espacios
- **THEN** el sistema responde `422` y no crea ningún forzado

#### Scenario: Inscripción inexistente
- **WHEN** el administrador fuerza la habilitación de un `id` que no corresponde a ninguna inscripción
- **THEN** el sistema responde `404`

#### Scenario: Inscripción no activa
- **WHEN** el administrador intenta forzar la habilitación de una inscripción que no está `ACTIVA`
- **THEN** el sistema responde `409` y no crea ningún forzado

#### Scenario: Forzado ya vigente
- **WHEN** el administrador intenta forzar una inscripción que ya tiene un forzado vigente
- **THEN** el sistema responde `409` con un mensaje que indica que primero hay que quitar el forzado

#### Scenario: Estado igual al automático
- **WHEN** el administrador intenta forzar el mismo estado que la regla automática ya produce
- **THEN** el sistema responde `409` y no crea ningún forzado

#### Scenario: Forzado concurrente
- **WHEN** dos pedidos de forzado llegan a la vez para la misma inscripción
- **THEN** solo uno crea el forzado y el otro recibe `409`, sin dejar dos forzados vigentes

#### Scenario: Alcance por inscripción
- **WHEN** un alumno tiene dos inscripciones y el administrador fuerza una
- **THEN** la otra inscripción conserva su estado calculado automáticamente

#### Scenario: Roles y sesión
- **WHEN** un usuario sin sesión o con rol distinto de Administración llama al endpoint
- **THEN** el sistema responde `401` sin token y `403` con un rol no autorizado

#### Scenario: El forzado no altera el dinero
- **WHEN** se fuerza el estado de una inscripción
- **THEN** la categoría, los importes, el saldo, las cobranzas y las imputaciones quedan sin cambios

### Requirement: Retorno a la regla automática de habilitación

El sistema SHALL exponer `DELETE /inscripciones/{id}/habilitacion` solo para Administración para
desactivar el forzado vigente de esa inscripción. La fila histórica SHALL conservarse y el sistema
SHALL registrar en la auditoría quién quitó el forzado y cuándo. Después de quitarlo, el estado
SHALL volver a calcularse con las reglas automáticas vigentes, incluidas categoría, beca, importes y
cobranzas acreditadas.

#### Scenario: Quitar un forzado vigente
- **WHEN** el administrador quita el forzado de una inscripción que lo tiene
- **THEN** el forzado queda inactivo, se registra la auditoría con el usuario y la fecha, y la consulta de habilitación devuelve el estado automático actual

#### Scenario: El registro histórico se conserva
- **WHEN** se quita el forzado
- **THEN** la fila del forzado sigue existiendo con su estado, motivo, usuario y fecha, marcada como inactiva

#### Scenario: Sin forzado vigente
- **WHEN** el administrador intenta quitar el forzado de una inscripción que no lo tiene
- **THEN** el sistema responde `409` y no registra auditoría de quita

#### Scenario: Inscripción no activa al quitar
- **WHEN** el administrador quita el forzado de una inscripción que no está `ACTIVA`
- **THEN** el sistema responde `409`

#### Scenario: El acceso a clases respeta el estado efectivo
- **WHEN** un alumno tiene un forzado que lo habilita o lo bloquea
- **THEN** el acceso al link de la clase usa el estado efectivo y no el calculado automáticamente
