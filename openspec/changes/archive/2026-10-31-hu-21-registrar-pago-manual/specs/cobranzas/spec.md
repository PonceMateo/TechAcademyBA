# Spec Delta

## Purpose

Registro manual y consulta de cobranzas contra PostgreSQL (historia #21). El modelo y sus
restricciones viven en `domain-schema`; acá se fija el comportamiento observable de la API.

## ADDED Requirements

### Requirement: Registro manual de una cobranza

El sistema SHALL exponer `POST /cobranzas` con rol `ADMIN`. El cuerpo SHALL aceptar `fecha`,
`importe`, `medio`, `titular`, `estado`, `causa`, `alumno_id`, `inscripcion_id`,
`factura_a_solicitada` y `cuit_titular`, y SHALL rechazar con 422 cualquier otro campo. WHEN el
alta es exitosa el sistema SHALL responder 201 con la cobranza creada y sus datos resueltos.

#### Scenario: Pago registrado
- **WHEN** se envía fecha, importe mayor a cero, medio de pago y titular
- **THEN** el sistema crea el `Pagador` y la `Cobranza` en una transacción y responde 201 con el pago

#### Scenario: Datos obligatorios faltantes
- **WHEN** se omite fecha, importe, medio o titular
- **THEN** el sistema responde 422 y no crea ninguna fila

#### Scenario: Importe inválido
- **WHEN** se envía un importe menor o igual a cero
- **THEN** el sistema responde 422 y no crea ninguna fila

#### Scenario: Fecha futura
- **WHEN** se envía una fecha posterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** el sistema responde 422 y no crea ninguna fila

### Requirement: Imputación a una inscripción activa

WHEN la cobranza informa `alumno_id` o `inscripcion_id`, el sistema SHALL imputar el importe
completo a una inscripción `ACTIVA` del alumno. La inscripción SHALL pertenecer al alumno y el
sistema SHALL rechazar con 422 una inscripción inexistente, de otro alumno o inactiva. Si no se
informa `inscripcion_id` y el alumno tiene exactamente una inscripción activa, el sistema SHALL
usarla; con cero o varias SHALL responder 422. Sin alumno, la cobranza SHALL guardarse sin
imputación.

#### Scenario: Imputación correcta
- **WHEN** se registra un pago con un alumno y una de sus inscripciones activas
- **THEN** la respuesta incluye la imputación y la fila queda asociada a esa inscripción

#### Scenario: Varias inscripciones sin elegir
- **WHEN** el alumno tiene más de una inscripción activa y no se informa `inscripcion_id`
- **THEN** el sistema responde 422 y no registra el pago

#### Scenario: Sin inscripción activa
- **WHEN** el alumno no tiene inscripciones activas
- **THEN** el sistema responde 422 e informa que no hay una inscripción disponible

### Requirement: Solicitud de Factura A

WHEN `factura_a_solicitada` es verdadero, el sistema SHALL exigir un `cuit_titular` válido y
SHALL guardar la solicitud en la cobranza y el CUIT en el pagador. El sistema SHALL NOT crear
registros `Factura` en esta historia. WHEN no se solicita Factura A, el sistema SHALL NOT exigir
CUIT ni asumir Factura B.

#### Scenario: Factura A solicitada con CUIT válido
- **WHEN** se marca la solicitud y se informa un CUIT con dígito verificador correcto
- **THEN** la cobranza queda con `factura_a_solicitada` en verdadero y el CUIT en el pagador

#### Scenario: Factura A sin CUIT
- **WHEN** se marca la solicitud sin CUIT o con un CUIT inválido
- **THEN** el sistema responde 422 y no registra la cobranza

### Requirement: Consulta del historial

El sistema SHALL exponer `GET /cobranzas` con rol `ADMIN`, ordenado por fecha e id
descendente, con pagador e imputación resueltos. SHALL aceptar `q` para buscar por coincidencia
parcial del nombre del titular. Sin token SHALL responder 401 y con un rol distinto de ADMIN,
403.

#### Scenario: Recuperar el pago registrado
- **WHEN** se registra un pago y después se consulta el historial
- **THEN** la respuesta incluye el pago con su pagador, importe, medio, estado e imputación

#### Scenario: Buscar por titular
- **WHEN** se consulta con un fragmento del nombre del titular
- **THEN** la respuesta incluye solo las cobranzas cuyo titular coincide parcialmente

#### Scenario: Consulta restringida
- **WHEN** se consulta sin token o con un rol que no es ADMIN
- **THEN** el sistema responde 401 o 403 según corresponda
