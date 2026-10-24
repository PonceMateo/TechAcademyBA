# edicion-catalogo Specification

## Purpose
Definir la edición administrativa del catálogo de cursos y comisiones sin romper las relaciones ya
registradas, con las validaciones de unicidad y de cupo que cada operación necesita.

## Requirements

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

### Requirement: Edición de una comisión

El sistema SHALL exponer `PUT /comisiones/{id}` solo para Administración. La edición SHALL aceptar el
docente, los días y horarios, el arancel y el cupo máximo, y SHALL NOT aceptar el curso, el número, la
modalidad, la sede ni un código: un campo fuera de ese conjunto SHALL responder `422`.

El docente SHALL ser obligatorio, igual que en el alta. WHEN la comisión o el docente no existan, el
sistema SHALL responder `404`. WHEN los días y horarios vengan vacíos, el arancel no sea positivo o el
cupo máximo no sea un entero positivo, SHALL responder `422`.

El cupo máximo SHALL poder reducirse solo hasta la cantidad de inscripciones **ACTIVA** de la comisión.
WHEN el nuevo cupo sea menor que esa cantidad, el sistema SHALL rechazar la edición con `422` e
informar cuántos inscriptos hay. Las inscripciones `EN_ESPERA`, `BAJA` y `COMPLETADA` SHALL NOT contar
como ocupantes del cupo. Las inscripciones y los pagos ya registrados SHALL NOT modificarse.

La respuesta SHALL devolver la comisión actualizada con su código derivado y sus vacantes
recalculadas a partir del nuevo cupo y de las inscripciones activas.

#### Scenario: Edición exitosa

- **WHEN** se modifican el docente, los días y horarios, el arancel o el cupo de una comisión con valores válidos y se guarda
- **THEN** los cambios quedan persistidos, la respuesta trae la comisión con sus vacantes recalculadas y las inscripciones y pagos siguen asociados a la misma comisión

#### Scenario: Reducción de cupo por debajo de los inscriptos

- **WHEN** una comisión tiene 15 inscripciones activas y se intenta fijar un cupo máximo menor a 15
- **THEN** el sistema rechaza la edición con `422` e informa que hay 15 inscriptos

#### Scenario: Reducción de cupo hasta el número de inscriptos

- **WHEN** una comisión tiene 15 inscripciones activas y se fija un cupo máximo de 15
- **THEN** el sistema acepta la edición y las vacantes quedan en 0

#### Scenario: Las inscripciones en espera no ocupan cupo

- **WHEN** una comisión tiene 10 inscripciones activas y 5 en espera, y se fija un cupo máximo de 10
- **THEN** el sistema acepta la edición, porque la lista de espera no ocupa banco

#### Scenario: Docente obligatorio

- **WHEN** se envía una edición sin docente
- **THEN** el sistema rechaza la edición con `422` e indica que el docente es obligatorio

#### Scenario: Docente inexistente

- **WHEN** se informa un docente que no existe
- **THEN** el sistema responde `404`

#### Scenario: Comisión inexistente

- **WHEN** se edita un `id` que no corresponde a ninguna comisión
- **THEN** el sistema responde `404`

#### Scenario: Arancel o cupo inválido

- **WHEN** se envía un arancel no positivo o un cupo máximo cero, negativo o no entero
- **THEN** el sistema rechaza la edición con `422` e indica qué campo corregir

#### Scenario: Campos fuera del contrato

- **WHEN** se envía un `PUT /comisiones/{id}` con `curso_id`, `numero`, `modalidad`, `sede_id` o `codigo`
- **THEN** el sistema rechaza la edición con `422` y la comisión conserva esos valores

#### Scenario: Solo Administración

- **WHEN** un Docente o un Alumno intenta editar una comisión
- **THEN** el sistema responde `403`; sin token responde `401`
