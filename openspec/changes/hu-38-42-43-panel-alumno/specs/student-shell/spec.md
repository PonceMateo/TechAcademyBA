# Spec Delta

## MODIFIED Requirements

### Requirement: Estructura y navegación del shell del alumno

The system SHALL renderizar el shell del alumno sobre un fondo con degradado sutil en el tono
del rol, con un panel lateral blanco translúcido **sin rótulo de título**: el panel no lleva el
texto `ESPACIO ALUMNO` ni ninguna categoría de sección. El panel SHALL mostrar la marca del
producto arriba y SHALL ofrecer los ítems de navegación, en este orden exacto: `Dashboard`,
`Mis Cursos`, `Mis Pagos`, `Pagar la cuota` deshabilitado, `Certificados` deshabilitado y `Mi
Perfil`, cada uno con un ícono y el ítem activo destacado en el acento dorado del rol. `Dashboard`
SHALL abrir la raíz del shell y `Mis Cursos` SHALL abrir la pantalla con las tarjetas de las
cursadas, en `/alumno/cursos`; el shell SHALL usar un color de acento dorado distinguible de los
shells de Administración y Docente, en reemplazo del acento terracota anterior. La interfaz SHALL
estar escrita en español rioplatense.

The system SHALL renderizar una barra superior con, de izquierda a derecha: un breadcrumb
`Mi espacio > [etiqueta del ítem activo]` que refleja la pantalla abierta; un campo de búsqueda
`Buscar en la plataforma` con la tecla de atajo `⌘ K`, **inerte**, que SHALL mostrarse pero
SHALL NOT filtrar ni navegar; una campana de notificaciones con punto de no leído, **inerte**;
y un bloque de perfil con el avatar, el nombre de la cuenta de la sesión, el rol `Alumno` y un
menú desplegable con una única entrada, `Cerrar sesión`, que sí funciona. La barra superior
SHALL NOT renderizar el chip `Rol Alumno · Solo mi información` ni el texto
`Período Lectivo 2026`.

The system SHALL renderizar un pie con, en este orden, `TechAcademy BA · Aprendemos, crecemos,
conectamos.` y el texto `Período Lectivo 2026`. El período lectivo SHALL renderizarse como
`Período Lectivo 2026`, aunque el prototipo muestre `Periodo Lectivo 2025` o `Ciclo lectivo
2026`: es una corrección intencional de la línea temporal del proyecto. El pie SHALL NOT
renderizar el avatar `CR`, el nombre `Camila Rodríguez` ni el rol `ALUMNO`, y SHALL NOT mostrar
ninguna línea de `Última actualización`: el pie se limita al tagline y al período lectivo.

#### Scenario: El alumno abre su espacio
- **WHEN** un usuario con rol alumno se autentica y abre una pantalla de su shell
- **THEN** ve el lateral sin rótulo de título con la marca y sus ítems con ícono en acento dorado, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline y `Período Lectivo 2026`

#### Scenario: El alumno recorre la navegación
- **WHEN** el alumno abre el panel lateral
- **THEN** los ítems aparecen en el orden `Dashboard`, `Mis Cursos`, `Mis Pagos`, `Pagar la cuota`, `Certificados` y `Mi Perfil`, y solo `Dashboard`, `Mis Cursos`, `Mis Pagos` y `Mi Perfil` abren pantalla

#### Scenario: El alumno intenta pagar la cuota
- **WHEN** el alumno pulsa `Pagar la cuota`
- **THEN** el ítem permanece deshabilitado con la etiqueta `Próximamente` y no abre ninguna pantalla, porque el pago en línea desde la plataforma queda fuera del alcance mínimo y el prototipo no muestra ningún botón de pago que deshabilitar

#### Scenario: El alumno cambia de pantalla
- **WHEN** el alumno elige un ítem de navegación
- **THEN** el ítem queda destacado como activo y el breadcrumb de la barra superior refleja la sección elegida, incluso cuando abre el detalle de una cursada desde `Mis Cursos`

#### Scenario: El alumno pulsa la búsqueda o la campana
- **WHEN** el alumno escribe en el campo de búsqueda o pulsa la campana
- **THEN** el contenido de la pantalla no cambia y no se navega a ninguna parte, porque ambos elementos son composición inerte

#### Scenario: El alumno cierra la sesión desde su perfil
- **WHEN** el alumno abre su perfil en la barra superior y elige `Cerrar sesión`
- **THEN** la sesión se cierra y el usuario vuelve al acceso

### Requirement: Cursos del alumno

El sistema SHALL mostrar una tarjeta por comisión inscripta con el chip del código de comisión, un
chip de estado, el título del curso, la línea `Docente ·` seguida del nombre del docente, el resumen
legible de días y horarios, la categoría arancelaria, un banner de acceso grande con `Habilitado` en
verde o `Bloqueado` en rojo, y un botón `Ver detalle`. Todos esos valores SHALL venir de las
inscripciones reales del alumno: el sistema SHALL NOT mostrar cursos, docentes, códigos ni
categorías de ejemplo. Este listado SHALL vivir en la pantalla `Mis Cursos` (`/alumno/cursos`),
alcanzable desde el ítem del panel lateral, y SHALL NO formar parte del tablero de la raíz.

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

### Requirement: Tablero del Alumno en la ruta raíz

The system SHALL mostrar en la raíz del shell del alumno —el ítem `Dashboard` del panel lateral— un
encabezado de tablero con el saludo `Buen día, {nombre de la cuenta}` y una línea de fecha con la
fecha real del día que la fuente informa, formateada para español rioplatense con el día de la
semana capitalizado (por ejemplo `Viernes 9 de octubre`), seguida de la frase de apoyo `Cada paso
cuenta. Este es tu espacio para avanzar.`. El nombre es el de la cuenta de la sesión y la fecha
SHALL ser un valor calculado a partir del día corriente, no un literal del maquetado.

The system SHALL mostrar cuatro tarjetas de indicador: `CURSOS EN MARCHA` cuyo valor SHALL ser la
cantidad real de inscripciones del alumno y cuyo texto de apoyo SHALL nombrar esas inscripciones
—código y nombre del curso—, con un `0` real cuando el alumno no tiene ninguna; `ACCESO A LA
CLASE` con el valor tomado del estado de la inscripción real —`HABILITADO` en verde o `BLOQUEADO`
en rojo con su causa—, que es un campo existente y no un cálculo, con `—` cuando el alumno no
tiene ninguna inscripción; `COMPROBANTES ACREDITADOS` con el valor `—`, porque no existe ningún
endpoint de pagos del alumno que respalde su valor; y `PRÓXIMA CLASE` cuyo valor SHALL tomarse
del cronograma real de la inscripción y cuyo texto de apoyo SHALL nombrar el curso real, con `—`
cuando no hay ninguna próxima clase.

El tablero SHALL conservar siempre su forma y SHALL NOT colapsar a su estado vacío: las cuatro
tarjetas y el bloque `Tu agenda` SHALL renderizarse aunque su dato no exista todavía, y el tablero
SHALL NOT eliminar una tarjeta ni un bloque porque la fuente no pueda responder. Donde la fuente no
puede responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse el valor real,
incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT significar
"cero". Mientras la lectura de las inscripciones no haya resuelto, cada valor que dependa de ella
SHALL ser `—`, nunca un `0` ni un literal.

El bloque `Tu agenda` SHALL mostrarse siempre y SHALL caer a su propio mensaje de vacío cuando no
tenga ningún encuentro; si la lectura de las inscripciones falla, el bloque SHALL informar el fallo
en lugar de afirmar que no hay encuentros. Cada fila de la agenda SHALL mostrar la fecha del
encuentro junto a su horario y el curso al que pertenece, y SHALL mostrar el tema solo cuando esté
cargado: el sistema SHALL NOT renderizar ningún texto de tema de relleno. Las tarjetas de las
inscripciones NO forman parte del tablero: viven en la pantalla `Mis Cursos`, y la pantalla `Mis
Cursos` es la que conserva su mensaje de vacío cuando el alumno no tiene ninguna inscripción.

El tablero SHALL organizarse en dos bloques: arriba el encabezado y los cuatro indicadores, y
debajo el bloque `Tu agenda` con una fila por próximo encuentro de las inscripciones, tomado de los
mismos datos que muestra el detalle del curso. El tablero SHALL NOT calcular porcentajes de
progreso, asistencia ni avance, y SHALL NOT mostrar bloques de tareas, calificaciones ni
novedades: el maquetado no tiene esas entidades y los valores del prototipo (`68 %` de progreso,
`3` tareas pendientes, `96 %` de asistencia) no son datos del sistema.

#### Scenario: La alumna abre su tablero
- **WHEN** la alumna abre la raíz de su shell
- **THEN** ve el saludo con su nombre y la línea de fecha real del día, las cuatro tarjetas —`CURSOS EN MARCHA` con la cantidad real de inscripciones, `ACCESO A LA CLASE` con el estado real de la inscripción, `COMPROBANTES ACREDITADOS` con `—` y `PRÓXIMA CLASE` con la clase real o `—`— y `Tu agenda` con sus próximos encuentros, sin las tarjetas de las cursadas

#### Scenario: La alumna espera mientras cargan sus inscripciones
- **WHEN** la alumna abre la raíz de su shell y la consulta de sus inscripciones todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal, hasta que la consulta resuelve

#### Scenario: La alumna no tiene inscripciones
- **WHEN** la alumna no tiene ninguna inscripción
- **THEN** `CURSOS EN MARCHA` muestra un `0` real, `ACCESO A LA CLASE` y `PRÓXIMA CLASE` muestran `—`, el tablero no colapsa a un estado vacío y `Tu agenda` cae a su mensaje de vacío, mientras que la pantalla `Mis Cursos` es la que muestra el mensaje de que no tiene cursos activos

#### Scenario: La alumna compara el indicador de acceso con su tarjeta
- **WHEN** la alumna revisa `ACCESO A LA CLASE` en el tablero y la tarjeta de su inscripción en `Mis Cursos`
- **THEN** ambas muestran el mismo estado, porque el indicador refleja el campo de la inscripción y no un cálculo

#### Scenario: La alumna tiene el acceso bloqueado
- **WHEN** la inscripción de la alumna está bloqueada por un comprobante observado
- **THEN** el indicador `ACCESO A LA CLASE` muestra `BLOQUEADO` en rojo con la causa, junto con la tarjeta de `Mis Cursos` que también la informa

#### Scenario: La alumna revisa su agenda
- **WHEN** la alumna mira un encuentro de `Tu agenda`
- **THEN** ve la fecha junto al horario de ese día y el nombre del curso, y ve el tema solo si la clase de esa fecha ya está cargada, sin ningún texto de tema de relleno

#### Scenario: La alumna busca sus tareas o sus calificaciones
- **WHEN** la alumna recorre el tablero buscando tareas pendientes, calificaciones o un porcentaje de progreso
- **THEN** no los encuentra, porque esas entidades no existen en el maquetado

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
encuentros` con una fila por clase venidera, cada una con su fecha, el horario de ese día y el tema
de la clase, derivadas de los días y horarios reales de la comisión. Cuando todavía no haya tema
cargado para esa fecha, la fila SHALL mostrar la fecha y el horario y SHALL NO completar ningún
texto de tema en su lugar: no existe un "tema a confirmar" en el dominio. El sistema SHALL NOT
mostrar un cronograma ni encuentros de ejemplo, ni el aviso de que son datos de referencia.

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
- **THEN** ve el bloque `Cronograma` con la fecha de inicio real y el bloque `Próximos encuentros` con las clases venideras derivadas de sus horarios, cada una con su fecha, su horario y su tema cuando exista

#### Scenario: La comisión todavía no tiene fecha de fin

- **WHEN** el alumno revisa el cronograma de una comisión sin fecha de fin cargada
- **THEN** el bloque informa que la fecha de fin todavía no está definida, sin completarla con un valor de ejemplo

#### Scenario: El alumno abre una comisión ajena

- **WHEN** el alumno intenta abrir el detalle de una comisión en la que no está inscripto
- **THEN** la pantalla informa que no encontró esa cursada y no muestra ningún dato de la comisión
