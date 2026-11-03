# inscripciones Specification

## Purpose
Define las inscripciones de un alumno en una comisión: el alta con su categoría arancelaria, la
edición de esa categoría y la consulta de las inscripciones activas que otras pantallas necesitan.

## Requirements

### Requirement: Alta de inscripción con categoría arancelaria

El sistema SHALL exponer `POST /inscripciones` solo para Administración. El cuerpo SHALL aceptar
`alumno_id`, `comision_id`, `categoria` con `PARTICULAR` por omisión, `porcentaje_beca` y
`empresa_id`. El alta SHALL aplicar las mismas reglas que la edición: una beca parcial exige un
porcentaje entero entre 1 y 99 y una categoría corporativa exige una empresa registrada. La
inscripción SHALL nacer en estado `ACTIVA`. WHEN la comisión esté `Finalizada` según su `fecha_fin`,
el sistema SHALL rechazar el alta con `422` e informar que la comisión ya finalizó, sin crear la
inscripción.

#### Scenario: Alta particular

- **WHEN** se inscribe un alumno en una comisión con al menos una vacante y sin categoría
- **THEN** el sistema responde `201` con la inscripción en `PARTICULAR`, sin porcentaje de beca ni empresa

#### Scenario: Alta de beca parcial

- **WHEN** se inscribe con categoría `BECADO_PARCIAL` y un porcentaje entre 1 y 99
- **THEN** el sistema responde `201` y la inscripción guarda la categoría y el porcentaje

#### Scenario: Beca parcial sin porcentaje

- **WHEN** se inscribe con categoría `BECADO_PARCIAL` y sin porcentaje, o con un porcentaje fuera de 1 a 99
- **THEN** el sistema responde `422` y no crea la inscripción

#### Scenario: Alta corporativa

- **WHEN** se inscribe con categoría `CORPORATIVO` y una empresa registrada
- **THEN** el sistema responde `201` y la inscripción queda vinculada a esa empresa

#### Scenario: Corporativo sin empresa

- **WHEN** se inscribe con categoría `CORPORATIVO` y sin `empresa_id`
- **THEN** el sistema responde `422` e indica que hay que seleccionar la empresa

#### Scenario: Empresa inexistente

- **WHEN** se inscribe con categoría `CORPORATIVO` y un `empresa_id` que no existe
- **THEN** el sistema responde `404` y no crea la inscripción

#### Scenario: Categoría fuera del enum

- **WHEN** se inscribe con una categoría que no es ninguna de las cuatro admitidas
- **THEN** el sistema responde `422` y no crea la inscripción

#### Scenario: Inscripción duplicada

- **WHEN** se intenta inscribir al mismo alumno en la misma comisión otra vez
- **THEN** el sistema responde `409` e informa que ya está inscripto

#### Scenario: Comisión completa

- **WHEN** se inscribe en una comisión cuyas inscripciones activas alcanzaron el cupo
- **THEN** el sistema responde `409` e informa que la comisión está completa

#### Scenario: Comisión finalizada

- **WHEN** se intenta inscribir un alumno en una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** el sistema responde `422`, informa que la comisión ya finalizó y no crea la inscripción

#### Scenario: Alta de beca sobre una inscripción prorrateada

- **WHEN** se inscribe con categoría `BECADO_PARCIAL` en una comisión ya iniciada
- **THEN** el sistema responde `201` y el monto requerido de la inscripción se deriva del importe base prorrateado con el descuento aplicado

#### Scenario: Solo Administración inscribe

- **WHEN** un Docente o un Alumno intenta crear una inscripción
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Edición de la categoría de una inscripción

El sistema SHALL exponer `PATCH /inscripciones/{id}` solo para Administración. La edición SHALL
cambiar la categoría, el porcentaje de beca o la empresa **de esa inscripción** y SHALL NOT
modificar las demás inscripciones del alumno. SHALL rechazar una beca parcial sin porcentaje válido,
un corporativo sin empresa y una categoría fuera del enum. El importe base ya guardado SHALL NOT
cambiar: el monto requerido SHALL volver a derivarse aplicando o quitando el descuento según la
categoría nueva.

#### Scenario: Cambio aislado

- **WHEN** un alumno tiene una inscripción corporativa y otra particular y se cambia la categoría de una
- **THEN** solo esa inscripción queda con la categoría nueva y la otra conserva la suya

#### Scenario: Cambio a beca parcial

- **WHEN** se cambia una inscripción a beca parcial con un porcentaje entre 1 y 99
- **THEN** la inscripción guarda la categoría y el porcentaje, la respuesta los devuelve y el monto requerido baja según el descuento sobre el importe base

#### Scenario: Cambio de beca parcial a particular

- **WHEN** se cambia a particular una inscripción que era beca parcial
- **THEN** el porcentaje de beca queda nulo y el monto requerido vuelve al importe base completo, sin prorratear de nuevo

#### Scenario: Cambio de beca sobre una inscripción prorrateada

- **WHEN** se cambia a beca parcial una inscripción prorrateada por alta tardía
- **THEN** el descuento se aplica sobre el importe prorrateado guardado y el importe requerido deja de ser el del alta

#### Scenario: Cambio a corporativo sin empresa

- **WHEN** se cambia una inscripción a corporativo sin informar `empresa_id`
- **THEN** el sistema responde `422` e indica que hay que seleccionar la empresa

#### Scenario: Inscripción inexistente

- **WHEN** se edita un `id` que no corresponde a ninguna inscripción
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración edita la categoría

- **WHEN** un Docente o un Alumno intenta cambiar la categoría de una inscripción
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Consulta de las inscripciones activas de un alumno

El sistema SHALL exponer `GET /alumnos/{id}/inscripciones` solo para Administración. La consulta
SHALL devolver las inscripciones `ACTIVA` del alumno con su `id`, `estado`, la comisión —`codigo` y
`nombre` del curso— y la categoría arancelaria. SHALL responder `404` si el alumno no existe y una
lista vacía si no tiene inscripciones activas.

#### Scenario: Dos inscripciones se listan por separado

- **WHEN** el alumno tiene dos inscripciones activas en comisiones distintas
- **THEN** la respuesta trae dos elementos, cada uno con su comisión, su categoría y su estado, sin mezclarlos

#### Scenario: Alumno sin inscripciones activas

- **WHEN** el alumno existe pero no tiene inscripciones activas
- **THEN** el sistema responde `200` con una lista vacía

#### Scenario: Alumno inexistente

- **WHEN** se consultan las inscripciones de un `id` que no corresponde a ningún alumno
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración consulta

- **WHEN** un Docente o un Alumno intenta consultar las inscripciones de un alumno
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Listado de inscriptos de una comisión

El sistema SHALL exponer `GET /inscripciones?comision_id=` solo para Administración. La respuesta
SHALL traer la comisión —`id`, `codigo`, nombre del curso—, su `cupo_maximo`, la cantidad de
inscripciones `ACTIVA`, las vacantes derivadas de esas activas y todas las inscripciones de la
comisión, cada una con su alumno —`id`, nombre y documento—, la categoría y el estado. SHALL
responder `404` si la comisión no existe.

#### Scenario: Comisión con inscriptos

- **WHEN** se consultan las inscripciones de una comisión con cupo 30 y 3 inscripciones activas
- **THEN** la respuesta trae la comisión, cupo 30, 3 inscriptos activos, 27 vacantes y las 3 filas con alumno, DNI, categoría y estado

#### Scenario: Comisión sin inscriptos

- **WHEN** la comisión existe y no tiene ninguna inscripción
- **THEN** la respuesta trae la comisión con 0 inscriptos activos, sus vacantes completas y una lista vacía

#### Scenario: Comisión inexistente

- **WHEN** se consulta un identificador que no corresponde a ninguna comisión
- **THEN** el sistema responde `404` y no devuelve ningún inscripto

#### Scenario: Solo Administración consulta

- **WHEN** un Docente o un Alumno intenta consultar los inscriptos de una comisión
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Habilitación e historial en el listado de la comisión

El listado SHALL incluir el estado de habilitación derivado con las reglas vigentes para cada
inscripción `ACTIVA`, y SHALL ordenar las inscripciones dadas de baja al final como historial, con
su estado de inscripción visible y sin estado de habilitación.

#### Scenario: La baja no ocupa cupo

- **WHEN** la comisión tiene 2 inscripciones activas y 1 dada de baja
- **THEN** el listado informa 2 inscriptos activos, las vacantes del cupo menos 2, y la fila de baja aparece al final con su estado `BAJA`

#### Scenario: Habilitación derivada

- **WHEN** una inscripción activa tiene pagos pendientes
- **THEN** la fila informa el estado de habilitación y su causa según las reglas existentes, sin inventar un estado en el frontend

### Requirement: Inscripción desde la gestión de una comisión

La pantalla de la comisión SHALL reutilizar el alta de inscripción existente con el `comision_id` de
la comisión abierta. El formulario SHALL mostrar la comisión seleccionada y bloqueada y SHALL
conservar las validaciones de categoría, beca parcial, empresa, alumno, duplicado y cupo. Al
confirmar SHALL actualizar el listado y las vacantes.

#### Scenario: Alta dentro de la comisión

- **WHEN** el administrador inscribe un alumno desde la comisión abierta
- **THEN** la inscripción se crea con esa comisión y el listado muestra un inscripto activo más y una vacante menos

#### Scenario: Comisión bloqueada

- **WHEN** el modal de inscripción se abre desde la comisión
- **THEN** la comisión aparece elegida y no se puede cambiar, y el resto del formulario funciona igual que en la pantalla general

#### Scenario: Alumno ya inscripto

- **WHEN** se intenta inscribir un alumno que ya tiene una inscripción activa en esa comisión
- **THEN** el sistema responde `409` y el formulario sigue abierto con el motivo

#### Scenario: Sin vacantes

- **WHEN** la comisión alcanzó su cupo de inscripciones activas
- **THEN** el alta responde `409` y no crea la inscripción

### Requirement: Baja lógica de una inscripción

El sistema SHALL exponer `POST /inscripciones/{id}/baja` solo para Administración, con el
`comision_id` desde el que se pide. SHALL cambiar el estado a `BAJA` sin borrar la fila, sin tocar al
alumno del padrón ni las demás inscripciones, y SHALL registrar el cambio en `audit_log`. SHALL
responder `404` si la inscripción o la comisión no existen o no se corresponden, y `409` si la
inscripción ya no está `ACTIVA`. La baja SHALL liberar una vacante.

#### Scenario: Baja exitosa

- **WHEN** se da de baja una inscripción `ACTIVA` de la comisión desde la que se pide
- **THEN** la inscripción queda en `BAJA`, la comisión informa un inscripto activo menos y una vacante más, y la fila se conserva en el historial

#### Scenario: Otras inscripciones del alumno

- **WHEN** el alumno tiene otra inscripción activa en una comisión distinta
- **THEN** esa otra inscripción conserva su estado y su categoría

#### Scenario: Baja duplicada

- **WHEN** se da de baja una inscripción que ya está en `BAJA`
- **THEN** el sistema responde `409` y no escribe una segunda entrada de auditoría

#### Scenario: Identificador o relación inválida

- **WHEN** la inscripción no existe o pertenece a otra comisión
- **THEN** el sistema responde `404` y no cambia ninguna fila

#### Scenario: Dos bajas simultáneas

- **WHEN** dos peticiones dan de baja la misma inscripción a la vez
- **THEN** una sola cambia el estado y la otra recibe `409`, sin liberar dos vacantes

#### Scenario: Solo Administración da de baja

- **WHEN** un Docente o un Alumno intenta dar de baja una inscripción
- **THEN** el sistema responde `403`; sin token responde `401`

### Requirement: Conservación de pagos e historial en la baja

La baja SHALL conservar las cobranzas, imputaciones, comprobantes e historial asociados a la
inscripción, y SHALL NOT modificar importes ni recalcular aranceles.

#### Scenario: Pagos e historial intactos

- **WHEN** la inscripción dada de baja tenía cobranzas imputadas y comprobantes
- **THEN** las cobranzas, imputaciones y comprobantes siguen apuntando a esa inscripción y no se modifica ningún importe
