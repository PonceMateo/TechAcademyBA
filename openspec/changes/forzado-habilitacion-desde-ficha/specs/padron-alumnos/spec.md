# Spec Delta

## MODIFIED Requirements

### Requirement: Detalle del alumno con sus inscripciones

El sistema SHALL exponer `GET /alumnos/{id}` solo para Administración. La respuesta SHALL incluir
los datos del alumno y un arreglo `inscripciones` con **todas** sus inscripciones: cada una con su
comisión, categoría, porcentaje de beca, empresa y acceso derivado con las reglas de la
habilitación. `acceso` SHALL ser nulo fuera de las inscripciones `ACTIVA`. SHALL responder `404` si
el alumno no existe.

El acceso derivado de una inscripción `ACTIVA` SHALL informar el estado efectivo, su causa, si hay
un forzado vigente, el estado que produce la regla automática y el motivo del forzado cuando
existe. El estado automático SHALL informarse aunque haya un forzado, para que la pantalla pueda
ofrecer el estado contrario.

#### Scenario: Alumno con dos categorías

- **WHEN** un alumno tiene una inscripción corporativa y otra particular
- **THEN** el detalle trae las dos inscripciones, cada una con su comisión, su categoría y su acceso, sin colapsarlas en una sola

#### Scenario: Alumno sin inscripciones

- **WHEN** se consulta el detalle de un alumno que no tiene ninguna inscripción
- **THEN** el sistema responde `200` con `inscripciones` vacío y la pantalla muestra un mensaje informativo en lugar de las pestañas

#### Scenario: Inscripción corporativa

- **WHEN** el detalle incluye una inscripción con categoría `CORPORATIVO`
- **THEN** esa inscripción trae el `id` y la `razon_social` de su empresa

#### Scenario: Habilitación por inscripción

- **WHEN** el detalle incluye una inscripción habilitada y otra bloqueada
- **THEN** cada una trae su propio estado y, la bloqueada, su causa; no hay un estado único del alumno

#### Scenario: Inscripción que no está activa

- **WHEN** el detalle incluye una inscripción en estado `COMPLETADA`
- **THEN** esa inscripción informa `COMPLETADA` en `estado` y `acceso` nulo, sin causa de bloqueo

#### Scenario: Alumno inexistente

- **WHEN** se consulta el detalle de un `id` que no corresponde a ningún alumno
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración consulta el detalle

- **WHEN** un Docente o un Alumno intenta consultar `GET /alumnos/{id}`
- **THEN** el sistema responde `403`; sin token responde `401`

#### Scenario: Acceso con forzado vigente

- **WHEN** una inscripción `ACTIVA` tiene un forzado vigente
- **THEN** el acceso informa como estado efectivo el forzado, `forzado` en verdadero, el motivo registrado y el estado que produce la regla automática

#### Scenario: Acceso sin forzado

- **WHEN** una inscripción `ACTIVA` no tiene forzado
- **THEN** el estado efectivo y el automático coinciden, `forzado` es falso y el motivo es nulo
