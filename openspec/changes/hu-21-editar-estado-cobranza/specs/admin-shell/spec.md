# Spec Delta

## MODIFIED Requirements

### Requirement: Cobranzas: registro de pago manual e historial de ingresos

The system SHALL mostrar el bloque `Registrar Cobranza Manual` como un formulario embebido en la pantalla y no como ventana modal, con los campos en este orden literal: `Fecha Pago`, `Importe Cobrado (AR$)`, `Medio de Pago` como selección, `Titular del Comprobante`, `Alumno a Imputar Pago` como selección con búsqueda, `Estado Inicial` como selección, la casilla `El titular solicita Factura tipo A con CUIT vinculada` y el botón `Registrar Cobro`. El formulario SHALL hacer explícito que el pagador y el beneficiario son cosas distintas: el `Titular del Comprobante` puede ser un tercero o una empresa ajena al padrón y el pago se imputa al `Alumno a Imputar Pago`, que es quien queda reflejado en su legajo.

El sistema SHALL usar un único conjunto de rótulos de medio de pago, tomado del dominio, tanto en la selección del formulario como en la columna `MEDIO` del historial: `Transferencia`, `Efectivo`, `Cheque`, `Tarjeta`, `Billetera` y `Otro`. Esta normalización es intencional: el prototipo rotula los medios de forma distinta en el formulario y en la tabla, y se resuelve a favor del vocabulario del dominio.

The system SHALL mostrar el bloque `Historial de Ingresos Registrados` con una tabla cuyas columnas, en este orden literal, son `FECHA`, `TITULAR DEL PAGO`, `ALUMNO IMPUTADO`, `MEDIO`, `FACTURA A`, `IMPORTE`, `ESTADO GESTIÓN` y `ACCIONES`. La columna `ESTADO GESTIÓN` SHALL distinguir `ACREDITADO` en verde, `OBSERVADO` en ámbar y `RECHAZADO` en rojo, y la columna `FACTURA A` SHALL renderizarse como badge `A` o `B`.

La columna `ACCIONES` SHALL ofrecer `Editar estado` en todas las filas del historial. Esa acción SHALL abrir un modal con el nombre del titular, el alumno imputado, el importe, la fecha y el estado actual, un selector de nuevo estado que SHALL ofrecer únicamente los destinos válidos para el estado actual —`ACREDITADO → OBSERVADO | RECHAZADO`, `OBSERVADO → ACREDITADO | RECHAZADO` y `RECHAZADO → ACREDITADO`—, un campo de justificación obligatorio y una confirmación explícita antes de guardar. El modal SHALL mantener la identidad visual de la pantalla y SHALL NOT permitir editar el importe, el titular, la fecha ni la imputación.

WHEN el backend confirma el cambio, la fila del historial SHALL mostrar el estado nuevo y la acción SHALL dejar de ofrecerse. WHEN el backend rechaza el cambio, el modal SHALL mostrar el mensaje de error y la fila SHALL conservar su estado.

Las filas del maquetado son, en este orden: el 10/05/2026, titular Juan Ignacio Pérez, alumno imputado Juan Ignacio Pérez, `Transferencia`, factura `B`, `$45.000`, `ACREDITADO`; el 11/05/2026, titular Camila Rodríguez, alumno imputado Camila Rodríguez, `Transferencia`, factura `B`, `$31.000`, `ACREDITADO`; el 12/05/2026, titular Tech Solutions S.A., alumno imputado Tech Solutions S.A., `Transferencia`, factura `A`, `$240.000`, `ACREDITADO`; el 16/05/2026, titular Banco Federal, sin alumnos imputados, `Cheque`, factura `A`, `$390.000`, `OBSERVADO`; el 19/05/2026, titular un familiar de Agustina Benítez, alumno imputado Agustina Benítez, `Transferencia`, factura `B`, importe vacío, `OBSERVADO`; y el 21/05/2026, titular Valeria Rossi, alumno imputado Valeria Rossi, `Efectivo`, factura `B`, `$26.000`, `OBSERVADO`.

Dos filas del historial son los casos que el cliente tiene sin resolver y el maquetado SHALL representarlos sin limpiarlos. La fila del 19/05/2026 es el caso de pagador distinto del alumno: el comprobante que envió la familia de Agustina Benítez llegó ilegible, por eso el titular es un tercero, el alumno imputado es Agustina Benítez y el importe queda vacío porque nunca pudo leerse. La fila del 16/05/2026 no tiene alumno imputado porque el cheque sigue pendiente de acreditación y la empresa todavía no envió la nómina de sus empleados.

El acreditamiento automático de pagos queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin pantalla detrás.

#### Scenario: El usuario registra una cobranza
- **WHEN** el usuario completa `Fecha Pago`, `Importe Cobrado (AR$)` y `Medio de Pago`, elige el alumno a imputar y pulsa `Registrar Cobro`
- **THEN** el maquetado agrega una fila al `Historial de Ingresos Registrados` con esos datos

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

#### Scenario: El usuario busca la acreditación automática
- **WHEN** el usuario busca la acreditación automática de pagos
- **THEN** encuentra un ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

#### Scenario: Editar el estado de una cobranza observada
- **WHEN** el usuario abre una fila `OBSERVADO` y pulsa `Editar estado`
- **THEN** se abre un modal con el titular, el alumno imputado, el importe, la fecha y el estado actual, un selector que ofrece `ACREDITADO` y `RECHAZADO`, y un campo de justificación

#### Scenario: Corregir una cobranza acreditada por error
- **WHEN** el usuario abre una fila `ACREDITADO` y pulsa `Editar estado`
- **THEN** el modal ofrece `OBSERVADO` y `RECHAZADO` como únicos estados de destino y no ofrece `ACREDITADO`

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
