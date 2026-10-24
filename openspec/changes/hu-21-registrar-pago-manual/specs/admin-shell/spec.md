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
