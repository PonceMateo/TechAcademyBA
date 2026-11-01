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
docente, los horarios de cursada, el arancel, el cupo máximo y el período de cursada —fecha de inicio
y fecha de fin—, y SHALL NOT aceptar el curso, el número, la modalidad, la sede ni un código: un campo
fuera de ese conjunto SHALL responder `422`. La edición **SHALL NOT aceptar `dias_horarios` como
texto libre**: los horarios se envían como la lista estructurada de día, inicio y fin, en el mismo
formato del alta.

Los horarios SHALL validarse igual que en el alta: minutos múltiplos de 15, horas entre 6:00 y
22:00, fin estrictamente posterior al inicio, un solo rango por día y ningún par de rangos que se
pise dentro de la comisión; cualquiera de esas reglas rotas SHALL responder `422`.

El período SHALL ser **obligatorio** en la edición, con las mismas reglas del alta: la fecha de fin
SHALL ser igual o posterior a la de inicio y el período SHALL contener al menos una clase según los
días de cursada de la comisión. WHEN falte alguna de las dos fechas, WHEN la fecha de fin sea
anterior a la de inicio o WHEN el período no contenga ninguna clase, el sistema SHALL responder
`422` y la comisión SHALL conservar el período que tenía.

WHEN los horarios guardados se pisan con los de otra comisión **vigente** del mismo docente, en
cualquier curso, el sistema SHALL rechazar la edición con `409` e informar la comisión en conflicto
con su código, su día y su rango. La propia comisión editada SHALL quedar excluida del chequeo, de
modo que reenviar sus horarios actuales o tocar el rango de un solo día SHALL NOT producir un
conflicto falso. Los bordes exactos —un rango termina a las 18:30 y otro empieza a las 18:30—
SHALL permitirse, y un horario dictado por otro docente SHALL NO chocar.

El docente SHALL ser obligatorio, igual que en el alta. WHEN la comisión o el docente no existan, el
sistema SHALL responder `404`. WHEN los horarios vengan vacíos, el arancel no sea positivo o el
cupo máximo no sea un entero positivo, SHALL responder `422`.

El cupo máximo SHALL poder reducirse solo hasta la cantidad de inscripciones **ACTIVA** de la comisión.
WHEN el nuevo cupo sea menor que esa cantidad, el sistema SHALL rechazar la edición con `422` e
informar cuántos inscriptos hay. Las inscripciones `EN_ESPERA`, `BAJA` y `COMPLETADA` SHALL NOT contar
como ocupantes del cupo. Las inscripciones y los pagos ya registrados SHALL NOT modificarse.

La edición del período SHALL NOT modificar las inscripciones ni los pagos, y ningún importe de
inscripción ya calculado SHALL cambiar por editar las fechas. El arancel de la comisión SHALL ser
el que se envía en la misma edición, sin recalcularse a partir del período.

La respuesta SHALL devolver la comisión actualizada con su código derivado, sus horarios
estructurados, el texto de días y horarios derivado de ellos, el período con la cantidad de clases
derivada de él y sus vacantes recalculadas a partir del nuevo cupo y de las inscripciones activas.

#### Scenario: Edición exitosa

- **WHEN** se modifican el docente, los horarios, el arancel o el cupo de una comisión con valores válidos y se guarda
- **THEN** los cambios quedan persistidos, la respuesta trae la comisión con sus horarios y sus vacantes recalculadas, y las inscripciones y pagos siguen asociados a la misma comisión

#### Scenario: Edición del período con valores válidos

- **WHEN** se cambian la fecha de inicio y la fecha de fin de una comisión por otras que contienen al menos un día de cursada
- **THEN** el sistema guarda las dos fechas y la respuesta informa la cantidad de clases recalculada para el período nuevo

#### Scenario: Editar el período no recalcula aranceles

- **WHEN** se edita el período de una comisión que tiene inscripciones y pagos registrados
- **THEN** las inscripciones y los pagos quedan iguales, ningún importe de inscripción cambia y el arancel de la comisión es el que se envió en la edición

#### Scenario: Período inválido en la edición

- **WHEN** se envía una edición con la fecha de fin anterior a la de inicio, con una sola de las dos fechas o con un período que no contiene ninguna clase
- **THEN** el sistema responde `422` y la comisión conserva el período que tenía

#### Scenario: Comisión heredada que se edita por primera vez

- **WHEN** se edita una comisión creada antes de que el período existiera, sin informar las dos fechas
- **THEN** el sistema responde `422` y no la guarda, porque la edición exige el período

#### Scenario: La edición no choca consigo misma

- **WHEN** se reenvían los horarios que la comisión ya tiene, o se cambia el rango de un solo día
- **THEN** el sistema guarda la edición sin responder `409`, porque la propia comisión queda excluida del chequeo de solapamiento

#### Scenario: Choque de horario con otra comisión del mismo docente

- **WHEN** el docente tiene otra comisión vigente, en otro curso, el martes de 19:00 a 21:00, y la edición lleva esa misma comisión al martes de 20:00 a 22:00
- **THEN** el sistema responde `409` e informa la comisión en conflicto con su código, su día y su rango

#### Scenario: Los bordes exactos se permiten

- **WHEN** una comisión del mismo docente termina a las 18:30 y esta se edita para empezar a las 18:30 el mismo día
- **THEN** el sistema acepta la edición, porque la comparación de intervalos es estricta

#### Scenario: Horarios inválidos en la edición

- **WHEN** se envía un horario con minutos fuera de {0, 15, 30, 45}, con una hora fuera de 6:00 a 22:00, con el fin antes o igual al inicio, o con dos rangos del mismo día que se pisen
- **THEN** el sistema responde `422` y la comisión conserva sus horarios anteriores

#### Scenario: El texto de horarios no se envía

- **WHEN** se envía un `PUT /comisiones/{id}` con `dias_horarios` como texto libre
- **THEN** el sistema responde `422` y la comisión conserva sus horarios anteriores

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
