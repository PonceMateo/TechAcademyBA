# Spec Delta

## MODIFIED Requirements

### Requirement: Estructura y navegación del shell del alumno

The system SHALL renderizar el shell del alumno sobre un fondo con degradado sutil en el tono
del rol, con un panel lateral blanco translúcido **sin rótulo de título**: el panel no lleva el
texto `ESPACIO ALUMNO` ni ninguna categoría de sección. El panel SHALL mostrar la marca del
producto arriba y SHALL ofrecer los ítems de navegación, en este orden exacto: `Mis Cursos`,
`Mis Pagos`, `Pagar la cuota` deshabilitado, `Certificados` deshabilitado y `Mi Perfil`, cada uno
con un ícono y el ítem activo destacado en el acento dorado del rol. El shell SHALL usar un color
de acento dorado distinguible de los shells de Administración y Docente, en reemplazo del
acento terracota anterior. La interfaz SHALL estar escrita en español rioplatense.

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
- **THEN** los ítems aparecen en el orden `Mis Cursos`, `Mis Pagos`, `Pagar la cuota`, `Certificados` y `Mi Perfil`, y solo `Mis Cursos`, `Mis Pagos` y `Mi Perfil` abren pantalla

#### Scenario: El alumno intenta pagar la cuota
- **WHEN** el alumno pulsa `Pagar la cuota`
- **THEN** el ítem permanece deshabilitado con la etiqueta `Próximamente` y no abre ninguna pantalla, porque el pago en línea desde la plataforma queda fuera del alcance mínimo y el prototipo no muestra ningún botón de pago que deshabilitar

#### Scenario: El alumno cambia de pantalla
- **WHEN** el alumno elige un ítem de navegación
- **THEN** el ítem queda destacado como activo y el breadcrumb de la barra superior refleja la sección elegida

#### Scenario: El alumno pulsa la búsqueda o la campana
- **WHEN** el alumno escribe en el campo de búsqueda o pulsa la campana
- **THEN** el contenido de la pantalla no cambia y no se navega a ninguna parte, porque ambos elementos son composición inerte

#### Scenario: El alumno cierra la sesión desde su perfil
- **WHEN** el alumno abre su perfil en la barra superior y elige `Cerrar sesión`
- **THEN** la sesión se cierra y el usuario vuelve al acceso

### Requirement: Historial y carga de comprobantes

The system SHALL mostrar el bloque `Historial de comprobantes` con una fila por comprobante que incluye fecha, importe, medio de pago y estado, y SHALL mostrar el bloque `Cargar comprobante` con los campos `Curso`, `Importe`, `Medio de pago`, un área de adjuntos rotulada `Adjuntar comprobante` y el campo opcional `Pagado por (opcional)`, más el botón `Enviar para validación`. Los estados SHALL renderizarse como `Acreditado` en verde, `Observado` en ámbar y `Rechazado` en rojo.

El historial del maquetado muestra solo los comprobantes imputados al propio alumno, por lo que la única fila es la del 11/05/2026 por `$31.000`, medio `Transferencia`, estado `Acreditado` en verde. La lista SHALL NOT incluir pagos de empresas ni cheques corporativos que no están imputados al alumno. Cuando el pago lo realizó un tercero, la fila SHALL indicarlo de forma explícita junto al importe, porque en este dominio el pagador puede no ser el alumno; en el maquetado esa condición no se activa en ninguna fila porque el comprobante acreditado lo pagó la propia alumna. Un alumno sin pagos SHALL ver un mensaje informativo de que no hay pagos registrados.

Mientras los comprobantes del alumno todavía se están solicitando, el sistema SHALL NOT pintar el `Historial de comprobantes`: hasta que la consulta resuelva, ni las filas ni el mensaje de que no hay pagos registrados SHALL aparecer en pantalla.

#### Scenario: El alumno revisa su historial
- **WHEN** el alumno abre `Mis Pagos`
- **THEN** ve el `Historial de comprobantes` con una única fila del 11/05/2026 por `$31.000`, medio `Transferencia` y estado `Acreditado` en verde

#### Scenario: El alumno revisa el importe de su beca
- **WHEN** el alumno compara el importe acreditado con el arancel de la comisión
- **THEN** ve que la mitad del arancel de `$62.000` está cubierta por su beca parcial del 50%, y la pantalla no muestra ningún cálculo derivado que no esté en los datos del cliente

#### Scenario: El comprobante lo pagó un tercero
- **WHEN** el alumno revisa un comprobante cuyo pago realizó otra persona
- **THEN** la fila indica que el pago lo realizó un tercero, sin dejar de ser un comprobante propio del alumno

#### Scenario: El alumno no ve pagos de terceros
- **WHEN** el alumno revisa su historial buscando pagos de empresas o cheques corporativos
- **THEN** no los encuentra, porque la pantalla muestra únicamente los comprobantes imputados al propio alumno

#### Scenario: El alumno no tiene pagos
- **WHEN** el alumno no tiene ningún comprobante
- **THEN** ve un mensaje informativo de que no hay pagos registrados

#### Scenario: El alumno espera mientras cargan sus comprobantes
- **WHEN** el alumno abre `Mis Pagos` y la consulta de sus comprobantes todavía no resolvió
- **THEN** el `Historial de comprobantes` no se pinta: ni el mensaje de que no hay pagos registrados ni ninguna fila aparecen en pantalla, hasta que la consulta resuelve

#### Scenario: El alumno envía un comprobante
- **WHEN** el alumno completa `Curso` e `Importe`, elige `Medio de pago`, adjunta el archivo y pulsa `Enviar para validación`
- **THEN** el maquetado confirma la recepción del envío y no modifica el estado de habilitación del alumno

### Requirement: Tablero del Alumno en la ruta raíz

The system SHALL mostrar en la ruta raíz del shell del alumno, sobre la tarjeta de cursos que ya
ofrece el requisito `Cursos del alumno`, un encabezado de tablero con el saludo `Buen día,
{nombre de la cuenta}` y una línea de fecha con la fecha real del día que la fuente informa,
formateada para español rioplatense con el día de la semana capitalizado (por ejemplo `Viernes
9 de octubre`), seguida de la frase de apoyo `Cada paso cuenta. Este es tu espacio para
avanzar.`. El nombre es el de la cuenta de la sesión y la fecha SHALL ser un valor calculado a
partir del día corriente, no un literal del maquetado.

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
tarjetas, las tarjetas de las inscripciones y el bloque `Tu agenda` SHALL renderizarse aunque su
dato no exista todavía, y el tablero SHALL NOT eliminar una tarjeta ni un bloque porque la fuente
no pueda responder. Donde la fuente no puede responder, el valor SHALL ser `—`; donde la fuente
responde, SHALL mostrarse el valor real, incluido un `0` real. El valor `—` SHALL significar
"todavía no lo sé" y SHALL NOT significar "cero". Mientras la lectura de las inscripciones no
haya resuelto, cada valor que depende de ella SHALL ser `—`, nunca un `0` ni un literal.

El bloque `Tu agenda` SHALL mostrarse siempre y SHALL caer a su propio mensaje de vacío cuando no
tenga ningún encuentro. La sección `Mis Cursos` SHALL conservar su mensaje de vacío cuando el
alumno no tenga ninguna inscripción.

El tablero SHALL organizarse en dos columnas: a la izquierda, las tarjetas de las inscripciones
que ya lista la pantalla; a la derecha, el bloque `Tu agenda` con una fila por próximo encuentro
de la inscripción, tomado de los mismos datos que muestra el detalle del curso. El tablero SHALL
NOT calcular porcentajes de progreso, asistencia ni avance, y SHALL NOT mostrar bloques de
tareas, calificaciones ni novedades: el maquetado no tiene esas entidades y los valores del
prototipo (`68 %` de progreso, `3` tareas pendientes, `96 %` de asistencia) no son datos del
sistema.

#### Scenario: La alumna abre su tablero
- **WHEN** la alumna abre la raíz de su shell
- **THEN** ve el saludo con su nombre y la línea de fecha real del día, las cuatro tarjetas —`CURSOS EN MARCHA` con la cantidad real de inscripciones, `ACCESO A LA CLASE` con el estado real de la inscripción, `COMPROBANTES ACREDITADOS` con `—` y `PRÓXIMA CLASE` con la clase real o `—`—, sus inscripciones en la columna izquierda y `Tu agenda` con sus próximos encuentros en la derecha

#### Scenario: La alumna espera mientras cargan sus inscripciones
- **WHEN** la alumna abre la raíz de su shell y la consulta de sus inscripciones todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal, hasta que la consulta resuelve

#### Scenario: La alumna no tiene inscripciones
- **WHEN** la alumna no tiene ninguna inscripción
- **THEN** `CURSOS EN MARCHA` muestra un `0` real, `ACCESO A LA CLASE` y `PRÓXIMA CLASE` muestran `—`, el tablero no colapsa a un estado vacío, `Tu agenda` cae a su mensaje de vacío y la sección de cursos conserva su mensaje de que no tiene cursos activos

#### Scenario: La alumna compara el indicador de acceso con su tarjeta
- **WHEN** la alumna revisa `ACCESO A LA CLASE` y la tarjeta de su inscripción
- **THEN** ambas muestran el mismo estado, porque el indicador refleja el campo de la inscripción y no un cálculo

#### Scenario: La alumna tiene el acceso bloqueado
- **WHEN** la inscripción de la alumna está bloqueada por un comprobante observado
- **THEN** el indicador `ACCESO A LA CLASE` muestra `BLOQUEADO` en rojo con la causa, junto con la tarjeta que ya la informa

#### Scenario: La alumna busca sus tareas o sus calificaciones
- **WHEN** la alumna recorre el tablero buscando tareas pendientes, calificaciones o un porcentaje de progreso
- **THEN** no los encuentra, porque esas entidades no existen en el maquetado

### Requirement: Perfil del alumno

The system SHALL mostrar una tarjeta de identidad con el avatar formado por las iniciales de la cuenta de la sesión, el nombre de esa cuenta, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo podés editar tus datos de contacto.`; y el bloque `Datos personales` con los campos `DNI` y `Nombre` renderizados como campos deshabilitados con la leyenda `solo lectura`, los campos `Email` y `Teléfono` editables y el botón `Guardar cambios`. Los valores del maquetado son `40.112.233` en el DNI, `Camila Rodríguez` en el nombre, `cami_rod@hotmail.com` en el email y `011 4788-1122` en el teléfono, tomados de los datos del cliente. El DNI y el identificador asignado por el sistema SHALL permanecer no editables: el sistema SHALL NOT renderizar ningún control ni acción que los modifique. La tarjeta de identidad SHALL NOT mostrar un avatar ni un nombre literales del maquetado.

#### Scenario: El alumno abre su perfil
- **WHEN** el alumno abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con el avatar y el nombre de la cuenta de la sesión —no un avatar ni un nombre literales del maquetado—, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo podés editar tus datos de contacto.`

#### Scenario: El alumno revisa sus datos personales
- **WHEN** el alumno abre el bloque `Datos personales`
- **THEN** ve `40.112.233` en el campo `DNI`, `Camila Rodríguez` en `Nombre`, `cami_rod@hotmail.com` en `Email` y `011 4788-1122` en `Teléfono`

#### Scenario: El alumno edita sus datos de contacto
- **WHEN** el alumno modifica `Email` o `Teléfono` y pulsa `Guardar cambios`
- **THEN** el maquetado muestra la confirmación de la edición y refleja el nuevo valor en el campo

#### Scenario: El alumno intenta editar el DNI
- **WHEN** el alumno intenta modificar el `DNI` o el identificador asignado por el sistema
- **THEN** los campos aparecen deshabilitados con la leyenda `solo lectura` y el maquetado no ofrece ninguna acción para editarlos
