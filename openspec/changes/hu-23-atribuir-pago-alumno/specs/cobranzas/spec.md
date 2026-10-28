# Spec Delta

## Purpose

Reparto del importe de una cobranza entre varios destinos, imputación posterior del saldo e
historial del alumno (historia #23). El modelo y sus restricciones siguen en `domain-schema`; acá
se fija el comportamiento observable de la API y de la pantalla.

## ADDED Requirements

### Requirement: Distribución de una cobranza entre varios alumnos

`POST /cobranzas` SHALL aceptar `imputaciones`, una lista no vacía de `{inscripcion_id |
empresa_id, monto}`, como alternativa a `alumno_id`/`inscripcion_id`. Cada destino SHALL ser
exactamente uno de los dos y cada `monto` SHALL ser mayor a cero. La suma de las imputaciones SHALL
NOT superar el `importe` de la cobranza y un mismo destino SHALL NOT repetirse en el pedido. Un
destino SHALL resolverse a una inscripción `ACTIVA` o a una empresa activa con contrato
corporativo `ACTIVO`.

#### Scenario: Pago repartido
- **WHEN** se registra una cobranza de $120.000 con tres imputaciones de $50.000, $40.000 y $30.000
- **THEN** se crea una sola cobranza con tres imputaciones y saldo sin imputar $0

#### Scenario: Reparto parcial
- **WHEN** el importe es $120.000 y se imputan $70.000
- **THEN** la cobranza queda con una imputación y un saldo sin imputar de $50.000

#### Scenario: Distribución que supera el importe
- **WHEN** la suma de las imputaciones supera el importe cobrado
- **THEN** el sistema responde 422 y no crea ninguna fila

#### Scenario: Importe imputado inválido
- **WHEN** un monto es cero o negativo
- **THEN** el sistema responde 422 y no crea ninguna fila

#### Scenario: Pago sin imputar
- **WHEN** no se informa alumno ni imputaciones
- **THEN** la cobranza se registra con `imputaciones` vacío y todo el importe como saldo

### Requirement: Imputación posterior del saldo

El sistema SHALL exponer `POST /cobranzas/{id}/imputaciones` con rol `ADMIN` y el mismo cuerpo
`imputaciones`. SHALL imputar solo el saldo disponible, bloquear la cobranza para serializar
operaciones simultáneas y conservar las imputaciones anteriores sin crear otra cobranza. SHALL
responder 404 si la cobranza no existe y 422 si la suma supera el saldo o un destino no es válido.
El cambio SHALL quedar registrado en `audit_log`.

#### Scenario: Reparto posterior
- **WHEN** una cobranza sin imputar recibe $50.000 y después $20.000
- **THEN** quedan dos imputaciones y el saldo baja de $70.000 a $50.000

#### Scenario: Sobreimputación
- **WHEN** el pedido supera el saldo sin imputar
- **THEN** el sistema responde 422 y no agrega ninguna imputación

### Requirement: Historial de pagos del alumno

El sistema SHALL exponer `GET /alumno/pagos` con rol `ALUMNO`. SHALL devolver solo las cobranzas
con al menos una imputación a una inscripción del usuario autenticado y SHALL informar en `importe`
lo imputado a su legajo. Sin token SHALL responder 401 y con otro rol, 403.

#### Scenario: Pago repartido visto por cada alumno
- **WHEN** una cobranza se reparte entre dos alumnos por $50.000 y $40.000
- **THEN** cada alumno ve en su historial únicamente su parte

#### Scenario: Acceso de otro rol
- **WHEN** un administrador o un docente consulta el historial del alumno
- **THEN** el sistema responde 403
