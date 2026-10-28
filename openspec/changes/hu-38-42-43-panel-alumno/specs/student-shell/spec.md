# Spec Delta

## MODIFIED Requirements

### Requirement: Cursos del alumno

El sistema SHALL mostrar una tarjeta por comisión inscripta con el chip del código de comisión, un
chip de estado, el título del curso, la línea `Docente ·` seguida del nombre del docente, el resumen
legible de días y horarios, la categoría arancelaria, un banner de acceso grande con `Habilitado` en
verde o `Bloqueado` en rojo, y un botón `Ver detalle`. Todos esos valores SHALL venir de las
inscripciones reales del alumno: el sistema SHALL NOT mostrar cursos, docentes, códigos ni
categorías de ejemplo.

El estado bloqueado SHALL especificarse como un estado del componente de banner y no como una
tarjeta adicional: cuando la inscripción del alumno no tenga un pago acreditado o esté bloqueada por
Secretaría, esa misma tarjeta SHALL renderizarse con el banner `Bloqueado` en rojo, SHALL mostrar la
causa del bloqueo y SHALL ofrecer una forma de ir a `Mis Pagos`. La causa SHALL ser la misma que ve
Administración para esa inscripción. Un alumno sin inscripciones SHALL ver un mensaje informativo de
que no tiene cursos activos.

Mientras la consulta de inscripciones no resuelva, el sistema SHALL NOT mostrar el mensaje de que el
alumno no tiene cursos activos: la ausencia de tarjetas SHALL significar "todavía no lo sé" hasta que
la consulta resuelva, y solo una lista vacía confirmada por la fuente SHALL mostrar el mensaje.

#### Scenario: El alumno abre sus cursos

- **WHEN** el alumno abre `Mis Cursos`
- **THEN** ve una tarjeta por cada inscripción real con el código de la comisión, el chip de estado, el nombre del curso, `Docente ·` con el docente real, el horario real, la categoría arancelaria, el banner de acceso y el botón `Ver detalle`

#### Scenario: El alumno tiene un pago sin acreditar

- **WHEN** la inscripción del alumno no tiene ningún pago acreditado
- **THEN** la misma tarjeta se renderiza con el banner `Bloqueado` en rojo, con la causa del bloqueo y con una forma de ir a `Mis Pagos`

#### Scenario: La inscripción está bloqueada

- **WHEN** la inscripción del alumno está bloqueada por Secretaría
- **THEN** la misma tarjeta se renderiza con el banner `Bloqueado` en rojo, la causa del bloqueo que ve Administración y una forma de ir a `Mis Pagos`

#### Scenario: La comisión todavía no tiene docente asignado

- **WHEN** el alumno consulta una inscripción cuya comisión no tiene docente
- **THEN** la tarjeta informa que el docente está a confirmar, sin nombrar a una persona inventada

#### Scenario: El usuario revisa el catálogo de comisiones

- **WHEN** el usuario recorre el listado de comisiones del shell de Administración
- **THEN** no encuentra una segunda tarjeta de curso en el shell del alumno que no corresponda a una inscripción registrada del alumno

#### Scenario: El alumno no tiene inscripciones

- **WHEN** el alumno no tiene ninguna inscripción y la consulta resolvió
- **THEN** ve un mensaje informativo de que no tiene cursos activos, en lugar de una lista vacía sin explicación

#### Scenario: El alumno espera mientras cargan sus cursos

- **WHEN** el alumno abre `Mis Cursos` y la consulta de inscripciones todavía no resolvió
- **THEN** no ve el mensaje de que no tiene cursos activos hasta que la consulta resuelve

### Requirement: Perfil del alumno

El sistema SHALL mostrar una tarjeta de identidad con el avatar formado por las iniciales de la
cuenta de la sesión, el nombre de esa cuenta, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo
podés editar tus datos de contacto.`; y el bloque `Datos personales` con los campos `DNI` y `Nombre`
renderizados como campos deshabilitados con la leyenda `solo lectura`, los campos `Email` y
`Teléfono` editables y el botón `Guardar cambios`. Los valores SHALL venir del perfil real del
alumno autenticado y el sistema SHALL NOT mostrar datos de ejemplo. El DNI y el identificador
asignado por el sistema SHALL permanecer no editables: el sistema SHALL NOT renderizar ningún
control ni acción que los modifique.

`Guardar cambios` SHALL persistir el email y el teléfono en la cuenta y SHALL reflejar el resultado:
con éxito, la confirmación y los valores guardados; con un email que pertenece a otra cuenta, un
mensaje que informa el conflicto y los valores anteriores conservados; con un dato con forma
inválida, un mensaje que indica el campo. Mientras el guardado está en curso, el botón SHALL quedar
deshabilitado para no enviar dos veces.

El perfil SHALL incluir una tarjeta de seguridad con los campos de contraseña actual, nueva y
confirmación, y la acción de cambiar la contraseña. Un cambio exitoso SHALL dejar la nueva
contraseña vigente y SHALL invalidar la anterior. Una contraseña actual incorrecta SHALL mostrar el
rechazo sin cambiar nada.

#### Scenario: El alumno abre su perfil

- **WHEN** el alumno abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con el avatar y el nombre de la cuenta de la sesión, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo podés editar tus datos de contacto.`

#### Scenario: El alumno revisa sus datos personales

- **WHEN** el alumno abre el bloque `Datos personales`
- **THEN** ve su DNI y su nombre reales en campos de solo lectura y su email y teléfono reales en campos editables

#### Scenario: El alumno edita sus datos de contacto

- **WHEN** el alumno modifica `Email` o `Teléfono` y pulsa `Guardar cambios`
- **THEN** el sistema guarda los datos, muestra la confirmación y refleja los valores nuevos en los campos

#### Scenario: El email ya pertenece a otra cuenta

- **WHEN** el alumno intenta guardar un email que ya usa otra cuenta
- **THEN** ve un mensaje que informa el conflicto y los campos conservan los valores anteriores

#### Scenario: El alumno intenta editar el DNI

- **WHEN** el alumno intenta modificar el `DNI` o el identificador asignado por el sistema
- **THEN** los campos aparecen deshabilitados con la leyenda `solo lectura` y la pantalla no ofrece ninguna acción para editarlos

#### Scenario: El alumno cambia su contraseña

- **WHEN** el alumno ingresa su contraseña actual y una nueva contraseña confirmada, y confirma el cambio
- **THEN** la contraseña se actualiza, la anterior deja de ser válida y la pantalla lo informa

#### Scenario: El alumno se equivoca con la contraseña actual

- **WHEN** el alumno ingresa una contraseña actual que no coincide
- **THEN** la pantalla muestra el rechazo y la contraseña sigue siendo la anterior

## REMOVED Requirements

### Requirement: Detalle de curso y acceso a la clase

**Reason**: La cursada del alumno deja de ser contenido de referencia del maquetado y pasa a
mostrar datos reales de la comisión, sus horarios y sus próximos encuentros; el link de la clase
virtual queda fuera hasta la historia #39. El requisito se reemplaza por `Detalle de la cursada y
acceso a la clase`.

**Migration**: La pantalla `CourseDetailPage` conserva las tres variantes del bloque de acceso
(habilitado con link, habilitado sin link, bloqueado) y reemplaza los bloques de cronograma y
encuentros de referencia por los datos del contrato `/alumno`.

## ADDED Requirements

### Requirement: Detalle de la cursada y acceso a la clase

El sistema SHALL mostrar el detalle de la cursada con el nombre del curso y el código de la comisión,
un bloque `Información de la comisión` con `Docente ·` y el nombre real del docente, los días y
horarios reales y el chip `Categoría:` con la categoría real del alumno; y con el bloque de acceso,
que SHALL cubrir tres estados: con el alumno habilitado y el link de la clase ya cargado, el chip
`HABILITADO` en verde, el texto `Tu acceso a la clase está habilitado.` y el botón `Ingresar a la
clase`; con el alumno habilitado y el link todavía no cargado, el mismo chip y el mismo texto con un
mensaje informativo de que el profesor todavía no publicó el link y sin botón de ingreso; y con el
alumno bloqueado, ningún link ni botón de ingreso y solo el estado de bloqueo con su causa.

Mientras la distribución del link de la clase no esté implementada (historia #39), el sistema SHALL
renderizar el estado habilitado sin link con el mensaje informativo y sin botón de ingreso.

El detalle SHALL mostrar un bloque `Cronograma` con la fecha de inicio de la cursada y, cuando no
esté definida, la indicación de que la fecha de fin todavía no está cargada, y un bloque `Próximos
encuentros` con una fila por clase venidera, cada una con fecha y tema, derivadas de los días y
horarios reales de la comisión. El tema SHALL mostrarse como pendiente cuando todavía no esté
cargado. El sistema SHALL NOT mostrar un cronograma ni encuentros de ejemplo, ni el aviso de que son
datos de referencia.

#### Scenario: El alumno está habilitado con link cargado

- **WHEN** el alumno está habilitado y el profesor ya cargó el link de la clase
- **THEN** ve el chip `HABILITADO` en verde, el texto `Tu acceso a la clase está habilitado.` y el botón `Ingresar a la clase`

#### Scenario: El alumno está habilitado sin link cargado

- **WHEN** el alumno está habilitado y el profesor todavía no cargó el link de la clase
- **THEN** ve el chip `HABILITADO` y un mensaje informativo de que el link todavía no está disponible, sin botón de ingreso a la clase

#### Scenario: El alumno está bloqueado

- **WHEN** el alumno está bloqueado
- **THEN** no ve ningún link ni botón de ingreso y solo ve su estado de bloqueo con la causa

#### Scenario: El alumno revisa la información de la comisión

- **WHEN** el alumno abre el detalle de su curso
- **THEN** ve el docente real, los días y horarios reales y el chip con su categoría real

#### Scenario: El alumno consulta el cronograma de la cursada

- **WHEN** el alumno revisa el detalle de su curso
- **THEN** ve el bloque `Cronograma` con la fecha de inicio real y el bloque `Próximos encuentros` con las clases venideras derivadas de sus horarios, cada una con su fecha y su tema o la indicación de que está pendiente

#### Scenario: La comisión todavía no tiene fecha de fin

- **WHEN** el alumno revisa el cronograma de una comisión sin fecha de fin cargada
- **THEN** el bloque informa que la fecha de fin todavía no está definida, sin completarla con un valor de ejemplo

#### Scenario: El alumno abre una comisión ajena

- **WHEN** el alumno intenta abrir el detalle de una comisión en la que no está inscripto
- **THEN** la pantalla informa que no encontró esa cursada y no muestra ningún dato de la comisión
