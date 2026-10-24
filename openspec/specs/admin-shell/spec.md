# admin-shell Specification

## Purpose

Definir el shell de Administración y Secretaría de TechAcademy BA como maqueta navegable: su navegación, sus seis pantallas y la forma visible de representar el estado de acceso de cada alumno, apoyadas en la capa de datos real y degradando a su estado vacío lo que no tiene endpoint detrás, y sin implementar lógica de negocio ni historias de usuario.

## Requirements

### Requirement: Estructura y navegación del shell de Administración

The system SHALL renderizar el shell de Administración sobre un fondo con degradado sutil en el
tono del rol, con un panel lateral blanco translúcido **sin rótulo de título**: el panel no lleva
el texto `MENÚ OPERATIVO` ni ninguna categoría de sección. El panel SHALL mostrar la marca del
producto arriba y SHALL ofrecer los ítems de navegación, en este orden exacto: `Dashboard`,
`Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones`, `Cobranzas e Ingresos`,
`Habilitación de Accesos`, cada uno con un ícono y el ítem activo destacado en el acento azul
del rol. La interfaz SHALL estar escrita en español rioplatense, y Administración y Secretaría
siguen siendo el mismo rol: la interfaz lo identifica siempre como `Secretaría`.

The system SHALL renderizar una barra superior con, de izquierda a derecha: un breadcrumb
`Mi espacio > [etiqueta del ítem activo]` que refleja la pantalla abierta; un campo de búsqueda
`Buscar en la plataforma` con la tecla de atajo `⌘ K`, **inerte**, que SHALL mostrarse pero
SHALL NOT filtrar ni navegar; una campana de notificaciones con punto de no leído, **inerte**;
y un bloque de perfil con el avatar, el nombre de la cuenta de la sesión, el rol `Secretaría` y
un menú desplegable con una única entrada, `Cerrar sesión`, que sí funciona. La barra superior
SHALL NOT renderizar el chip `Sede Constituciones`, ningún chip de rol ni el texto
`Período Lectivo 2026`: la sede desaparece del armazón y la información de contexto vive en el
pie.

The system SHALL renderizar un pie con, en este orden, `TechAcademy BA · Aprendemos, crecemos,
conectamos.` y el texto `Período Lectivo 2026`. El período lectivo SHALL renderizarse como
`Período Lectivo 2026`, aunque el prototipo muestre `Periodo Lectivo 2025` o `Ciclo lectivo
2026`: es una corrección intencional de la línea temporal del proyecto. El pie SHALL NOT
renderizar el nombre `Secretaria BA` ni la etiqueta `Terminal Interna 04`, y SHALL NOT mostrar
ninguna línea de `Última actualización`: el pie se limita al tagline y al período lectivo.

#### Scenario: El usuario abre el shell de Administración
- **WHEN** un usuario con rol Secretaría se autentica y abre una pantalla del shell
- **THEN** ve el lateral sin rótulo de título con la marca y los seis ítems con ícono, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline y `Período Lectivo 2026`

#### Scenario: El usuario recorre la navegación
- **WHEN** el usuario abre el panel lateral
- **THEN** los ítems aparecen en el orden `Dashboard`, `Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones`, `Cobranzas e Ingresos` y `Habilitación de Accesos`, y cada uno abre su propia pantalla

#### Scenario: El usuario cambia de pantalla
- **WHEN** el usuario elige un ítem de navegación
- **THEN** el ítem queda destacado como activo y el breadcrumb de la barra superior refleja la sección elegida

#### Scenario: El usuario pulsa la búsqueda o la campana
- **WHEN** el usuario escribe en el campo de búsqueda o pulsa la campana
- **THEN** el contenido de la pantalla no cambia y no se navega a ninguna parte, porque ambos elementos son composición inerte

#### Scenario: El usuario cierra la sesión desde su perfil
- **WHEN** el usuario abre su perfil en la barra superior y elige `Cerrar sesión`
- **THEN** la sesión se cierra y el usuario vuelve al acceso

#### Scenario: El usuario busca la sede en el armazón
- **WHEN** el usuario recorre la barra superior y el lateral buscando `Sede Constituciones`
- **THEN** no la encuentra en ninguna parte del armazón, porque la sede es dato de las pantallas de dominio y no del marco

### Requirement: Tablero operativo con indicadores del catálogo y valores pendientes

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la
cuenta}` seguido de una línea de fecha con la fecha real del día que la fuente informa,
formateada para español rioplatense con el día de la semana capitalizado (por ejemplo `Viernes
9 de octubre`), y la frase de apoyo `Todo lo que necesitás para gestionar tu academia.`. El
nombre es el de la cuenta de la sesión y la fecha SHALL ser un valor calculado a partir del día
corriente, no un literal del maquetado.

The system SHALL mostrar una fila de cuatro tarjetas de indicador. `COMISIONES` SHALL mostrar la
cantidad de comisiones que informa el catálogo real y el texto de apoyo `en el catálogo`; el
tablero SHALL leer ese conteo de la fuente y SHALL NOT calcular ningún agregado propio.
`ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y `CUPO PROMEDIO OCUPADO` SHALL mostrarse con
el valor `—` y sin un número que las respalde, porque ningún endpoint respalda sus valores.

The system SHALL mostrar el bloque `Alertas de Gestión Pendiente` con su encabezado y, en el
cuerpo, el valor `—`, porque sus líneas no tienen fuente ni historia de usuario detrás. El
bloque SHALL NOT mostrar las alertas del prototipo (`Comprobante ilegible de Agustina Benítez`,
`Cheque de Banco Federal pendiente de acreditación`, `Valeria Rossi debe la mitad del arancel`)
ni ninguna línea de lista de espera.

The system SHALL mostrar el bloque `Accesos Rápidos del Personal` con las acciones `Registrar
Cobranza`, `Verificar Habilitaciones` y `Descargar Reporte del Día`, que usan la misma
denominación que los datos del cliente, como composición inerte: las tres acciones SHALL
renderizarse y SHALL NOT navegar a ninguna pantalla.

El tablero SHALL conservar siempre su forma: la fila de cuatro tarjetas y el bloque `Alertas de
Gestión Pendiente` SHALL renderizarse aunque su dato no exista todavía, y el tablero SHALL NOT
eliminar una tarjeta ni un bloque porque la fuente no pueda responder. Donde la fuente no puede
responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse el valor real,
incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT significar
"cero". Mientras una lectura de la que depende un valor no haya resuelto, ese valor SHALL ser
`—`, nunca un `0` ni un literal. El tablero SHALL NOT mostrar gráficos ni indicadores cuyos
valores no estén fijados por este requisito: los números del prototipo (`1.248 alumnos activos`,
`32 comisiones en curso`, `$ 8,4 M cobrados`) no son datos del maquetado y no se reproducen.

#### Scenario: El usuario abre el Dashboard
- **WHEN** un usuario de Secretaría abre `Dashboard`
- **THEN** ve el saludo con su nombre y la línea de fecha real del día, la fila de cuatro tarjetas —`COMISIONES` con el valor que informa el catálogo, y `ALUMNOS INSCRIPTOS`, `COBROS PENDIENTES DE COBRO` y `CUPO PROMEDIO OCUPADO` con `—`—, el bloque `Alertas de Gestión Pendiente` con su encabezado y `—` en el cuerpo, y los accesos rápidos

#### Scenario: El usuario compara los indicadores con el catálogo
- **WHEN** el usuario lee el tablero y lo contrasta con el listado de `Cursos y Comisiones`
- **THEN** `COMISIONES` coincide con la cantidad de comisiones del catálogo real y las otras tres tarjetas muestran `—`, porque no existe ninguna fuente que respalde sus valores

#### Scenario: El usuario espera mientras carga el tablero
- **WHEN** el usuario abre `Dashboard` y la lectura del catálogo todavía no resolvió
- **THEN** la fila de cuatro tarjetas y el bloque `Alertas de Gestión Pendiente` ya se pintan con su forma, y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal, hasta que la lectura resuelve

#### Scenario: El usuario lee la línea de lista de espera
- **WHEN** el usuario lee el cuerpo de `Alertas de Gestión Pendiente`
- **THEN** ve `—` y no encuentra ninguna de las alertas del prototipo ni la línea de lista de espera sobre el cupo alcanzado de `CUR-104`, porque el bloque conserva su encabezado pero ninguna fuente respalda sus líneas. El nombre del escenario conserva el de la regla anterior, que afirmaba esa línea, y queda acá como registro de la diferencia

#### Scenario: El usuario pulsa una acción rápida
- **WHEN** el usuario pulsa `Registrar Cobranza`, `Verificar Habilitaciones` o `Descargar Reporte del Día`
- **THEN** no ocurre ninguna navegación ni se ejecuta ninguna lógica, porque las tres acciones son composición inerte y ninguna historia de usuario cubre esta pantalla

#### Scenario: El usuario busca un gráfico del prototipo
- **WHEN** el usuario recorre el tablero buscando la sección `La academia en números` con sus gráficos
- **THEN** no la encuentra, porque los números del prototipo no corresponden a los datos del maquetado

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

La pantalla SHALL abrir el modal `Editar Curso` desde la acción `Editar curso` del menú `⋮`, con los
campos `Nombre del Curso` y `Descripción` precargados con los valores actuales y sin ningún campo de
código, y con los botones `Cancelar` y `Guardar Cambios`. Un guardado aceptado SHALL actualizar la
tarjeta del curso en el catálogo y mostrar una confirmación; un rechazo SHALL dejar el modal abierto
con el motivo que informa la fuente y SHALL NOT confirmar la edición.

La columna `ACCIONES` SHALL mostrar el botón `Editar` en cada fila. La pantalla SHALL abrir el modal
`Editar Comisión` con los campos `Docente Asignado`, `Días y Horarios`, `Cupo Máximo` y `Valor de
Arancel de Comisión (AR$)`, precargados con los valores actuales, y SHALL NOT mostrar los campos
`Curso / Programa`, `Modalidad`, `Sede` ni ningún campo de código. El modal SHALL mostrar la cantidad
de inscriptos activos de la comisión y SHALL usar los botones `Cancelar` y `Guardar Cambios`.

WHEN el cupo máximo informado sea menor que la cantidad de inscriptos activos, la pantalla SHALL
rechazar el guardado e informar la cantidad actual, sin cerrar el modal ni confirmar la edición. Un
guardado aceptado SHALL actualizar la fila de la tabla con la comisión y las vacantes que devuelve la
fuente y SHALL mostrar una confirmación; un rechazo de la fuente SHALL dejar el modal abierto con el
motivo. La pantalla SHALL NOT modificar inscripciones ni pagos al editar la comisión.

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

- **WHEN** el usuario pulsa `Editar` en una comisión, cambia el docente, los días y horarios, el cupo o el arancel y guarda
- **THEN** el modal se cierra, la fila muestra los nuevos valores y vacantes, y la pantalla confirma que la comisión se actualizó

#### Scenario: El usuario reduce el cupo por debajo de los inscriptos

- **WHEN** el usuario intenta guardar un cupo máximo menor que la cantidad de inscriptos activos
- **THEN** el modal queda abierto, informa la cantidad actual de inscriptos y la fila conserva su cupo anterior

#### Scenario: El modal de edición no cambia el curso ni la modalidad

- **WHEN** el usuario abre `Editar Comisión`
- **THEN** ve solo docente, días y horarios, cupo y arancel, y no ve campos para el curso, la modalidad, la sede ni el código

#### Scenario: El usuario edita un curso

- **WHEN** el usuario abre el menú `⋮` de una tarjeta, elige `Editar curso`, cambia el nombre o la descripción y guarda
- **THEN** el modal se cierra, la tarjeta muestra los nuevos datos y la pantalla confirma que el curso se actualizó

#### Scenario: El menú no abre el curso

- **WHEN** el usuario pulsa el botón `⋮` de una tarjeta
- **THEN** se despliega la acción `Editar curso` y la pantalla NO navega a la vista de comisiones de ese curso

#### Scenario: El usuario edita con un nombre duplicado

- **WHEN** el usuario intenta guardar un nombre que ya pertenece a otro curso
- **THEN** el modal queda abierto, muestra el motivo que devuelve la fuente y la tarjeta conserva sus datos anteriores
### Requirement: Padrón de docentes

The system SHALL mostrar la pantalla `Docentes` con un listado cuyas columnas, en este orden literal, son `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS`, `ESTADO` y `ACCIONES`, con un campo de búsqueda por nombre, apellido, DNI o email, y la acción `+ Nuevo Docente`. La columna `CUIL` SHALL mostrar el dato cuando el docente lo tenga y SHALL NOT exigirlo: el CUIL es único pero opcional en el modelo, y un docente sin CUIL es una fila válida. Las filas del maquetado son, en este orden: Profe Martín con `Programación`, 1 comisión asignada y estado `Activa`; Lic. Laura Benítez con `Desarrollo Web`, 1 comisión asignada y `Activa`; Santi Ads con `Marketing`, 2 comisiones asignadas y `Activa`; Dr. Marcelo Ríos con `Datos`, 1 comisión asignada y `Activa`; e Ing. González con `Programación`, 1 comisión asignada y `Activa`. La columna `ESTADO` SHALL renderizar `Activa` en verde. El maquetado SHALL NOT mostrar columnas de documento, correo ni teléfono de los docentes, porque los datos del cliente no registran esos datos y no deben inventarse.

Esta pantalla es una adición intencional: el prototipo no la incluye y el alta de docente está dentro del alcance mínimo. La acción `+ Nuevo Docente` SHALL abrir el modal `Nuevo Docente`, con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y `Teléfono`, y sin ningún campo de CUIL porque el contrato del alta no lo admite.

La columna `ACCIONES` SHALL mostrar los botones `Editar` y `Restablecer contraseña` en cada fila. El
sistema SHALL abrir el modal `Editar Docente` con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y
`Teléfono` precargados con los valores actuales y sin ningún campo de CUIL, con los botones `Cancelar`
y `Guardar Cambios`. Un guardado aceptado SHALL actualizar la fila y mostrar una confirmación; un
rechazo SHALL dejar el modal abierto con el motivo que informa la fuente.

El sistema SHALL abrir además el modal `Restablecer contraseña` con los campos de contraseña nueva y
confirmación, y SHALL avisar que el docente deberá cambiarla en su próximo ingreso. WHEN las dos
contraseñas no coincidan o la nueva tenga menos de 8 caracteres, la pantalla SHALL rechazar el envío
sin llamar a la fuente. Un restablecimiento aceptado SHALL cerrar el modal y confirmar la operación.

El control de clases dictadas por el profesor queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin ninguna pantalla detrás.

#### Scenario: El usuario abre el padrón de docentes
- **WHEN** un usuario de Secretaría abre `Docentes`
- **THEN** ve el listado con las columnas `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS`, `ESTADO` y `ACCIONES`, los cinco docentes del maquetado, sus datos de contacto, sus especialidades, sus comisiones asignadas y el estado `Activa` en verde, más la acción `+ Nuevo Docente`

#### Scenario: El usuario localiza a un docente por CUIL
- **WHEN** el usuario recorre la fila de un docente
- **THEN** ve su CUIL visible junto al DNI cuando el docente lo tiene, y la fila no lo exige porque el CUIL es único pero opcional en el modelo, así que un docente cargado sin ese dato sigue siendo una fila válida del padrón

#### Scenario: El usuario compara las cargas de los docentes
- **WHEN** el usuario recorre la columna `COMISIONES ASIGNADAS`
- **THEN** ve que Santi Ads tiene 2 comisiones asignadas y los otros cuatro docentes tienen 1 cada uno

#### Scenario: El usuario busca un docente
- **WHEN** el usuario escribe un nombre en el buscador
- **THEN** el listado del maquetado se filtra por ese texto

#### Scenario: La búsqueda no arroja resultados
- **WHEN** el usuario busca un dato que no existe en el padrón
- **THEN** el maquetado informa que no se encontraron resultados

#### Scenario: El usuario busca edición o control de clases

- **WHEN** el usuario revisa la pantalla buscando editar a un docente o controlar las clases que dicta
- **THEN** la acción `+ Nuevo Docente` abre el formulario de alta real, la columna `ACCIONES` ofrece `Editar` y `Restablecer contraseña`, y el control de clases dictadas aparece como ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

#### Scenario: El usuario edita los datos de un docente

- **WHEN** el usuario pulsa `Editar`, cambia nombre, apellido, DNI, mail o teléfono y guarda
- **THEN** el modal se cierra, la fila muestra los nuevos datos y la pantalla confirma que el docente se actualizó

#### Scenario: El usuario edita con un DNI o mail duplicado

- **WHEN** el usuario intenta guardar un DNI o un mail que ya pertenece a otro registro
- **THEN** el modal queda abierto, muestra el motivo que devuelve la fuente y la fila conserva sus datos anteriores

#### Scenario: El usuario restablece la contraseña de un docente

- **WHEN** el usuario pulsa `Restablecer contraseña`, define una contraseña válida y confirma
- **THEN** el modal se cierra y la pantalla informa que el docente deberá cambiarla en su próximo ingreso

#### Scenario: Las contraseñas no coinciden

- **WHEN** el usuario escribe dos contraseñas distintas en el modal de restablecimiento
- **THEN** la pantalla no envía la operación y muestra que las contraseñas no coinciden

#### Scenario: El modal de edición no pide CUIL

- **WHEN** el usuario abre `Editar Docente`
- **THEN** ve nombre, apellido, DNI, mail y teléfono, y no ve ningún campo de CUIL
### Requirement: Alumnos, categorías arancelarias y cuentas corporativas

The system SHALL mostrar el bloque `Padrón de Alumnos Regulares` con un campo de búsqueda de placeholder `Buscar por DNI o Nombre…` y una tabla cuyas columnas, con estos rótulos literales y en este orden, son `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`. La columna `CATEGORÍA ARANCELARIA` SHALL mostrar `PARTICULAR` en gris, `BECADO PARCIAL` en violeta acompañado del porcentaje de descuento, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste. La columna `ACCESO PLATAFORMA` SHALL mostrar `HABILITADO` en verde o `BLOQUEADO` en rojo y, cuando el acceso esté bloqueado, SHALL mostrar la causa del bloqueo junto al estado.

Las filas del maquetado son, en este orden: Juan Ignacio Pérez, documento `38.456.789`, `juan.perez@gmail.com`, `CUR-101` Python Inicial, `PARTICULAR` y `HABILITADO`; Camila Rodríguez, documento `40.112.233`, `cami_rod@hotmail.com`, `CUR-102` Desarrollo Web Full Stack, `BECADO PARCIAL` con 50% de descuento y `HABILITADO`; Matías Fernández, documento `39.887.665`, `mati.fdez@yahoo.com.ar`, `CUR-104` Diseño UX/UI Avanzado, `PARTICULAR` y `HABILITADO`; Nicolás Castro, documento `Sin DNI (alumno exterior)`, `nicocastro_uy@gmail.com`, `CUR-106` Machine Learning Aplicado, `PARTICULAR` y `HABILITADO`; Agustina Benítez, documento `41.332.114`, `agus.benitez@gmail.com`, `CUR-101` Python Inicial, `BECADO PARCIAL` con 50% de descuento y `BLOQUEADO` por `comprobante ilegible`; y Valeria Rossi, documento `36.778.990`, `valerossi@gmail.com`, `CUR-104` Diseño UX/UI Avanzado, `PARTICULAR` y `BLOQUEADO` por `debe saldo`. La columna `DNI` SHALL renderizar el documento exactamente como lo registra el cliente, incluido el texto `Sin DNI (alumno exterior)` del alumno de Uruguay. Los dos accesos bloqueados del maquetado son los dos casos que el cliente tiene sin resolver y ninguno se corrige por la interfaz.

La misma pantalla SHALL mostrar el bloque `Cuentas Corporativas Vinculadas` con una tabla cuyas columnas, en este orden literal, son `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, donde la preferencia de factura se renderiza como badge `A` o `B`. Las filas del maquetado son, en este orden: `Tech Solutions S.A.` con CUIT `30-71665544-9`, preferencia de factura `A` y nómina `Grupo 5 (Data Analytics) y Grupo 2 (Python Inicial), segunda tanda de empleados`; y `Banco Federal (Capacitaciones)` con CUIT `30-50001234-4`, preferencia de factura `A` y nómina `10 personas, falta enviar la nómina`. El alta de cuenta corporativa pertenece a esta misma pantalla y no a una pantalla separada de empresas.

#### Scenario: El usuario abre el padrón de alumnos
- **WHEN** un usuario de Secretaría abre `Alumnos e Inscripciones`
- **THEN** ve el bloque `Padrón de Alumnos Regulares` con el buscador `Buscar por DNI o Nombre…` y la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL`, `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y `ACCESO PLATAFORMA`, con las seis filas del maquetado

#### Scenario: El usuario revisa las categorías
- **WHEN** el usuario recorre la columna `CATEGORÍA ARANCELARIA`
- **THEN** encuentra `PARTICULAR` en gris, `BECADO PARCIAL` en violeta con su porcentaje de descuento visible, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste

#### Scenario: El usuario revisa los bloqueos reales
- **WHEN** el usuario mira las filas de Agustina Benítez y de Valeria Rossi
- **THEN** ve `BLOQUEADO` en rojo junto a las causas `comprobante ilegible` y `debe saldo`, respectivamente

#### Scenario: El usuario busca al alumno del exterior
- **WHEN** el usuario recorre la columna `DNI`
- **THEN** ve el valor `Sin DNI (alumno exterior)` en la fila de Nicolás Castro, tal como lo registra el cliente, sin un documento numérico inventado

#### Scenario: El usuario revisa las cuentas corporativas
- **WHEN** el usuario baja al bloque `Cuentas Corporativas Vinculadas`
- **THEN** ve las columnas `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, con `Tech Solutions S.A.` y `Banco Federal (Capacitaciones)` y el badge `A` de factura en ambas

#### Scenario: El usuario busca la nómina faltante
- **WHEN** el usuario lee la columna `NÓMINA DE EMPLEADOS`
- **THEN** ve que la fila de Banco Federal aclara que falta enviar la nómina y que la de Tech Solutions S.A. describe la segunda tanda de empleados

#### Scenario: La búsqueda no arroja resultados
- **WHEN** el usuario busca un DNI o un nombre que no existe en el padrón
- **THEN** el maquetado informa que no se encontraron resultados

### Requirement: Cobranzas: registro de pago manual e historial de ingresos

The system SHALL mostrar el bloque `Registrar Cobranza Manual` como un formulario embebido en la pantalla y no como ventana modal, con los campos en este orden literal: `Fecha Pago`, `Importe Cobrado (AR$)`, `Medio de Pago` como selección, `Titular del Comprobante`, `Alumno a Imputar Pago` como selección con búsqueda, `Estado Inicial` como selección, la casilla `El titular solicita Factura tipo A con CUIT vinculada` y el botón `Registrar Cobro`. El formulario SHALL hacer explícito que el pagador y el beneficiario son cosas distintas: el `Titular del Comprobante` puede ser un tercero o una empresa ajena al padrón y el pago se imputa al `Alumno a Imputar Pago`, que es quien queda reflejado en su legajo.

El sistema SHALL usar un único conjunto de rótulos de medio de pago, tomado del dominio, tanto en la selección del formulario como en la columna `MEDIO` del historial: `Transferencia`, `Efectivo`, `Cheque`, `Tarjeta`, `Billetera` y `Otro`. Esta normalización es intencional: el prototipo rotula los medios de forma distinta en el formulario y en la tabla, y se resuelve a favor del vocabulario del dominio.

The system SHALL mostrar el bloque `Historial de Ingresos Registrados` con una tabla cuyas columnas, en este orden literal, son `FECHA`, `TITULAR DEL PAGO`, `ALUMNO IMPUTADO`, `MEDIO`, `FACTURA A`, `IMPORTE` y `ESTADO GESTIÓN`. La columna `ESTADO GESTIÓN` SHALL distinguir `ACREDITADO` en verde, `OBSERVADO` en ámbar y `RECHAZADO` en rojo, y la columna `FACTURA A` SHALL renderizarse como badge `A` o `B`.

Las filas del maquetado son, en este orden: el 10/05/2026, titular Juan Ignacio Pérez, alumno imputado Juan Ignacio Pérez, `Transferencia`, factura `B`, `$45.000`, `ACREDITADO`; el 11/05/2026, titular Camila Rodríguez, alumno imputado Camila Rodríguez, `Transferencia`, factura `B`, `$31.000`, `ACREDITADO`; el 12/05/2026, titular Tech Solutions S.A., alumno imputado Tech Solutions S.A., `Transferencia`, factura `A`, `$240.000`, `ACREDITADO`; el 16/05/2026, titular Banco Federal, sin alumnos imputados, `Cheque`, factura `A`, `$390.000`, `OBSERVADO`; el 19/05/2026, titular un familiar de Agustina Benítez, alumno imputado Agustina Benítez, `Transferencia`, factura `B`, importe vacío, `OBSERVADO`; y el 21/05/2026, titular Valeria Rossi, alumno imputado Valeria Rossi, `Efectivo`, factura `B`, `$26.000`, `OBSERVADO`.

Dos filas del historial son los casos que el cliente tiene sin resolver y el maquetado SHALL representarlos sin limpiarlos. La fila del 19/05/2026 es el caso de pagador distinto del alumno: el comprobante que envió la familia de Agustina Benítez llegó ilegible, por eso el titular es un tercero, el alumno imputado es Agustina Benítez y el importe queda vacío porque nunca pudo leerse. La fila del 16/05/2026 no tiene alumno imputado porque el cheque sigue pendiente de acreditación y la empresa todavía no envió la nómina de sus empleados.

El acreditamiento automático de pagos queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin pantalla detrás.

#### Scenario: El usuario registra una cobranza
- **WHEN** el usuario completa `Fecha Pago`, `Importe Cobrado (AR$)` y `Medio de Pago`, elige el alumno a imputar y pulsa `Registrar Cobro`
- **THEN** el maquetado agrega una fila al `Historial de Ingresos Registrados` con esos datos

#### Scenario: El titular del comprobante no es el alumno
- **WHEN** el usuario carga un pago cuyo `Titular del Comprobante` es un tercero o una empresa que no está en el padrón
- **THEN** la pantalla deja claro que el titular es distinto del beneficiario, el pago se imputa al `Alumno a Imputar Pago` y el tercero no se agrega al padrón de alumnos

#### Scenario: Faltan datos obligatorios
- **WHEN** el usuario intenta registrar un cobro sin `Fecha Pago`, sin importe o sin `Medio de Pago`
- **THEN** el maquetado no registra el pago e indica los campos faltantes

#### Scenario: El usuario revisa el historial
- **WHEN** un usuario de Secretaría abre `Historial de Ingresos Registrados`
- **THEN** ve las columnas `FECHA`, `TITULAR DEL PAGO`, `ALUMNO IMPUTADO`, `MEDIO`, `FACTURA A`, `IMPORTE` y `ESTADO GESTIÓN`, con las seis filas del maquetado y `ACREDITADO`, `OBSERVADO` y `RECHAZADO` en colores distintos

#### Scenario: El usuario revisa el comprobante ilegible
- **WHEN** el usuario mira la fila del 19/05/2026
- **THEN** ve que el titular es un familiar de Agustina Benítez, que el alumno imputado es Agustina Benítez, que el importe está vacío y que el estado es `OBSERVADO` en ámbar

#### Scenario: El usuario revisa el cheque sin alumnos imputados
- **WHEN** el usuario mira la fila del 16/05/2026
- **THEN** ve la columna `ALUMNO IMPUTADO` vacía y el estado `OBSERVADO`, porque el cheque sigue pendiente de acreditación

#### Scenario: El usuario compara los medios de pago
- **WHEN** el usuario abre la selección `Medio de Pago` y luego mira la columna `MEDIO` del historial
- **THEN** ve el mismo conjunto de rótulos en ambos lugares y no encuentra etiquetas divergentes como `Cheque Corp`

#### Scenario: El usuario busca la acreditación automática
- **WHEN** el usuario busca la acreditación automática de pagos
- **THEN** encuentra un ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

### Requirement: Habilitación de accesos y acciones excepcionales

The system SHALL mostrar el bloque `Buscador de Alumnos y Cuentas Corporativas` con un campo de búsqueda, el botón `Consultar Habilitación` y la ayuda `Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.`; el bloque `Ficha Resumen del Alumno` con los campos `DNI / Documento`, `Nombre Completo`, `Email Registrado`, `Curso Inscrito`, `Categoría Arancelaria` y `Último Pago Imputado`; y el bloque `Estado del Acceso`, que SHALL mostrar una marca verde con `HABILITADO` y el texto `El alumno cumple con la condición arancelaria.`, o la variante roja `BLOQUEADO` que SHALL mostrar la causa del bloqueo junto al estado. Debajo, el bloque `ACCIONES EXCEPCIONALES` SHALL renderizar la acción `Forzar Bloqueo Manual` acompañada de un campo `Motivo` obligatorio y de la identificación del usuario y de la fecha de la operación, más la acción de copia de correos habilitados de una comisión elegida.

La comisión sobre la que se copian los correos SHALL elegirse del catálogo real de comisiones y SHALL NOT ser un código fijo del maquetado; el rótulo de la acción SHALL reflejar la comisión elegida.

La aparición del campo `Motivo` es intencional: el prototipo ofrece el forzado de bloqueo con un botón y ningún campo para justificarlo, y la historia de usuario exige un motivo no vacío junto al usuario y la fecha de la operación. La acción de copia SHALL seguir la misma regla de negocio en todos los casos: copia únicamente los correos de los alumnos habilitados de la comisión elegida, y cuando esa comisión no tiene ningún alumno habilitado SHALL informar que no hay correos para copiar en lugar de copiar una lista vacía.

La emisión de certificados queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin pantalla detrás.

#### Scenario: El usuario busca a un alumno
- **WHEN** el usuario escribe un DNI, un email institucional, un CUIT o una razón social y pulsa `Consultar Habilitación`
- **THEN** ve la `Ficha Resumen del Alumno` con `DNI / Documento`, `Nombre Completo`, `Email Registrado`, `Curso Inscrito`, `Categoría Arancelaria` y `Último Pago Imputado`

#### Scenario: El acceso del alumno está bloqueado
- **WHEN** el estado consultado es `BLOQUEADO`
- **THEN** la pantalla muestra el indicador rojo junto a la causa del bloqueo, sin importar que el prototipo nunca muestre la causa

#### Scenario: El usuario consulta a Agustina Benítez
- **WHEN** el usuario busca a Agustina Benítez y pulsa `Consultar Habilitación`
- **THEN** ve `CUR-101` Python Inicial, categoría `Becado parcial 50%` y el estado `BLOQUEADO` con la causa `comprobante ilegible`

#### Scenario: El usuario copia los correos habilitados de la comisión
- **WHEN** el usuario elige una comisión del catálogo real y pulsa la acción de copia de correos habilitados sobre una comisión que tiene alumnos habilitados y bloqueados
- **THEN** el maquetado copia solo los correos de los alumnos habilitados de esa comisión y no incluye los de los bloqueados

#### Scenario: La comisión no tiene alumnos habilitados
- **WHEN** el usuario elige una comisión y pulsa la copia de correos habilitados sobre una comisión sin ningún alumno habilitado
- **THEN** el maquetado informa que no hay correos para copiar

#### Scenario: El usuario fuerza un bloqueo sin motivo
- **WHEN** el usuario pulsa `Forzar Bloqueo Manual` con el campo `Motivo` vacío
- **THEN** el maquetado no confirma la operación e indica que el motivo es obligatorio

#### Scenario: El usuario fuerza un bloqueo con motivo
- **WHEN** el usuario completa el `Motivo` y confirma
- **THEN** el estado forzado queda a la vista junto al usuario registrado y la fecha de la operación

#### Scenario: El usuario busca la emisión de certificados
- **WHEN** el usuario busca la emisión de certificados
- **THEN** encuentra un ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

### Requirement: Control de acceso al shell de Administración

The system SHALL responder con una pantalla 404 cuando se solicite una ruta del shell de Administración que no existe. The system SHALL responder con un rechazo 403 cuando un usuario autenticado cuyo rol no sea Administración o Secretaría intente abrir cualquier ruta de este shell.

#### Scenario: El usuario de Administración navega a una ruta inexistente
- **WHEN** un usuario de Secretaría navega a una ruta del shell de Administración que no existe
- **THEN** ve la pantalla 404

#### Scenario: Un usuario ajeno intenta entrar al shell
- **WHEN** un usuario autenticado con rol docente o alumno navega a una ruta del shell de Administración
- **THEN** el sistema lo rechaza con 403 y no le muestra ninguna pantalla de este shell
