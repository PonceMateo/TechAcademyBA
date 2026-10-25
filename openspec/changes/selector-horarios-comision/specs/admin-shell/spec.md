# Spec Delta

## MODIFIED Requirements

### Requirement: Comisiones activas y alta de comisión

The system SHALL mostrar la sección `Cursos y Comisiones` como dos vistas encadenadas en lugar de
un listado único. La **vista de cursos**, en la ruta `/admin/cursos`, SHALL mostrar un grid con una
tarjeta por cada curso del catálogo y las acciones `+ Nuevo Curso` y `+ Nueva Comisión`, más el chip
del total de comisiones del catálogo —`10 en el catálogo` con los datos de ejemplo—. Cada tarjeta
SHALL mostrar el nombre del curso, su código, su descripción y la cantidad de comisiones que tiene, y
SHALL ser activable con un click sobre la tarjeta o sobre el botón `Abrir comisiones` de esa tarjeta.
Cada tarjeta SHALL mostrar además un botón `⋮` que despliega la acción `Editar curso`; ese botón SHALL
NOT abrir el curso, SHALL ser accesible por teclado, SHALL anunciar si el menú está abierto y el menú
SHALL cerrarse al elegir la acción, al pulsar `Escape` o al hacer un click afuera.

La **vista de comisiones del curso**, en la ruta `/admin/cursos/:codigo`, SHALL mostrar la tabla de
comisiones del curso de la ruta con el chip del total del catálogo, el nombre y el código del curso a
la vista, la acción `Volver a cursos` y la acción `+ Nueva Comisión`. La tabla SHALL conservar las
columnas, con estos rótulos literales y en este orden: `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`,
`HORARIO`, `CUPO MÁX.`, `VACANTES`, `ARANCEL` y `ACCIONES`, y SHALL contener solamente las comisiones del curso
de la ruta. La vista de comisiones del curso SHALL NOT ofrecer la acción `+ Nuevo Curso`: dentro de
un curso no tiene sentido dar de alta otro curso.

La tabla de la vista de comisiones del curso SHALL mostrar las comisiones que devuelve el catálogo,
con los datos que la fuente informa de cada una. La pantalla SHALL NOT inventar cursos ni comisiones
para completar el catálogo.

Cuando los datos de la pantalla salen del ejemplo —el modo `mock`, que solo entra cuando un endpoint
no existe— las filas son un subconjunto de las diez comisiones del cliente, y cada comisión del
ejemplo se arma con horarios estructurados, de modo que la columna `HORARIO` muestra el texto que
deriva de ellos: `CUR-101` Python Inicial con Profe Martín, `Mar y Jue 19-21hs`, cupo 30, 7 vacantes
y arancel `$45.000`; `CUR-104` Diseño UX/UI Avanzado con Caro UX, `Mié 19-22hs`, cupo 20, 0
vacantes y `$52.000`; `CUR-108` Java Backend Spring con Ing. González, `Sáb 9-13hs`, cupo 30, 30
vacantes y `$58.000`; `CUR-110` Power BI & Dashboards con Mariana Data, `Mar y Jue 18:30-20:30hs`,
cupo 40, 40 vacantes y `$39.000`; y `CUR-103` Marketing Digital & Ads con Santi Ads, `Sáb 10-13hs`,
cupo 40, 40 vacantes y `$38.000`. El modo mock SHALL NOT guardar horarios que el selector no podría
producir: los textos del ejemplo salen de los horarios estructurados, no de escribirlos a mano. En
el modo por omisión las filas son las que hay en la base, no las del ejemplo.

La columna `VACANTES` SHALL mostrar el conteo de vacantes que la fuente informa para cada comisión, y
cuando valga 0 la fila SHALL llevar el chip `LLENO` en rojo junto al valor. En los datos de ejemplo
la fila de `CUR-104` es la única con 0 vacantes, porque el cliente la registra con estado `Cerrada
por cupo`.

La columna `HORARIO` SHALL usar el renderer compacto del horario: una línea con ellipsis, el texto
completo en el tooltip y, cuando el horario tenga más de un grupo de días, el badge `+N` que abre un
popover con la lista completa. El `N` del badge SHALL ser la cantidad de grupos de días que no
entran en la línea: con dos grupos en la celda el badge dice `+1`, y con un solo grupo no hay badge.

El sistema SHALL abrir el modal `Crear Nueva Comisión` con los campos, en este orden literal:
`Curso / Programa`, `Docente Asignado`, `Días y Horarios`, `Cupo Máximo`, `Valor de Arancel de
Comisión (AR$)` y `Modalidad`, más `Sede` cuando el campo corresponda renderizarse, con los botones
`Cancelar` y `Guardar Comisión`. La fila `Días y Horarios` SHALL ocupar el ancho completo del modal y
SHALL mostrar el horario cargado como chips de solo lectura —un chip por cada grupo de días con el
mismo rango, con `flex-wrap` y sin truncar—, más el botón `Agregar horarios` cuando no hay ninguno o
`Modificar horarios` cuando ya hay alguno. WHEN no haya horarios, la fila SHALL mostrar el texto
`Sin horarios definidos`. El campo SHALL ser obligatorio: sin horarios, el formulario SHALL mostrar
el error `Agregá al menos un horario` bajo el campo y SHALL NOT crear la comisión. El modal SHALL
tener una altura máxima con scroll interno, de modo que el campo de horarios, el resto de los campos
y el pie del modal se puedan ver sin salirse de la ventana. El modal SHALL NOT pedir un código de
comisión: el código lo deriva el sistema del curso y del número, y la pantalla lo muestra al
confirmar. `Docente Asignado` SHALL ser una selección de los docentes del padrón y SHALL NOT ser un
campo de búsqueda de texto libre. `Modalidad` SHALL ofrecer `Virtual`, `Presencial` y `Híbrido`.
`Sede` SHALL ser opcional en toda modalidad: SHALL renderizarse solo cuando la modalidad elegida sea
`Presencial` o `Híbrido`, y SHALL NOT renderizarse cuando la modalidad sea `Virtual` ni mientras el
selector siga en `Seleccionar…`, que es como abre el modal.

WHEN el modal de alta de comisión se abre desde la vista de comisiones del curso, el campo
`Curso / Programa` SHALL venir elegido con el curso de la ruta y SHALL quedar bloqueado a ese curso,
porque la comisión que se está creando pertenece a ese curso. WHEN el modal se abre desde la vista
de cursos, `Curso / Programa` SHALL venir vacío y editable, y el selector SHALL ofrecer cualquier
curso del catálogo.

La pantalla SHALL abrir además el modal `Crear Nuevo Curso`, con los campos `Nombre del Curso` y
`Descripción` y sin ningún campo de código. La adición de la modal de curso es intencional: sin ella
el catálogo no tiene forma de crecer, y el selector de curso de la comisión se armaba con las
comisiones existentes, así que un curso nuevo no podía abrir su primera comisión.

Ambas vistas SHALL mostrar su campo de búsqueda con el control deshabilitado y una leyenda que
explique que todavía no filtra. Los buscadores SHALL NOT filtrar el contenido de la vista: la
funcionalidad de búsqueda queda para otro change y el campo deshabilitado existe para dejar el hueco
a la vista, igual que los controles marcados `Próximamente`.

WHEN el código de la ruta no corresponde a ningún curso del catálogo, el sistema SHALL informar que
el curso no existe y ofrecer el regreso a la vista de cursos. El sistema SHALL NOT mostrar una tabla
de comisiones vacía en ese caso, porque se leería como que el curso no tiene comisiones.

Esta pantalla SHALL confirmar sus altas contra la base: un alta aceptada SHALL mostrar el código que
devuelve el sistema, un alta rechazada SHALL dejar el formulario abierto con el motivo tal como lo
informa la fuente, y un alta que no llega a la base SHALL fallar sin mostrar ninguna confirmación.

La pantalla SHALL abrir el modal `Editar Curso` desde la acción `Editar curso` del menú `⋮`, con los
campos `Nombre del Curso` y `Descripción` precargados con los valores actuales y sin ningún campo de
código, y con los botones `Cancelar` y `Guardar Cambios`. Un guardado aceptado SHALL actualizar la
tarjeta del curso en el catálogo y mostrar una confirmación; un rechazo SHALL dejar el modal abierto
con el motivo que informa la fuente y SHALL NOT confirmar la edición.

La columna `ACCIONES` SHALL mostrar el botón `Editar` en cada fila. La pantalla SHALL abrir el modal
`Editar Comisión` con los campos `Docente Asignado`, `Días y Horarios` —con el mismo tratamiento de
chips de solo lectura y botón `Modificar horarios` que en el alta—, `Cupo Máximo` y `Valor de Arancel
de Comisión (AR$)`, precargados con los valores actuales, y SHALL NOT mostrar los campos
`Curso / Programa`, `Modalidad`, `Sede` ni ningún campo de código. El modal SHALL mostrar la cantidad
de inscriptos activos de la comisión y SHALL usar los botones `Cancelar` y `Guardar Cambios`. Los
horarios se cargan con el selector de horarios y se envían estructurados; la pantalla SHALL NOT pedir
ni enviar el horario como texto libre.

WHEN el cupo máximo informado sea menor que la cantidad de inscriptos activos, la pantalla SHALL
rechazar el guardado e informar la cantidad actual, sin cerrar el modal ni confirmar la edición. Un
guardado aceptado SHALL actualizar la fila de la tabla con la comisión y las vacantes que devuelve la
fuente y SHALL mostrar una confirmación; un rechazo de la fuente SHALL dejar el modal abierto con el
motivo. La pantalla SHALL NOT modificar inscripciones ni pagos al editar la comisión.

WHEN la fuente rechaza el guardado con un `409`, la pantalla SHALL mostrar el motivo bajo el campo
`Días y Horarios` del formulario de comisión —con la comisión en conflicto, su día y su rango cuando
el rechazo sea por choque de horario—, y SHALL NOT cerrar el formulario ni confirmar el guardado.
Cualquier `409` del guardado SHALL mostrarse en ese mismo lugar, sin que la pantalla tenga que
distinguir el motivo por el texto del mensaje: no hay otro campo del formulario que lo produzca, y el
de numeración solo aparece ante dos altas simultáneas del mismo curso.

#### Scenario: El usuario revisa el listado de comisiones
- **WHEN** el usuario abre un curso del catálogo desde la vista de cursos
- **THEN** ve el bloque `Comisiones Activas` de ese curso con las columnas `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`, `HORARIO`, `CUPO MÁX.`, `VACANTES`, `ARANCEL` y `ACCIONES` en ese orden, y las comisiones de ese curso con su arancel formateado

#### Scenario: El usuario abre la vista de cursos
- **WHEN** un usuario de Secretaría abre `Cursos y Comisiones`
- **THEN** ve el chip `10 en el catálogo`, las acciones `+ Nuevo Curso` y `+ Nueva Comisión`, el buscador deshabilitado y el grid con una tarjeta por curso del catálogo, cada una con nombre, código, descripción y cantidad de comisiones

#### Scenario: El usuario compara el conteo de un curso con su tabla
- **WHEN** el usuario mira la cantidad de comisiones de una tarjeta y abre ese curso
- **THEN** la tabla de ese curso tiene exactamente las mismas filas que la cantidad anunciada en la tarjeta

#### Scenario: El usuario abre un curso
- **WHEN** el usuario pulsa una tarjeta del curso o su botón `Abrir comisiones`
- **THEN** ve la tabla de comisiones de ese curso, con el nombre y el código del curso a la vista, y la dirección de la pantalla es la de ese curso

#### Scenario: El usuario vuelve al catálogo
- **WHEN** el usuario pulsa `Volver a cursos` desde la vista de un curso
- **THEN** ve de nuevo el grid de cursos del catálogo

#### Scenario: El usuario crea una comisión dentro de un curso
- **WHEN** el usuario abre un curso y pulsa `+ Nueva Comisión`
- **THEN** el modal abre con `Curso / Programa` ya elegido con ese curso y bloqueado, y la pantalla **no** ofrece `+ Nuevo Curso`

#### Scenario: El usuario crea una comisión desde la vista de cursos
- **WHEN** el usuario pulsa `+ Nueva Comisión` en la vista de cursos
- **THEN** el modal abre con `Curso / Programa` vacío y editable, ofreciendo cualquier curso del catálogo

#### Scenario: El usuario busca la comisión cerrada por cupo
- **WHEN** el usuario abre el curso de `CUR-104` Diseño UX/UI Avanzado
- **THEN** ve `VACANTES` con valor 0 y el chip `LLENO` en rojo junto a la fila

#### Scenario: El usuario compara las vacantes con el cupo
- **WHEN** el usuario recorre la columna `VACANTES` de los datos de ejemplo
- **THEN** ve que `CUR-103` y `CUR-110` conservan su cupo completo como vacantes y que solo `CUR-104` aparece cerrada por cupo

#### Scenario: El usuario abre el modal de alta
- **WHEN** el usuario pulsa `+ Nueva Comisión`
- **THEN** el modal `Crear Nueva Comisión` muestra los campos en el orden `Curso / Programa`, `Docente Asignado`, `Días y Horarios`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)` y `Modalidad`, con los botones `Cancelar` y `Guardar Comisión`, no muestra ningún campo para el código de la comisión porque el sistema lo genera, y tampoco muestra `Sede`: el modal abre con `Modalidad` en `Seleccionar…` y el campo aparece recién cuando la modalidad elegida sea `Presencial` o `Híbrido`

#### Scenario: La fila de horarios empieza vacía
- **WHEN** el usuario abre el modal de alta de una comisión
- **THEN** la fila `Días y Horarios` ocupa el ancho completo, muestra `Sin horarios definidos` y el botón `Agregar horarios`

#### Scenario: El usuario carga los horarios y ve el resumen
- **WHEN** el usuario agrega lunes y miércoles de 19:00 a 21:00 y martes de 18:15 a 21:30 y confirma el selector
- **THEN** la fila muestra dos chips de solo lectura —`Lun y Mié 19-21hs` y `Mar 18:15-21:30hs`— con flex-wrap y sin truncar, y el botón pasa a llamarse `Modificar horarios`

#### Scenario: El usuario intenta guardar sin horarios
- **WHEN** el usuario deja la fila `Días y Horarios` sin ningún horario y pulsa `Guardar Comisión` o `Guardar Cambios`
- **THEN** el formulario muestra el error `Agregá al menos un horario` bajo el campo y no crea ni actualiza la comisión

#### Scenario: El choque de horario se muestra bajo el campo
- **WHEN** la fuente rechaza el guardado con un choque de horario del docente
- **THEN** el motivo aparece bajo `Días y Horarios` con la comisión en conflicto, su día y su rango, y el formulario de comisión sigue abierto

#### Scenario: Otro conflicto del guardado se muestra en el mismo lugar
- **WHEN** la fuente rechaza el guardado con un `409` que no es de horario, por ejemplo el de dos altas simultáneas del mismo curso
- **THEN** el motivo aparece bajo el mismo campo `Días y Horarios`, y la pantalla no cierra el formulario ni confirma el guardado

#### Scenario: El usuario elige modalidad virtual
- **WHEN** el usuario selecciona modalidad `Virtual` y confirma sin elegir sede
- **THEN** el sistema acepta la carga y el campo `Sede` no está renderizado en el modal, porque la sede es opcional en toda modalidad y no corresponde mostrarla para `Virtual`

#### Scenario: El usuario elige modalidad presencial sin sede
- **WHEN** el usuario selecciona modalidad `Presencial` o `Híbrido`, deja `Sede` vacío y confirma
- **THEN** el sistema guarda la comisión y la confirma, porque el campo `Sede` es opcional y su ausencia no impide el alta. El nombre del escenario conserva el de la regla anterior: ya no se rechaza el alta por falta de sede

#### Scenario: El usuario busca en el catálogo
- **WHEN** el usuario escribe en el buscador de cualquiera de las dos vistas
- **THEN** el campo no acepta la escritura y su leyenda explica que la búsqueda todavía no está disponible, y el contenido de la vista no cambia

#### Scenario: La ruta apunta a un curso que no existe
- **WHEN** el usuario abre la dirección de un curso que no está en el catálogo
- **THEN** ve que el curso no existe y puede volver al catálogo, en lugar de una tabla de comisiones vacía

#### Scenario: El usuario busca una acción de edición

- **WHEN** el usuario recorre la tabla de comisiones y las tarjetas de curso
- **THEN** encuentra el botón `Editar` en cada fila de comisión y la acción `Editar curso` en el menú `⋮` de cada tarjeta

#### Scenario: El usuario edita una comisión

- **WHEN** el usuario pulsa `Editar` en una comisión, cambia el docente, los horarios, el cupo o el arancel y guarda
- **THEN** el modal se cierra, la fila muestra los nuevos valores y vacantes, y la pantalla confirma que la comisión se actualizó

#### Scenario: El usuario reduce el cupo por debajo de los inscriptos

- **WHEN** el usuario intenta guardar un cupo máximo menor que la cantidad de inscriptos activos
- **THEN** el modal queda abierto, informa la cantidad actual de inscriptos y la fila conserva su cupo anterior

#### Scenario: El modal de edición no cambia el curso ni la modalidad

- **WHEN** el usuario abre `Editar Comisión`
- **THEN** ve solo docente, el bloque de horarios, cupo y arancel, y no ve campos para el curso, la modalidad, la sede ni el código

#### Scenario: El usuario edita un curso

- **WHEN** el usuario abre el menú `⋮` de una tarjeta, elige `Editar curso`, cambia el nombre o la descripción y guarda
- **THEN** el modal se cierra, la tarjeta muestra los nuevos datos y la pantalla confirma que el curso se actualizó

#### Scenario: El menú no abre el curso

- **WHEN** el usuario pulsa el botón `⋮` de una tarjeta
- **THEN** se despliega la acción `Editar curso` y la pantalla NO navega a la vista de comisiones de ese curso

#### Scenario: El usuario edita con un nombre duplicado

- **WHEN** el usuario intenta guardar un nombre que ya pertenece a otro curso
- **THEN** el modal queda abierto, muestra el motivo que devuelve la fuente y la tarjeta conserva sus datos anteriores

## ADDED Requirements

### Requirement: Selector de horarios de comisión

La pantalla SHALL cargar los horarios de una comisión con un selector propio, con el título literal
`Horario de cursada`, que se abre **superpuesto sobre el modal de comisión**: el foco SHALL quedar
atrapado dentro del selector, y `Escape` SHALL cerrar solo el selector sin tocar el formulario de
comisión. El selector SHALL usar la paleta del rol de Administración. `Listo` SHALL devolver los
horarios al estado del formulario de comisión sin llamar a la API; `Cancelar` o el cierre del
selector SHALL descartar lo que se haya cambiado adentro.

El selector SHALL ofrecer el switch `Mismo horario todos los días`, **activado por defecto**.
WHEN el switch esté activado, el selector SHALL mostrar los siete chips de día —`LU`, `MA`, `MI`,
`JU`, `VI`, `SÁ` y `DO`— y un único selector de rango. WHEN el switch esté desactivado, el selector
SHALL mostrar una fila por día: cada día activo SHALL mostrar su propio selector de rango, y los
días apagados SHALL NOT mostrar selector ni enviar su horario. Cada día SHALL admitir a lo sumo un
rango.

Al abrir, el selector SHALL arrancar sin ningún día activo WHEN todavía no haya horarios
guardados, y SHALL arrancar con activos solo los días que ya tienen horario WHEN se edite uno
existente.

SHALL ser obligatorio tener al menos un día activo: sin días activos, el botón `Listo` SHALL quedar
deshabilitado y el selector SHALL NOT devolver horarios vacíos.

WHEN el usuario pase de `mismo` a `distinto`, el rango elegido SHALL copiarse a todos los días
activos. WHEN vuelva a `mismo` con rangos distintos entre los días activos, el selector SHALL pedir
confirmación y, al confirmar, SHALL aplicar el rango del primer día activo a todos los días activos.

Los rangos SHALL ir de 6:00 a 22:00 en pasos de 15 minutos: el inicio MAY llegar como máximo a
21:45 y el fin SHALL ser estrictamente posterior al inicio. El fin SHALL tener una duración por
defecto de dos horas: WHEN el usuario elija un inicio, el fin SHALL quedar en `min(inicio + 2 hs,
22:00)` —19:00 da 21:00 y 21:00 da 22:00— y SHALL recalcularse solo cuando el fin no haya sido
editado a mano o cuando haya quedado menor o igual al inicio. El selector de hora SHALL ofrecer las
opciones generadas cada 15 minutos y MAY permitir tipear: WHEN el operador tipee un valor que no sea
múltiplo de 15, SHALL redondearlo al más cercano acotado a 6:00–22:00 —13:42 da 13:45 y 21:19 da
21:15—, y WHEN el texto no se pueda interpretar SHALL restaurar el valor anterior.

Los chips de día SHALL ser botones operables con teclado y SHALL anunciar su estado con
`aria-pressed`. El resumen del formulario y el renderer de tabla SHALL salir de una única función
que agrupa los días con el mismo rango: los días en orden de semana, y la hora sin minutos cuando
estos valen cero —`19-22hs`— y con minutos cuando no —`18:15-21:30hs`—.

#### Scenario: Selector en modo mismo horario

- **WHEN** el usuario abre el selector con el switch `Mismo horario todos los días` activado, marca lunes, miércoles y viernes y elige 19:00–21:00
- **THEN** ve los siete chips de día activables y un único selector de rango, y al pulsar `Listo` el formulario recibe un horario por cada día marcado con ese mismo rango

#### Scenario: Selector en modo distinto

- **WHEN** el usuario desactiva el switch y marca lunes y martes
- **THEN** cada día activo muestra su propio selector de rango, los días apagados no muestran selector ni se envían, y al pulsar `Listo` el formulario recibe un solo rango por día

#### Scenario: Sin días activos no se puede confirmar

- **WHEN** el usuario desmarca todos los días
- **THEN** el botón `Listo` queda deshabilitado y el selector no devuelve horarios

#### Scenario: Cambio de modo mismo a distinto

- **WHEN** el selector está en modo `mismo` con un rango elegido y el usuario desactiva el switch
- **THEN** el rango se copia a todos los días activos y cada día queda editable por separado

#### Scenario: Cambio de modo distinto a mismo

- **WHEN** el selector está en modo `distinto` con rangos distintos entre los días activos y el usuario vuelve a activar el switch
- **THEN** el selector pide confirmación y, al confirmar, aplica el rango del primer día activo a todos los días activos

#### Scenario: Duración por defecto al elegir el inicio

- **WHEN** el usuario elige un inicio sin haber tocado el fin a mano
- **THEN** el fin queda en el inicio más dos horas, sin pasar de las 22:00: 19:00 da 21:00 y 21:00 da 22:00

#### Scenario: El fin editado a mano no se recalcula

- **WHEN** el usuario fija el fin a mano y después cambia el inicio
- **THEN** el fin conserva el valor escrito, salvo que haya quedado menor o igual al nuevo inicio

#### Scenario: Tipeo que no es múltiplo de 15 minutos

- **WHEN** el usuario tipea `13:42` en el inicio y confirma
- **THEN** el valor queda redondeado a `13:45`; y si tipea texto que no se interpreta, se restaura el valor anterior

#### Scenario: El selector de hora respeta los extremos

- **WHEN** el usuario abre el selector de hora
- **THEN** el inicio se elige entre 6:00 y 21:45 y el fin entre el inicio más 15 minutos y las 22:00, y las22:00 se pueden elegir

#### Scenario: Listo devuelve los horarios y Cancelar los descarta

- **WHEN** el usuario cambia horarios y pulsa `Listo`, o los cambia y pulsa `Cancelar`
- **THEN** `Listo` devuelve los horarios al formulario sin llamar a la API, y `Cancelar` deja el formulario como estaba antes de abrir el selector

#### Scenario: Escape cierra solo el selector

- **WHEN** el usuario pulsa `Escape` con el selector abierto sobre el modal de comisión
- **THEN** se cierra el selector, el modal de comisión sigue abierto con lo que tenía y el foco vuelve al control que abrió el selector

#### Scenario: Los chips de día son accesibles

- **WHEN** el usuario navega con el teclado entre los chips de día y los activa o desactiva
- **THEN** los chips son botones operables con Tab y con Enter o Espacio, y `aria-pressed` refleja su estado

#### Scenario: El resumen agrupa los días con el mismo rango

- **WHEN** la comisión tiene lunes y miércoles de 19:00 a 21:00 y martes de 18:15 a 21:30
- **THEN** el formulario muestra dos chips —`Lun y Mié 19-21hs` y `Mar 18:15-21:30hs`— en varias filas con flex-wrap y sin truncar

#### Scenario: La tabla muestra el horario compacto

- **WHEN** una comisión tiene más de un grupo de días con distinto rango y se la ve en la tabla de Administración
- **THEN** la celda `HORARIO` muestra una sola línea con ellipsis, el texto completo en el tooltip y el badge `+1`, que abre un popover con la lista completa de los dos grupos
