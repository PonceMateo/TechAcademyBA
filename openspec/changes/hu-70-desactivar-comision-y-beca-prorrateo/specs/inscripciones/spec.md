# Spec Delta

## MODIFIED Requirements

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
