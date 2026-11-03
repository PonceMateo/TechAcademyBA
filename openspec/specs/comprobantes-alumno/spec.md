# comprobantes-alumno Specification

## Purpose
Envío del comprobante de pago por parte del alumno autenticado, almacenamiento privado del
adjunto, consulta por parte del alumno y de Secretaría, y garantía de que el envío no acredita el
pago ni modifica la habilitación (HU 52).

## Requirements

### Requirement: Registro independiente del comprobante del alumno

El sistema SHALL guardar cada comprobante enviado en la entidad independiente
`comprobante_alumno`, sin crear ni modificar una `cobranza`, un `pagador` ni una `imputación` al
recibirlo. La entidad SHALL registrar el alumno autenticado, la inscripción a imputar, la fecha del
pago, el importe, el medio de pago, el titular opcional, la solicitud de Factura A, el CUIT cuando
corresponda, la referencia del archivo, el estado y la fecha y hora del envío. El estado inicial
visible SHALL ser `PENDIENTE_REVISION`. La resolución administrativa SHALL registrarse en la misma
entidad con el estado `ACEPTADO`, `OBSERVADO` o `RECHAZADO`, el administrador, la fecha y el motivo
cuando corresponda. El reenvío de un comprobante observado SHALL ser una fila nueva que apunte al
original.

#### Scenario: Envío válido
- **WHEN** un alumno autenticado envía un comprobante con una inscripción propia y activa, fecha pasada, importe mayor a cero, medio de pago válido y un archivo permitido
- **THEN** el sistema responde con el comprobante en estado `PENDIENTE_REVISION`, con fecha de envío, y lo persiste en PostgreSQL

#### Scenario: Sin titular identificado
- **WHEN** el alumno no informa el titular
- **THEN** el comprobante se guarda con el titular nulo y el sistema no asume que pagó el alumno

#### Scenario: Sin cobranza ni imputación
- **WHEN** se registra un comprobante válido
- **THEN** no se crea ninguna cobranza, pagador ni imputación y no se modifica ningún saldo acreditado

#### Scenario: Envío y habilitación
- **WHEN** un alumno envía un comprobante y su inscripción estaba bloqueada
- **THEN** el estado de habilitación y el estado de la inscripción quedan iguales

#### Scenario: Resolución registrada
- **WHEN** un administrador acepta, observa o rechaza un comprobante
- **THEN** el comprobante queda en el estado nuevo con el administrador y la fecha de resolución, y con el motivo cuando no fue aceptado

### Requirement: Validaciones del envío

`POST /alumno/comprobantes` SHALL exigir rol `ALUMNO` y tomar el alumno de la sesión. La
inscripción SHALL ser propia y `ACTIVA`; la fecha SHALL NOT ser futura; el importe SHALL ser mayor
a cero; el medio SHALL ser válido; el CUIT SHALL ser obligatorio y válido con Factura A y SHALL
rechazarse sin ella. Los rechazos SHALL ser `422` con el dato a corregir, `401` sin sesión y `403`
con otro rol.

#### Scenario: Inscripción ajena
- **WHEN** el alumno envía el comprobante con la inscripción de otro alumno
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: Inscripción inactiva
- **WHEN** el alumno envía el comprobante con una inscripción propia que no está `ACTIVA`
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: Fecha futura
- **WHEN** la fecha del pago es posterior al día corriente
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: Importe inválido
- **WHEN** el importe es cero, negativo o no es un decimal
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: Factura A sin CUIT
- **WHEN** se solicita Factura A sin CUIT o con un CUIT de dígito verificador inválido
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: CUIT sin Factura A
- **WHEN** se informa un CUIT sin solicitar Factura A
- **THEN** el sistema responde 422 y no crea el comprobante

#### Scenario: Usuario sin sesión
- **WHEN** se llama al envío o a la consulta sin token
- **THEN** el sistema responde 401 y no crea ni devuelve comprobantes

#### Scenario: Rol distinto de alumno
- **WHEN** un administrador o un docente intenta enviar un comprobante como alumno
- **THEN** el sistema responde 403

### Requirement: Archivo permitido y verificado

El sistema SHALL aceptar únicamente archivos PDF, JPG y PNG de hasta 5 MB. SHALL validar el
contenido real del archivo almacenado y no solo su extensión o `Content-Type`. SHALL rechazar
archivos vacíos, corruptos, truncados, no reconocidos o mayores al límite, con `422` o `413` y un
mensaje claro. Recién después de verificar el objeto almacenado SHALL confirmar el comprobante.

#### Scenario: Formatos permitidos
- **WHEN** se sube un PDF, un JPG o un PNG con contenido válido de hasta 5 MB
- **THEN** el archivo se verifica y el comprobante queda en `PENDIENTE_REVISION`

#### Scenario: Extensión permitida con contenido inválido
- **WHEN** se sube un archivo llamado `comprobante.pdf` cuyo contenido no es un PDF
- **THEN** el sistema responde 422, borra el objeto y no deja un comprobante pendiente

#### Scenario: Archivo superior al límite
- **WHEN** el archivo supera los 5 MB
- **THEN** el sistema responde 413 y no confirma el comprobante

#### Scenario: Archivo vacío
- **WHEN** se sube un archivo sin contenido
- **THEN** el sistema responde 422 y no confirma el comprobante

### Requirement: Almacenamiento privado y sin fallback insegura

El sistema SHALL guardar los comprobantes en un espacio privado, fuera del repositorio y sin
servido estático. En desarrollo SHALL usar un volumen persistente; en producción SHALL permitir
la carga directa con URL firmada temporal. Sin configuración de producción la operación SHALL
responder `503` y SHALL NOT usar una alternativa insegura. Ante un fallo de storage o de
verificación SHALL evitar registros inconsistentes.

#### Scenario: Storage sin configurar en producción
- **WHEN** el backend corre en producción sin configuración de storage
- **THEN** el envío responde 503 y no guarda el archivo ni crea un comprobante pendiente

#### Scenario: Fallo al verificar el archivo almacenado
- **WHEN** el storage no puede leerse al confirmar
- **THEN** el sistema responde 503 y el comprobante no queda en `PENDIENTE_REVISION`

#### Scenario: Archivo inválido detectado al confirmar
- **WHEN** el contenido verificado no corresponde a un formato permitido
- **THEN** el sistema borra el objeto y la fila técnica, y no deja archivos huérfanos por ese envío

### Requirement: Acceso al adjunto

Solo el alumno que envió el comprobante y el personal de Secretaría autorizado SHALL poder
descargar el adjunto. El sistema SHALL validar los permisos antes de leerlo y SHALL usar acceso
autenticado o una URL firmada temporal, nunca una URL pública permanente. SHALL rechazar usuarios
sin sesión y a otros alumnos. SHALL NOT aceptar rutas ni nombres de archivo proporcionados por el
usuario para ubicar el objeto. Secretaría SHALL poder abrir el adjunto de un comprobante en
cualquier estado; el alumno, el de sus propios comprobantes ya confirmados.

#### Scenario: Acceso del alumno dueño
- **WHEN** el alumno que envió el comprobante descarga el adjunto
- **THEN** el sistema responde 200 con el archivo

#### Scenario: Acceso de Secretaría
- **WHEN** un usuario `ADMIN` descarga el adjunto de un comprobante pendiente
- **THEN** el sistema responde 200 con el archivo

#### Scenario: Acceso de otro alumno
- **WHEN** otro alumno intenta descargar el comprobante
- **THEN** el sistema responde 404 y no devuelve el archivo

#### Scenario: Acceso sin sesión
- **WHEN** se intenta descargar sin token
- **THEN** el sistema responde 401

#### Scenario: Adjunto de un comprobante resuelto
- **WHEN** Secretaría abre el adjunto de un comprobante aceptado, observado o rechazado
- **THEN** el sistema responde 200 con el archivo y lo muestra integrado en el detalle, sin abrir una pestaña externa ni exponer una URL privada permanente

### Requirement: Consulta de comprobantes

`GET /alumno/comprobantes` SHALL devolver solo los comprobantes del alumno autenticado, del más
reciente al más viejo, con su estado, su motivo y el vínculo del reenvío. `GET /comprobantes`
SHALL devolver a Secretaría los comprobantes con alumno, inscripción, fecha, importe, medio,
titular, estado y archivo, con los pendientes primero y ordenados por fecha de recepción de la más
antigua a la más reciente. SHALL permitir filtrar por estado y SHALL mantener visibles los
comprobantes ya resueltos. La consulta SHALL NOT acreditar el pago ni crear una cobranza.

#### Scenario: El alumno ve sus comprobantes
- **WHEN** el alumno consulta su lista después de enviar un comprobante
- **THEN** ve su comprobante en estado `PENDIENTE_REVISION` y no ve los de otros alumnos

#### Scenario: Secretaría ve los pendientes
- **WHEN** Secretaría consulta `GET /comprobantes`
- **THEN** ve los comprobantes pendientes con sus datos y el adjunto accesible

#### Scenario: Consulta de otro rol
- **WHEN** un docente consulta la lista de comprobantes pendientes
- **THEN** el sistema responde 403

#### Scenario: La consulta no acredita
- **WHEN** Secretaría lista o descarga un comprobante pendiente
- **THEN** no se crea una cobranza ni una imputación y la habilitación del alumno no cambia

#### Scenario: El alumno ve el motivo
- **WHEN** el alumno consulta un comprobante observado o rechazado
- **THEN** ve el estado, el motivo de la resolución y, si fue observado, la opción de reenviarlo

#### Scenario: Filtro por estado
- **WHEN** Secretaría filtra por `ACEPTADO`, `OBSERVADO` o `RECHAZADO`
- **THEN** ve los comprobantes resueltos en ese estado y no pierde el acceso a los pendientes al quitar el filtro

### Requirement: Panel administrativo de revisión

El sistema SHALL ofrecer dentro de «Cobranzas e Ingresos» un panel de revisión de comprobantes que
muestre alumno, comisión de la inscripción, titular o «Sin identificar», importe, fecha del pago,
medio de pago y estado. El listado SHALL mostrar primero los pendientes de revisión, ordenados por
fecha de recepción de la más antigua a la más reciente —no por la fecha declarada del pago— y SHALL
permitir filtrar por estado sin ocultar definitivamente los resueltos. Los estados SHALL mostrarse
con indicadores visuales consistentes. Al seleccionar un comprobante SHALL abrirse un detalle en la
misma pantalla con alumno e inscripción, comisión, fecha e importe, medio, titular, solicitud de
Factura A y CUIT cuando corresponda, fecha de recepción, estado, motivo de la resolución y el
adjunto integrado.

#### Scenario: Orden de la bandeja
- **WHEN** Secretaría abre el panel con dos comprobantes pendientes recibidos en fechas distintas
- **THEN** el recibido primero aparece antes, aunque su fecha declarada de pago sea posterior

#### Scenario: Resueltos visibles con filtro
- **WHEN** Secretaría elige el filtro `RECHAZADO`
- **THEN** ve los comprobantes rechazados con su motivo

#### Scenario: Detalle con adjunto integrado
- **WHEN** Secretaría abre un comprobante PDF o una imagen
- **THEN** el archivo se muestra dentro del detalle con la sesión de Secretaría, sin exigir otra pestaña ni una URL pública

#### Scenario: Panel vacío
- **WHEN** no hay comprobantes para el filtro elegido
- **THEN** el panel lo explica con un mensaje y no inventa filas

### Requirement: Aceptación del comprobante

`POST /comprobantes/{id}/aceptar` SHALL exigir rol `ADMIN`, bloquear la fila del comprobante con
`SELECT ... FOR UPDATE`, comprobar que sigue `PENDIENTE_REVISION`, crear una cobranza en estado
`ACREDITADO` con la lógica existente, registrar el pagador respetando el titular opcional y la
solicitud de Factura A, e imputar el importe a la inscripción elegida por el alumno. SHALL guardar
el vínculo entre comprobante y cobranza, registrar quién lo aprobó y cuándo, dejar el comprobante en
`ACEPTADO` y dejar que la habilitación se derive con las reglas existentes. La aprobación, el alta de
la cobranza, la imputación y la auditoría SHALL ejecutarse en una sola transacción y SHALL revertirse
completas ante cualquier fallo. Un comprobante SHALL NOT generar más de una cobranza.

#### Scenario: Aceptación correcta
- **WHEN** Secretaría acepta un comprobante pendiente de una inscripción activa
- **THEN** se crea una cobranza `ACREDITADO` por el importe del comprobante, con su pagador y una imputación a esa inscripción, y el comprobante queda `ACEPTADO` con el id de la cobranza

#### Scenario: Titular y Factura A
- **WHEN** el comprobante declara un titular y solicita Factura A con un CUIT válido
- **THEN** la cobranza guarda ese titular, su documento y la solicitud de Factura A

#### Scenario: Sin titular identificado
- **WHEN** el comprobante no declara titular
- **THEN** el pagador de la cobranza queda como «Sin identificar» y no se completa con el nombre del alumno

#### Scenario: Habilitación del alumno
- **WHEN** la aceptación imputa el importe que la regla de habilitación exige
- **THEN** la habilitación del alumno se deriva como habilitada sin escribir un estado nuevo

#### Scenario: Una sola cobranza
- **WHEN** un comprobante ya fue aceptado y se intenta aceptar de nuevo
- **THEN** el sistema responde 409 y no crea otra cobranza

#### Scenario: Fallo al acreditar
- **WHEN** la inscripción dejó de estar activa entre el envío y la revisión
- **THEN** el sistema responde 422, no crea la cobranza ni la imputación y el comprobante sigue pendiente

### Requirement: Observación del comprobante

`POST /comprobantes/{id}/observar` SHALL exigir rol `ADMIN`, estar disponible solo para
comprobantes `PENDIENTE_REVISION` y exigir una causa con contenido: SHALL rechazar con `422` una
causa ausente, vacía o compuesta solamente por espacios. SHALL guardar el motivo, el administrador y
la fecha de resolución, dejar el comprobante en `OBSERVADO` y SHALL NOT crear cobranza ni imputación
ni modificar la habilitación. El alumno SHALL poder consultar el motivo desde «Mis Pagos» y
reenviar el comprobante.

#### Scenario: Observación con causa
- **WHEN** Secretaría observa un comprobante pendiente con un motivo válido
- **THEN** el comprobante queda `OBSERVADO` con el motivo, el administrador y la fecha, y el alumno lo ve en «Mis Pagos»

#### Scenario: Observación sin causa
- **WHEN** el motivo está vacío o solo tiene espacios
- **THEN** el sistema responde 422 y el comprobante sigue pendiente

#### Scenario: Observar no acredita
- **WHEN** se observa un comprobante
- **THEN** no se crea cobranza ni imputación y la habilitación del alumno no cambia

#### Scenario: Comprobante ya resuelto
- **WHEN** se intenta observar un comprobante aceptado o rechazado
- **THEN** el sistema responde 409 y no sobrescribe la resolución anterior

### Requirement: Rechazo del comprobante

`POST /comprobantes/{id}/rechazar` SHALL exigir rol `ADMIN`, estar disponible solo para
comprobantes `PENDIENTE_REVISION` y exigir una causa obligatoria con contenido. SHALL registrar el
motivo, el administrador y la fecha, dejar el comprobante en `RECHAZADO` y SHALL NOT crear cobranza
ni imputación ni modificar la habilitación. El rechazo SHALL ser definitivo para ese comprobante: no
podrá reabrirse, editarse ni resolverse de nuevo. El alumno SHALL ver el estado y el motivo, y
SHALL poder registrar un pago nuevo e independiente si cumple las reglas normales.

#### Scenario: Rechazo con causa
- **WHEN** Secretaría rechaza un comprobante pendiente con un motivo válido
- **THEN** el comprobante queda `RECHAZADO` con el motivo, el administrador y la fecha

#### Scenario: Rechazo sin causa
- **WHEN** el motivo está vacío o solo tiene espacios
- **THEN** el sistema responde 422 y el comprobante sigue pendiente

#### Scenario: Rechazo definitivo
- **WHEN** se intenta observar o rechazar de nuevo un comprobante ya rechazado
- **THEN** el sistema responde 409 y conserva la primera resolución

#### Scenario: Rechazar no bloquea un pago nuevo
- **WHEN** el alumno registra un pago nuevo después de un rechazo
- **THEN** el pago se registra con las reglas normales del sistema y el comprobante rechazado no se modifica

### Requirement: Reenvío de un comprobante observado

El sistema SHALL permitir al alumno reenviar un comprobante `OBSERVADO` con un archivo nuevo,
reutilizando las validaciones y el almacenamiento privado de la HU 52. El reenvío SHALL crear una
fila nueva en `PENDIENTE_REVISION` vinculada al comprobante observado, conservando el original con su
causa y su historial. SHALL rechazar el reenvío de un comprobante pendiente, aceptado o rechazado, y
SHALL impedir más de un reenvío por comprobante observado: una vez reenviado, el panel del alumno
SHALL NOT volver a ofrecer esa acción. Los archivos históricos SHALL NOT modificarse.

#### Scenario: Reenvío válido
- **WHEN** el alumno reenvía un comprobante observado con un PDF, JPG o PNG válido de hasta 5 MB
- **THEN** se crea un envío nuevo en `PENDIENTE_REVISION` vinculado al original y el original sigue `OBSERVADO` con su motivo

#### Scenario: Reenvío de un rechazado
- **WHEN** el alumno intenta reenviar un comprobante rechazado
- **THEN** el sistema responde 409 y no crea un envío nuevo

#### Scenario: Reenvío repetido
- **WHEN** el comprobante observado ya tiene un reenvío
- **THEN** el sistema responde 409, no crea otro y el panel del alumno deja de ofrecer la acción

#### Scenario: Reenvío desde el panel del alumno
- **WHEN** el alumno ya reenvió un comprobante observado y vuelve a «Mis Pagos»
- **THEN** ve el original con su motivo como «Ya reenviado» y no aparece el botón para reenviarlo otra vez

#### Scenario: Reenvío ajeno
- **WHEN** un alumno intenta reenviar un comprobante de otro alumno
- **THEN** el sistema responde 404 y no crea nada

### Requirement: Resoluciones concurrentes

El sistema SHALL resolver cada comprobante con bloqueo de fila `SELECT ... FOR UPDATE` dentro de la
transacción. Si dos administradores consultan el mismo comprobante pendiente, el primero SHALL poder
resolverlo y el segundo SHALL recibir `409` al intentarlo después, sin generar cobranzas duplicadas y
sin sobrescribir el administrador, el motivo ni la fecha de la primera resolución. El panel SHALL
actualizar el estado y avisar que el comprobante ya fue resuelto, sin depender de deshabilitar
botones.

#### Scenario: Doble aceptación
- **WHEN** dos administradores aceptan el mismo comprobante y el segundo llega después del primero
- **THEN** el segundo recibe 409, existe una sola cobranza y la resolución conserva al primer administrador

#### Scenario: Resolución después de otra
- **WHEN** se intenta observar un comprobante que otro administrador ya aceptó
- **THEN** el sistema responde 409 y no crea ni modifica nada

#### Scenario: Aviso en el panel
- **WHEN** el frontend recibe un 409 al resolver
- **THEN** muestra el aviso, vuelve a leer el estado del comprobante y recarga la lista

### Requirement: Acceso restringido a la revisión administrativa

Los endpoints de listado, detalle y resolución administrativa SHALL exigir rol `ADMIN`. Los usuarios
sin sesión SHALL recibir `401`; `DOCENTE` y `ALUMNO` SHALL recibir `403`. El alumno SHALL NOT poder
aprobar, rechazar, observar ni cambiar directamente el estado de un comprobante. El backend SHALL
validar las transiciones y SHALL NOT aceptar estados arbitrarios enviados por el cliente.

#### Scenario: Sin sesión
- **WHEN** se llama a un endpoint administrativo sin token
- **THEN** el sistema responde 401

#### Scenario: Rol sin permiso
- **WHEN** un docente o un alumno llama a un endpoint administrativo
- **THEN** el sistema responde 403

#### Scenario: El alumno no cambia estados
- **WHEN** el alumno intenta resolver o enviar un estado desde su panel
- **THEN** el sistema no modifica el comprobante porque no existe una ruta que lo permita

### Requirement: Auditoría de la resolución

Cada resolución SHALL dejar una entrada en `audit_log` con el comprobante, el administrador, la
fecha, el estado resultante y el motivo cuando corresponda. La aceptación SHALL incluir además el id
de la cobranza creada. La auditoría SHALL NOT registrarse fuera de la transacción de la resolución.

#### Scenario: Auditoría de la aceptación
- **WHEN** se acepta un comprobante
- **THEN** queda una entrada `comprobante.aceptado` con el administrador y el id de la cobranza

#### Scenario: Auditoría de la observación
- **WHEN** se observa un comprobante
- **THEN** queda una entrada `comprobante.observado` con el motivo y la fecha

#### Scenario: Auditoría del rechazo
- **WHEN** se rechaza un comprobante
- **THEN** queda una entrada `comprobante.rechazado` con el motivo y la fecha
