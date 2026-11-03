# Spec Delta

## Purpose

Envío del comprobante de pago por parte del alumno autenticado, almacenamiento privado del
adjunto, consulta por parte del alumno y de Secretaría, y garantía de que el envío no acredita el
pago ni modifica la habilitación (HU 52).

## ADDED Requirements

### Requirement: Registro independiente del comprobante del alumno

El sistema SHALL guardar cada comprobante enviado en la entidad independiente
`comprobante_alumno`, sin crear ni modificar una `cobranza`, un `pagador` ni una `imputación`.
La entidad SHALL registrar el alumno autenticado, la inscripción a imputar, la fecha del pago, el
importe, el medio de pago, el titular opcional, la solicitud de Factura A, el CUIT cuando
corresponda, la referencia del archivo, el estado y la fecha y hora del envío. El estado inicial
visible SHALL ser `PENDIENTE_REVISION`.

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
usuario para ubicar el objeto.

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

### Requirement: Consulta de comprobantes

`GET /alumno/comprobantes` SHALL devolver solo los comprobantes del alumno autenticado, del más
reciente al más viejo, con su estado. `GET /comprobantes` SHALL devolver a Secretaría los
comprobantes en `PENDIENTE_REVISION` con alumno, inscripción, fecha, importe, medio y archivo. La
consulta SHALL NOT acreditar el pago ni crear una cobranza.

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
