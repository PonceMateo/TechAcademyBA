# Spec Delta

## MODIFIED Requirements

### Requirement: Cobranzas: registro de pago manual e historial de ingresos

The system SHALL mostrar el bloque `Registrar Cobranza Manual` como un formulario embebido en la
pantalla y no como ventana modal, con los campos en este orden literal: `Fecha Pago`,
`Importe Cobrado (AR$)`, `Medio de Pago` como selección, `Titular del Comprobante`,
`Alumno a Imputar Pago` como selección con búsqueda, `Estado Inicial` como selección, la casilla
`El titular solicita Factura tipo A con CUIT vinculada` y el botón `Registrar Cobro`. WHEN el
alumno elegido tiene más de una inscripción activa, la pantalla SHALL mostrar un selector
`Comisión a Imputar`; con una sola SHALL informar cuál se usará; sin ninguna SHALL bloquear el
registro imputado e informar el motivo. WHEN la casilla de Factura A está marcada, la pantalla
SHALL pedir el `CUIT del Titular` y SHALL NOT emitir una factura.

El sistema SHALL usar un único conjunto de rótulos de medio de pago, tomado del dominio, tanto en
la selección del formulario como en la columna `MEDIO` del historial: `Transferencia`, `Efectivo`,
`Cheque`, `Tarjeta`, `Billetera` y `Otro`.

The system SHALL mostrar el bloque `Historial de Ingresos Registrados` con una tabla cuyas
columnas, en este orden literal, son `FECHA`, `TITULAR DEL PAGO`, `ALUMNO IMPUTADO`, `MEDIO`,
`FACTURA A`, `IMPORTE` y `ESTADO GESTIÓN`. La columna `FACTURA A` SHALL mostrar `A` solo cuando
se solicitó Factura A y `—` en los demás casos; SHALL NOT mostrar `B` por defecto. La columna
`ESTADO GESTIÓN` SHALL distinguir `ACREDITADO` en verde, `OBSERVADO` en ámbar y `RECHAZADO` en
rojo. El historial SHALL recuperarse de `GET /cobranzas` y SHALL refrescarse después de un alta
exitosa. SHALL permitir buscar por nombre del titular con coincidencias parciales.

#### Scenario: El usuario registra una cobranza
- **WHEN** el usuario completa fecha, importe, medio, elige la inscripción y pulsa `Registrar Cobro`
- **THEN** el pago se guarda en PostgreSQL, el historial se recarga y la fila aparece con esos datos

#### Scenario: El backend rechaza el alta
- **WHEN** el backend responde con un error
- **THEN** la pantalla muestra el motivo, no agrega la fila y no confirma el registro

#### Scenario: Fecha futura
- **WHEN** el usuario ingresa una fecha posterior a hoy
- **THEN** la pantalla no envía el formulario e informa que la fecha no puede ser futura

#### Scenario: Alumno con varias inscripciones
- **WHEN** el usuario elige un alumno con más de una inscripción activa
- **THEN** la pantalla muestra el selector de comisión y exige elegir una antes de registrar

#### Scenario: Alumno sin inscripciones
- **WHEN** el usuario elige un alumno sin inscripciones activas
- **THEN** la pantalla informa que no hay inscripción disponible y no registra el pago imputado

#### Scenario: Solicitud de Factura A
- **WHEN** el usuario marca la casilla de Factura A
- **THEN** aparece el campo CUIT del titular y el historial muestra `A` si el alta prospera

#### Scenario: El usuario busca la acreditación automática
- **WHEN** el usuario busca la acreditación automática de pagos
- **THEN** encuentra un ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

#### Scenario: Falta la justificación
- **WHEN** el usuario intenta continuar sin escribir la justificación
- **THEN** el modal no avanza a la confirmación y señala que la justificación es obligatoria

#### Scenario: Confirmación antes de guardar
- **WHEN** el usuario escribe la justificación y pide continuar
- **THEN** el modal muestra la confirmación con el estado actual, el estado nuevo y la justificación, y solo guarda al confirmarla

#### Scenario: La actualización se refleja en el historial
- **WHEN** el backend responde con éxito
- **THEN** la fila muestra el estado nuevo con su color y su causa, y la acción sigue disponible con los destinos válidos de ese estado

#### Scenario: La actualización falla
- **WHEN** el backend rechaza el cambio
- **THEN** el modal muestra el mensaje de error y la fila conserva su estado anterior

#### Scenario: El titular del comprobante no es el alumno
- **WHEN** el usuario carga un pago cuyo `Titular del Comprobante` es un tercero o una empresa que no está en el padrón
- **THEN** la pantalla deja claro que el titular es distinto del beneficiario, el pago se imputa al `Alumno a Imputar Pago` y el tercero no se agrega al padrón de alumnos

#### Scenario: Faltan datos obligatorios
- **WHEN** el usuario intenta registrar un cobro sin `Fecha Pago`, sin importe o sin `Medio de Pago`
- **THEN** el maquetado no registra el pago e indica los campos faltantes

#### Scenario: El usuario revisa el historial
- **WHEN** un usuario de Secretaría abre `Historial de Ingresos Registrados`
- **THEN** ve las columnas `FECHA`, `TITULAR DEL PAGO`, `ALUMNO IMPUTADO`, `MEDIO`, `FACTURA A`, `IMPORTE`, `ESTADO GESTIÓN` y `ACCIONES`, con las seis filas del maquetado y `ACREDITADO`, `OBSERVADO` y `RECHAZADO` en colores distintos

#### Scenario: El usuario revisa el comprobante ilegible
- **WHEN** el usuario mira la fila del 19/05/2026
- **THEN** ve que el titular es un familiar de Agustina Benítez, que el alumno imputado es Agustina Benítez, que el importe está vacío y que el estado es `OBSERVADO` en ámbar

#### Scenario: El usuario revisa el cheque sin alumnos imputados
- **WHEN** el usuario mira la fila del 16/05/2026
- **THEN** ve la columna `ALUMNO IMPUTADO` vacía y el estado `OBSERVADO`, porque el cheque sigue pendiente de acreditación

#### Scenario: El usuario compara los medios de pago
- **WHEN** el usuario abre la selección `Medio de Pago` y luego mira la columna `MEDIO` del historial
- **THEN** ve el mismo conjunto de rótulos en ambos lugares y no encuentra etiquetas divergentes como `Cheque Corp`

#### Scenario: Editar el estado de una cobranza observada
- **WHEN** el usuario abre una fila `OBSERVADO` y pulsa `Editar estado`
- **THEN** se abre un modal con el titular, el alumno imputado, el importe, la fecha y el estado actual, un selector que ofrece `ACREDITADO` y `RECHAZADO`, y un campo de justificación

#### Scenario: Corregir una cobranza acreditada por error
- **WHEN** el usuario abre una fila `ACREDITADO` y pulsa `Editar estado`
- **THEN** el modal ofrece `OBSERVADO` y `RECHAZADO` como únicos estados de destino y no ofrece `ACREDITADO`
