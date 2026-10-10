# Spec Delta

## Purpose

Definir el shell de Administración y Secretaría de TechAcademy BA como maqueta navegable: su navegación, sus seis pantallas y la forma visible de representar el estado de acceso de cada alumno, apoyadas en datos de ejemplo de comisiones, docentes, alumnos, cuentas corporativas y cobranzas, y sin implementar lógica de negocio ni historias de usuario.

## MODIFIED Requirements

### Requirement: Comisiones activas y alta de comisión

The system SHALL mostrar la sección `Cursos y Comisiones` como dos vistas encadenadas en lugar de
un listado único. La **vista de cursos**, en la ruta `/admin/cursos`, SHALL mostrar un grid con una
tarjeta por cada curso del catálogo y las acciones `+ Nuevo Curso` y `+ Nueva Comisión`, más el chip
del total de comisiones del catálogo —`10 en el catálogo` con los datos de ejemplo—. Cada tarjeta
SHALL mostrar el nombre del curso, su código, su descripción y la cantidad de comisiones que tiene, y
SHALL ser activable con un click sobre la tarjeta o sobre el botón `Abrir comisiones` de esa tarjeta.

La **vista de comisiones del curso**, en la ruta `/admin/cursos/:codigo`, SHALL mostrar la tabla de
comisiones del curso de la ruta con el chip del total del catálogo, el nombre y el código del curso a
la vista, la acción `Volver a cursos` y la acción `+ Nueva Comisión`. La tabla SHALL conservar las
columnas, con estos rótulos literales y en este orden: `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`,
`HORARIO`, `CUPO MÁX.`, `VACANTES` y `ARANCEL`, y SHALL contener solamente las comisiones del curso
de la ruta. La vista de comisiones del curso SHALL NOT ofrecer la acción `+ Nuevo Curso`: dentro de
un curso no tiene sentido dar de alta otro curso.

La tabla de la vista de comisiones del curso SHALL mostrar las comisiones que devuelve el catálogo,
con los datos que la fuente informa de cada una. La pantalla SHALL NOT inventar cursos ni comisiones
para completar el catálogo.

Cuando los datos de la pantalla salen del ejemplo —el modo `mock`, que solo entra cuando un endpoint
no existe— las filas son un subconjunto de las diez comisiones del cliente: `CUR-101` Python Inicial
con Profe Martín, `Mar y Jue 19 a 21 hs`, cupo 30, 7 vacantes y arancel `$45.000`; `CUR-104` Diseño
UX/UI Avanzado con Caro UX, `Miércoles 19 a 22`, cupo 20, 0 vacantes y `$52.000`; `CUR-108` Java
Backend Spring con Ing. González, `Sábados intensivo`, cupo 30, 30 vacantes y `$58.000`; `CUR-110`
Power BI & Dashboards con Mariana Data, `Mar y Jue 18:30`, cupo 40, 40 vacantes y `$39.000`; y
`CUR-103` Marketing Digital & Ads con Santi Ads, `Sábados 10 a 13 hs`, cupo 40, 40 vacantes y
`$38.000`. En el modo por omisión las filas son las que hay en la base, no las del ejemplo.

La columna `VACANTES` SHALL mostrar el conteo de vacantes que la fuente informa para cada comisión, y
cuando valga 0 la fila SHALL llevar el chip `LLENO` en rojo junto al valor. En los datos de ejemplo
la fila de `CUR-104` es la única con 0 vacantes, porque el cliente la registra con estado `Cerrada
por cupo`.

El sistema SHALL abrir el modal `Crear Nueva Comisión` con los campos, en este orden literal:
`Curso / Programa`, `Docente Asignado`, `Días y Horarios` con placeholder `Ej: Mar y Jue 19 a 21
hs`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)` y `Modalidad`, más `Sede` cuando el campo
corresponda renderizarse, con los botones `Cancelar` y `Guardar Comisión`. El modal SHALL NOT pedir
un código de comisión: el código lo deriva el sistema del curso y del número, y la pantalla lo
muestra al confirmar. `Docente Asignado` SHALL ser una selección de los docentes del padrón y SHALL
NOT ser un campo de búsqueda de texto libre. `Modalidad` SHALL ofrecer `Virtual`, `Presencial` y
`Híbrido`. `Sede` SHALL ser opcional en toda modalidad: SHALL renderizarse solo cuando la modalidad
elegida sea `Presencial` o `Híbrido`, y SHALL NOT renderizarse cuando la modalidad sea `Virtual`
ni mientras el selector siga en `Seleccionar…`, que es como abre el modal.

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

Este cambio no incluye edición: el sistema SHALL NOT renderizar ningún control de edición de curso
ni de comisión.

#### Scenario: El usuario revisa el listado de comisiones
- **WHEN** el usuario abre un curso del catálogo desde la vista de cursos
- **THEN** ve el bloque `Comisiones Activas` de ese curso con las columnas `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`, `HORARIO`, `CUPO MÁX.`, `VACANTES` y `ARANCEL` en ese orden, y las comisiones de ese curso con su arancel formateado

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
- **WHEN** el usuario recorre el listado y el modal
- **THEN** no encuentra ningún control de edición de curso ni de comisión, porque esas historias quedan fuera de este cambio