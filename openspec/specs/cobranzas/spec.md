# cobranzas Specification

## Purpose
Reparto del importe de una cobranza entre varios destinos, imputación posterior del saldo e
historial del alumno (historia #23). El modelo y sus restricciones siguen en `domain-schema`; acá
se fija el comportamiento observable de la API y de la pantalla.

## Requirements

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

### Requirement: Edición del estado de una cobranza

El sistema SHALL exponer `PATCH /cobranzas/{id}/estado` con rol `ADMIN`, que acepta `estado`, `titular` y `justificacion` y solo permite `ACREDITADO → OBSERVADO | RECHAZADO`, `OBSERVADO → ACREDITADO | RECHAZADO` y `RECHAZADO → ACREDITADO`. WHEN el cambio es válido SHALL responder 200 con la cobranza actualizada y persistir el estado nuevo, su autor, su fecha y una entrada de `audit_log`; en cualquier otro caso SHALL rechazarlo sin modificar la cobranza ni crear un cobro nuevo.

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
- **THEN** el importe, la fecha, el medio, el titular identificado y la imputación original quedan iguales y no aparecen una cobranza, un pagador ni una imputación nuevos

### Requirement: Completar el titular de un comprobante sin identificar

`PATCH /cobranzas/{id}/estado` SHALL aceptar `titular` como dato opcional, junto con `estado`,
para completar el titular de un comprobante registrado como `Sin identificar`. SHALL rechazar con
422 el intento de reescribir un titular ya identificado. SHALL permitir completar el titular sin
cambiar el estado y sin justificación; la justificación SHALL ser obligatoria solo cuando se
informa un estado. El cambio SHALL quedar en `audit_log` con el titular anterior y el nuevo.

#### Scenario: Completar el titular sin cambiar el estado
- **WHEN** se envía solo `titular`, sin estado ni justificación, sobre una cobranza `Sin identificar`
- **THEN** el sistema responde 200, actualiza el pagador y conserva el estado

#### Scenario: Completar el titular junto con el estado
- **WHEN** se envía `titular`, un estado válido y la justificación
- **THEN** el sistema responde 200, actualiza el titular y el estado, y audita las dos cosas

#### Scenario: Titular ya identificado
- **WHEN** se envía `titular` sobre una cobranza cuyo pagador ya tiene nombre
- **THEN** el sistema responde 422 y no modifica ni la cobranza ni el pagador

#### Scenario: Cuerpo sin estado ni titular
- **WHEN** el cuerpo incluye la justificación pero ni `estado` ni un `titular` con texto
- **THEN** el sistema responde 422

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
