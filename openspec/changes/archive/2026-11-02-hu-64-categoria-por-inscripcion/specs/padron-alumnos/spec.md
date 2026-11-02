# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta básica del padrón de alumnos

El sistema SHALL exponer `GET /alumnos` para Administración. La consulta SHALL devolver los alumnos
activos con `id`, `nombre`, `documento`, `tipo_documento`, `email`, `telefono` y `activo`, ordenados
por `id`, y SHALL admitir la búsqueda opcional `?q=` por DNI, email o nombre. La respuesta SHALL NOT
incluir `comision`, `categoria`, `porcentaje_beca` ni `acceso`: los datos de inscripción se consultan
en el detalle del alumno.

#### Scenario: El alta aparece en el padrón

- **WHEN** se consulta el padrón después de un alta exitosa
- **THEN** el alumno creado aparece en la respuesta con sus datos personales

#### Scenario: El padrón no trae datos de inscripción

- **WHEN** se consulta un alumno que tiene una o varias inscripciones
- **THEN** la fila trae solo sus datos personales y no incluye comisión, categoría, porcentaje de beca ni acceso

#### Scenario: Alumno sin inscripción

- **WHEN** se consulta un alumno que todavía no tiene inscripción
- **THEN** la respuesta trae sus datos personales igual que la de cualquier otro alumno, sin campos de inscripción que completar

#### Scenario: El padrón vacío

- **WHEN** se consulta el padrón y no hay alumnos
- **THEN** la respuesta es una lista vacía y la pantalla muestra su estado vacío, sin filas inventadas

#### Scenario: Solo Administración consulta el padrón

- **WHEN** un usuario con rol Docente o Alumno intenta consultar `GET /alumnos`
- **THEN** el sistema responde `403`; sin token responde `401`

## ADDED Requirements

### Requirement: Detalle del alumno con sus inscripciones

El sistema SHALL exponer `GET /alumnos/{id}` solo para Administración. La respuesta SHALL incluir
los datos del alumno y un arreglo `inscripciones` con **todas** sus inscripciones: cada una con su
comisión, categoría, porcentaje de beca, empresa y acceso derivado con las reglas de la
habilitación. `acceso` SHALL ser nulo fuera de las inscripciones `ACTIVA`. SHALL responder `404` si
el alumno no existe.

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
