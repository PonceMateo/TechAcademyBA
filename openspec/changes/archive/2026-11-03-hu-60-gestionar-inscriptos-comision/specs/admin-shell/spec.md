# Spec Delta

## ADDED Requirements

### Requirement: Apertura de una comisión desde el listado

La tabla de comisiones del curso SHALL abrir la comisión al hacer click sobre su fila o al activarla
con `Enter` o espacio, navegando a `/admin/cursos/:codigo/comisiones/:comisionId`. El botón `Editar`
SHALL seguir siendo una acción independiente que abre el modal de edición y SHALL NOT disparar la
navegación. Las dos acciones SHALL ser accesibles por teclado.

#### Scenario: Abrir la comisión desde la fila

- **WHEN** el administrador hace click sobre una fila de la tabla de comisiones del curso
- **THEN** la aplicación navega a la pantalla de gestión de inscriptos de esa comisión

#### Scenario: Editar no navega

- **WHEN** el administrador pulsa `Editar` en una fila de comisiones
- **THEN** se abre el modal de edición de la comisión y la pantalla no cambia de ruta

#### Scenario: Navegación por teclado

- **WHEN** el administrador enfoca una fila y presiona `Enter` o espacio
- **THEN** la aplicación abre la comisión de esa fila

### Requirement: Pantalla de inscriptos de una comisión

La pantalla SHALL mostrar el nombre del curso, el código de la comisión, una acción para volver al
listado de comisiones del curso, el cupo máximo, la cantidad de inscriptos activos y las vacantes
que informa la fuente. La tabla SHALL mostrar por inscripción el nombre del alumno, su DNI, la
categoría arancelaria y el estado de habilitación derivado.

#### Scenario: Volver al listado

- **WHEN** el administrador pulsa `Volver a las comisiones`
- **THEN** vuelve a `/admin/cursos/:codigo` con la tabla de comisiones del curso

#### Scenario: Contadores de la comisión

- **WHEN** la comisión tiene cupo 30 y 2 inscripciones activas, una de ellas dada de baja
- **THEN** la pantalla muestra cupo 30, 2 inscriptos activos y 28 vacantes

#### Scenario: Comisión sin inscriptos

- **WHEN** la comisión no tiene ninguna inscripción
- **THEN** la tabla dice que no hay inscriptos y los contadores informan cero inscriptos y el cupo completo de vacantes

#### Scenario: Error de carga

- **WHEN** la fuente rechaza la consulta de la comisión
- **THEN** la pantalla muestra el motivo y la acción de volver, sin filas inventadas

### Requirement: Acciones sobre una inscripción desde la comisión

La pantalla SHALL ofrecer `Inscribir alumno`, `Cambiar categoría` y `Dar de baja`. La categoría
SHALL guardarse sobre esa inscripción y SHALL NOT tocar las demás del alumno. La baja SHALL pedir
confirmación, SHALL NOT ofrecerse sobre una inscripción ya dada de baja y SHALL actualizar el estado
y las vacantes al confirmar.

#### Scenario: Inscripción con la comisión bloqueada

- **WHEN** el administrador inscribe un alumno desde la comisión
- **THEN** la comisión aparece elegida y bloqueada, no se puede cambiar y el alta actualiza la tabla y las vacantes

#### Scenario: Cambio de categoría

- **WHEN** el administrador cambia la categoría de una inscripción desde la comisión
- **THEN** solo esa inscripción queda con la categoría nueva y el listado se actualiza

#### Scenario: Baja con confirmación

- **WHEN** el administrador elige `Dar de baja` y confirma
- **THEN** la inscripción pasa a `BAJA`, se muestra en el historial y las vacantes aumentan en uno

#### Scenario: Baja rechazada por la fuente

- **WHEN** la fuente responde que la inscripción ya no está activa
- **THEN** la pantalla muestra el motivo, recarga el listado y no confirma la baja
