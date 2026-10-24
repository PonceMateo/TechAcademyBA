# Spec Delta

## Purpose

Definir la edición administrativa del catálogo de cursos y comisiones sin romper las relaciones ya
registradas, con las validaciones de unicidad y de cupo que cada operación necesita.

## ADDED Requirements

### Requirement: Edición de un curso

El sistema SHALL exponer `PUT /cursos/{id}` solo para Administración. La edición SHALL aceptar el
nombre y una descripción opcional, y SHALL NOT aceptar un código: el código es una columna generada
por la base (D32) y un `codigo` en el cuerpo SHALL responder `422`.

El nombre SHALL ser obligatorio y SHALL normalizarse antes de guardarse. WHEN el nombre normalizado
coincida con el de otro curso, el sistema SHALL rechazar la edición con `409` e identificar el curso
existente; la comparación SHALL excluir al propio curso, para que guardar el mismo nombre no choque
contra su propia fila. WHEN el `id` no corresponda a ningún curso, SHALL responder `404`. WHEN el
nombre falte o venga vacío, SHALL responder `422`.

La respuesta SHALL devolver el curso actualizado con su código generado. El `id` SHALL conservarse y
sus comisiones y el historial asociado SHALL NOT modificarse.

#### Scenario: Edición exitosa

- **WHEN** se modifica el nombre o la descripción de un curso existente con valores válidos y no duplicados
- **THEN** los cambios quedan persistidos, la respuesta trae el curso con su código generado y sus comisiones siguen asociadas al mismo curso

#### Scenario: El código no se edita

- **WHEN** se envía un `PUT /cursos/{id}` con un campo `codigo`
- **THEN** el sistema rechaza la edición con `422` y el código generado no cambia

#### Scenario: Nombre duplicado

- **WHEN** el nuevo nombre normalizado pertenece a otro curso, aunque difiera solo en mayúsculas, acentos o espacios
- **THEN** el sistema rechaza la edición con `409`, informa que el nombre ya está registrado e identifica el curso existente

#### Scenario: Guardar el mismo nombre

- **WHEN** se guarda un curso sin cambiar su nombre
- **THEN** el sistema acepta la edición, porque la comparación de unicidad excluye al propio curso

#### Scenario: Nombre vacío

- **WHEN** se envía un nombre vacío o compuesto solo por espacios
- **THEN** el sistema rechaza la edición con `422` e indica que el nombre es obligatorio

#### Scenario: Curso inexistente

- **WHEN** se edita un `id` que no corresponde a ningún curso
- **THEN** el sistema responde `404`

#### Scenario: Solo Administración

- **WHEN** un Docente o un Alumno intenta editar un curso
- **THEN** el sistema responde `403`; sin token responde `401`
