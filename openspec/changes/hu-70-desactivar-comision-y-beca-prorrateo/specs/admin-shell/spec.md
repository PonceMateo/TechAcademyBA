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
`HORARIO`, `PERÍODO`, `ESTADO`, `CUPO MÁX.`, `VACANTES`, `ARANCEL` y `ACCIONES`, y SHALL contener
solamente las comisiones del curso de la ruta. La vista de comisiones del curso SHALL NOT ofrecer la
acción `+ Nuevo Curso`: dentro de un curso no tiene sentido dar de alta otro curso.

La columna `ESTADO` SHALL mostrar un chip `Vigente` en verde cuando la comisión tenga `fecha_fin` hoy
o posterior en `America/Argentina/Buenos_Aires`, y un chip `Finalizada` en gris cuando sea anterior a
hoy. La tabla SHALL mostrar todas las comisiones del curso, vigentes y finalizadas, y el contador
`COMISIONES` del Dashboard SHALL seguir contando todas, porque la fuente no filtra por estado.

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

La columna `VACANTES` SHALL mostrar el conteo de vacantes que la fuente informa para cada comisión
`Vigente`, y cuando valga 0 la fila SHALL llevar el chip `LLENO` en rojo junto al valor. WHEN la
comisión esté `Finalizada`, la columna SHALL mostrar `—` y SHALL NOT mostrar el chip `LLENO`, porque
una comisión terminada no ofrece vacantes. En los datos de ejemplo la fila de `CUR-104` es la única
con 0 vacantes y chip `LLENO`.

La columna `HORARIO` SHALL usar el renderer compacto del horario: una línea con ellipsis, el texto
completo en el tooltip y, cuando el horario tenga más de un grupo de días, el badge `+N` que abre un
popover con la lista completa. El `N` del badge SHALL ser la cantidad de grupos de días que no
entran en la línea: con dos grupos en la celda el badge dice `+1`, y con un solo grupo no hay badge.

El sistema SHALL abrir el modal `Crear Nueva Comisión` con los campos, en este orden literal:
`Curso / Programa`, `Docente Asignado`, `Días y Horarios`, `Fecha de Inicio`, `Fecha de Fin`, `Cupo
Máximo`, `Valor de Arancel de Comisión (AR$)` y `Modalidad`, más `Sede` cuando el campo corresponda
renderizarse, con los botones `Cancelar` y `Guardar Comisión`. La fila `Días y Horarios` SHALL ocupar
el ancho completo del modal y SHALL mostrar el horario cargado como chips de solo lectura —un chip
por cada grupo de días con el mismo rango, con `flex-wrap` y sin truncar—, más el botón `Agregar
horarios` cuando no hay ninguno o `Modificar horarios` cuando ya hay alguno. WHEN no haya horarios,
la fila SHALL mostrar el texto `Sin horarios definidos`. El campo SHALL ser obligatorio: sin
horarios, el formulario SHALL mostrar el error `Agregá al menos un horario` bajo el campo y SHALL
NOT crear la comisión. El modal SHALL tener una altura máxima con scroll interno, de modo que el
campo de horarios, el resto de los campos y el pie del modal se puedan ver sin salirse de la
ventana. El modal SHALL NOT pedir un código de comisión: el código lo deriva el sistema del curso y
del número, y la pantalla lo muestra al confirmar. `Docente Asignado` SHALL ser una selección de los
docentes del padrón y SHALL NOT ser un campo de búsqueda de texto libre. `Modalidad` SHALL ofrecer
`Virtual`, `Presencial` y `Híbrido`. `Sede` SHALL ser opcional en toda modalidad: SHALL renderizarse
solo cuando la modalidad elegida sea `Presencial` o `Híbrido`, y SHALL NOT renderizarse cuando la
modalidad sea `Virtual` ni mientras el selector siga en `Seleccionar…`, que es como abre el modal.

WHEN el modal de alta de comisión se abre desde la vista de comisiones del curso, el campo
`Curso / Programa` SHALL venir elegido con el curso de la ruta y SHALL quedar bloqueado a ese curso,
porque la comisión que se está creando pertenece a ese curso. WHEN el modal se abre desde la vista
de cursos, `Curso / Programa` SHALL venir vacío y editable, y el selector SHALL ofrecer cualquier
curso del catálogo.

La pantalla SHALL abrir además el modal `Crear Nuevo Curso`, con los campos `Nombre del Curso` y
`Descripción` y sin ningún campo de código. La adición de la modal de curso es intencional: sin ella
el catálogo no tiene forma de crecer, y el selector de curso de la comisión se armaba con las
comisiones existentes, así que un curso nuevo no podía abrir su primera comisión.

Ambas vistas SHALL mostrar un campo de búsqueda habilitado. La vista de cursos SHALL filtrar el grid
por nombre o descripción por prefijo de palabra, sin distinguir mayúsculas ni acentos, y por código
por subcadena. La
vista de comisiones SHALL filtrar la tabla por código, docente o horario, solo dentro del curso
abierto. WHEN el campo queda vacío, la vista SHALL volver a mostrar el contenido completo. WHEN la
búsqueda no tiene coincidencias, la vista de cursos SHALL mostrar `No se encontraron cursos` y la
vista de comisiones SHALL mostrar `No se encontraron comisiones`. Los resultados SHALL reordenarse
por relevancia de la coincidencia, con desempate por identificador.

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
chips de solo lectura y botón `Modificar horarios` que en el alta—, `Fecha de Inicio`, `Fecha de
Fin`, `Cupo Máximo` y `Valor de Arancel de Comisión (AR$)`, precargados con los valores actuales, y
SHALL NOT mostrar los campos `Curso / Programa`, `Modalidad`, `Sede` ni ningún campo de código. El
modal SHALL mostrar la cantidad de inscriptos activos de la comisión y SHALL usar los botones
`Cancelar` y `Guardar Cambios`. Los horarios se cargan con el selector de horarios y se envían
estructurados; la pantalla SHALL NOT pedir ni enviar el horario como texto libre.

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
- **THEN** ve el bloque `Comisiones Activas` de ese curso con las columnas `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`, `HORARIO`, `PERÍODO`, `ESTADO`, `CUPO MÁX.`, `VACANTES`, `ARANCEL` y `ACCIONES` en ese orden, y las comisiones de ese curso con su arancel formateado y su estado

#### Scenario: El usuario abre la vista de cursos

- **WHEN** un usuario de Secretaría abre `Cursos y Comisiones`
- **THEN** ve el chip `10 en el catálogo`, las acciones `+ Nuevo Curso` y `+ Nueva Comisión`, el buscador habilitado y el grid con una tarjeta por curso del catálogo, cada una con nombre, código, descripción y cantidad de comisiones

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

#### Scenario: El usuario ve el estado de cada comisión

- **WHEN** el usuario recorre la columna `ESTADO` de un curso con comisiones terminadas y en curso
- **THEN** las comisiones con `fecha_fin` anterior a hoy muestran el chip gris `Finalizada` y las demás el chip verde `Vigente`, y la tabla las muestra a todas

#### Scenario: El usuario consulta las vacantes de una comisión finalizada

- **WHEN** el usuario mira la fila de una comisión `Finalizada`
- **THEN** `VACANTES` muestra `—` y no muestra el chip `LLENO`, porque la comisión no admite inscripciones

#### Scenario: El usuario busca la comisión cerrada por cupo

- **WHEN** el usuario abre el curso de `CUR-104` Diseño UX/UI Avanzado
- **THEN** ve `VACANTES` con valor 0 y el chip `LLENO` en rojo junto a la fila

#### Scenario: El usuario compara las vacantes con el cupo

- **WHEN** el usuario recorre la columna `VACANTES` de los datos de ejemplo
- **THEN** ve que `CUR-103` y `CUR-110` conservan su cupo completo como vacantes y que solo `CUR-104` aparece cerrada por cupo

#### Scenario: El usuario abre el modal de alta

- **WHEN** el usuario pulsa `+ Nueva Comisión`
- **THEN** el modal `Crear Nueva Comisión` muestra los campos en el orden `Curso / Programa`, `Docente Asignado`, `Días y Horarios`, `Fecha de Inicio`, `Fecha de Fin`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)` y `Modalidad`, con los botones `Cancelar` y `Guardar Comisión`, no muestra ningún campo para el código de la comisión porque el sistema lo genera, y tampoco muestra `Sede`: el modal abre con `Modalidad` en `Seleccionar…` y el campo aparece recién cuando la modalidad elegida sea `Presencial` o `Híbrido`

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

#### Scenario: El usuario busca un curso por nombre, código o descripción

- **WHEN** el usuario escribe en el buscador de la vista de cursos
- **THEN** el grid muestra solo los cursos cuyo nombre o descripción tiene una palabra que empieza con el texto, o cuyo código contiene el texto, sin distinguir mayúsculas ni acentos, y reordena los resultados por relevancia de la coincidencia

#### Scenario: La búsqueda de cursos no tiene resultados

- **WHEN** el usuario escribe un texto que no coincide con ningún curso
- **THEN** la vista de cursos muestra `No se encontraron cursos`

#### Scenario: El usuario vacía la búsqueda de cursos

- **WHEN** el usuario borra el texto del buscador de la vista de cursos
- **THEN** vuelve a mostrarse el grid completo del catálogo

#### Scenario: El usuario busca una comisión por código, docente u horario

- **WHEN** el usuario escribe en el buscador de la vista de comisiones
- **THEN** la tabla muestra solo las comisiones del curso abierto cuyo código, docente o horario tiene una palabra que empieza con el texto, sin distinguir mayúsculas ni acentos, y reordena los resultados por relevancia de la coincidencia

#### Scenario: La búsqueda de comisiones no tiene resultados

- **WHEN** el usuario escribe un texto que no coincide con ninguna comisión del curso
- **THEN** la vista de comisiones muestra `No se encontraron comisiones`

#### Scenario: El usuario vacía la búsqueda de comisiones

- **WHEN** el usuario borra el texto del buscador de la vista de comisiones
- **THEN** vuelve a mostrarse la tabla completa del curso

#### Scenario: La búsqueda de comisiones no sale del curso

- **WHEN** el usuario busca desde la vista de comisiones de un curso
- **THEN** solo se filtran las comisiones de ese curso, aunque existan comisiones de otros cursos

#### Scenario: El usuario busca en el catálogo

- **WHEN** el usuario escribe en el buscador de cualquiera de las dos vistas
- **THEN** el campo acepta la escritura, filtra el contenido de la vista por prefijo de palabra sin distinguir mayúsculas ni acentos, y muestra el mensaje de sin resultados cuando no hay coincidencias

#### Scenario: La ruta apunta a un curso que no existe

- **WHEN** el usuario abre la dirección de un curso que no está en el catálogo
- **THEN** ve que el curso no existe y puede volver al catálogo, en lugar de una tabla de comisiones vacía

#### Scenario: El usuario busca una acción de edición

- **WHEN** el usuario recorre la tabla de comisiones y las tarjetas de curso
- **THEN** encuentra el botón `Editar` en cada fila de comisión y la acción `Editar curso` en el menú `⋮` de cada tarjeta

#### Scenario: El usuario edita una comisión

- **WHEN** el usuario pulsa `Editar` en una comisión, cambia el docente, los horarios, el período, el cupo o el arancel y guarda
- **THEN** el modal se cierra, la fila muestra los nuevos valores, el estado y las vacantes, y la pantalla confirma que la comisión se actualizó

#### Scenario: El usuario reactiva una comisión finalizada

- **WHEN** el usuario edita la fecha de fin de una comisión finalizada y la establece en una fecha futura
- **THEN** el modal se cierra, la fila muestra el chip `Vigente` y las vacantes vuelven a informarse

#### Scenario: El usuario reduce el cupo por debajo de los inscriptos

- **WHEN** el usuario intenta guardar un cupo máximo menor que la cantidad de inscriptos activos
- **THEN** el modal queda abierto, informa la cantidad actual de inscriptos y la fila conserva su cupo anterior

#### Scenario: El modal de edición no cambia el curso ni la modalidad

- **WHEN** el usuario abre `Editar Comisión`
- **THEN** ve solo docente, el bloque de horarios, las dos fechas del período, cupo y arancel, y no ve campos para el curso, la modalidad, la sede ni el código

#### Scenario: El usuario edita un curso

- **WHEN** el usuario abre el menú `⋮` de una tarjeta, elige `Editar curso`, cambia el nombre o la descripción y guarda
- **THEN** el modal se cierra, la tarjeta muestra los nuevos datos y la pantalla confirma que el curso se actualizó

#### Scenario: El menú no abre el curso

- **WHEN** el usuario pulsa el botón `⋮` de una tarjeta
- **THEN** se despliega la acción `Editar curso` y la pantalla NO navega a la vista de comisiones de ese curso

#### Scenario: El usuario edita con un nombre duplicado

- **WHEN** el usuario intenta guardar un nombre que ya pertenece a otro curso
- **THEN** el modal queda abierto, muestra el motivo que devuelve la fuente y la tarjeta conserva sus datos anteriores

### Requirement: Alta de inscripción con categoría arancelaria

El modal de inscripción de la pantalla de Comisiones SHALL pedir alumno, comisión y categoría
arancelaria. WHEN la categoría sea beca parcial, SHALL pedir un porcentaje entero entre 1 y 99.
WHEN sea corporativo, SHALL pedir una empresa del padrón y SHALL ofrecer `+ Nueva Empresa` para
darla de alta sin perder lo cargado. La pantalla SHALL validar antes de enviar y SHALL mostrar bajo
el campo correspondiente el motivo que devuelva la fuente cuando el alta se rechace. El selector de
comisión SHALL NOT ofrecer las comisiones `Finalizadas`, y WHEN la fuente rechace el alta porque la
comisión ya finalizó, el modal SHALL mostrar ese motivo sin cerrarse. WHEN el modal se abra desde la
vista de comisiones de un curso, en `/admin/cursos/:codigo`, el selector de comisión SHALL ofrecer
solamente las comisiones de ese curso, igual que el alta de comisión dentro del curso; WHEN se abra
desde la vista de cursos, SHALL ofrecer cualquier comisión del catálogo.

#### Scenario: Inscripción particular

- **WHEN** el administrador elige alumno, comisión y categoría particular y guarda
- **THEN** la inscripción se crea con esa categoría y la vacante de la comisión baja en uno

#### Scenario: Inscripción de beca parcial

- **WHEN** el administrador elige beca parcial e informa un porcentaje entre 1 y 99
- **THEN** la inscripción se crea con la categoría y el porcentaje

#### Scenario: Porcentaje faltante o inválido

- **WHEN** el administrador elige beca parcial y deja el porcentaje vacío, fuera de 1 a 99 o con decimales
- **THEN** el formulario no envía y muestra el error en el campo del porcentaje

#### Scenario: Inscripción corporativa

- **WHEN** el administrador elige corporativo y selecciona una empresa del padrón
- **THEN** la inscripción se crea con la categoría corporativa y la empresa elegida

#### Scenario: Corporativo sin empresa

- **WHEN** el administrador elige corporativo y guarda sin elegir empresa
- **THEN** el formulario no envía e indica que hay que seleccionar la empresa

#### Scenario: Alta rápida de empresa

- **WHEN** el administrador pulsa `+ Nueva Empresa` desde el modal de inscripción y completa el alta
- **THEN** la empresa queda seleccionada en el formulario de inscripción, que conserva alumno, comisión y categoría

#### Scenario: La comisión está completa

- **WHEN** la fuente rechaza el alta porque la comisión alcanzó su cupo
- **THEN** el modal sigue abierto con lo cargado y muestra el motivo que devuelve la fuente

#### Scenario: El selector no ofrece comisiones finalizadas

- **WHEN** el administrador abre el selector de comisión del modal de inscripción
- **THEN** solo aparecen las comisiones `Vigentes`

#### Scenario: El selector se limita al curso abierto

- **WHEN** el administrador inscribe un alumno desde `/admin/cursos/CUR001`
- **THEN** el selector de comisión ofrece solo las comisiones de `CUR001` y no las de otros cursos

#### Scenario: El selector del catálogo no se limita

- **WHEN** el administrador inscribe un alumno desde la vista de cursos, en `/admin/cursos`
- **THEN** el selector de comisión ofrece todas las comisiones vigentes del catálogo

#### Scenario: La comisión finalizó mientras el modal estaba abierto

- **WHEN** la fuente rechaza el alta porque la comisión ya finalizó
- **THEN** el modal sigue abierto con lo cargado y muestra el motivo que devuelve la fuente
