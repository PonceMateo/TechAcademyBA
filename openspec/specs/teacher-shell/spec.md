# teacher-shell Specification

## Purpose

Definir el shell del docente de TechAcademy BA como maqueta navegable: su navegación, el detalle de la única comisión que el cliente tiene asignada con su padrón de alumnos, la carga del link de la clase, la asistencia y su perfil, apoyadas en la capa de datos real y degradando a su estado vacío lo que no tiene endpoint detrás, y dejando fuera de alcance las notas y la certificación.

## Requirements

### Requirement: Estructura y navegación del shell del docente

The system SHALL renderizar el shell del docente sobre un fondo con degradado sutil en el tono
del rol, con un panel lateral blanco translúcido **sin rótulo de título**: el panel no lleva el
texto `ESPACIO DOCENTE` ni ninguna categoría de sección. El panel SHALL mostrar la marca del
producto arriba y SHALL ofrecer los ítems de navegación, en este orden exacto: `Mis Comisiones`,
`Mis Alumnos`, `Asistencia`, `Notas y Certificación` deshabilitado y `Mi Perfil`, cada uno con un
ícono y el ítem activo destacado en el acento verde del rol. La interfaz SHALL estar escrita en
español rioplatense.

The system SHALL renderizar una barra superior con, de izquierda a derecha: un breadcrumb
`Mi espacio > [etiqueta del ítem activo]` que refleja la pantalla abierta; un campo de búsqueda
`Buscar en la plataforma` con la tecla de atajo `⌘ K`, **inerte**, que SHALL mostrarse pero
SHALL NOT filtrar ni navegar; una campana de notificaciones con punto de no leído, **inerte**;
y un bloque de perfil con el avatar, el nombre de la cuenta de la sesión, el rol `Docente` y un
menú desplegable con una única entrada, `Cerrar sesión`, que sí funciona. La barra superior
SHALL NOT renderizar el chip `Rol Docente · Solo mis comisiones` ni el texto
`Período Lectivo 2026`.

The system SHALL renderizar un pie con, en este orden, `TechAcademy BA · Aprendemos, crecemos,
conectamos.` y el texto `Período Lectivo 2026`. El período lectivo SHALL renderizarse como
`Período Lectivo 2026`, aunque el prototipo muestre `Periodo Lectivo 2025` o `Ciclo lectivo
2026`: es una corrección intencional de la línea temporal del proyecto. El pie SHALL NOT
renderizar el avatar `PM`, el nombre `Profe Martín` ni el rol `DOCENTE`, y SHALL NOT mostrar
ninguna línea de `Última actualización`: el pie se limita al tagline y al período lectivo.

#### Scenario: El docente abre su espacio
- **WHEN** un usuario con rol docente se autentica y abre una pantalla de su shell
- **THEN** ve el lateral sin rótulo de título con la marca y sus ítems con ícono, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline y `Período Lectivo 2026`

#### Scenario: El docente recorre la navegación
- **WHEN** el docente abre el panel lateral
- **THEN** los ítems aparecen en el orden `Mis Comisiones`, `Mis Alumnos`, `Asistencia`, `Notas y Certificación` y `Mi Perfil`, y los primeros tres más el último abren su pantalla

#### Scenario: El docente elige una comisión desde sus cursos
- **WHEN** el docente elige `Mis Alumnos` y después una comisión de las que tiene asignadas
- **THEN** abre el detalle de esa comisión con su padrón de alumnos

#### Scenario: El docente cambia de pantalla
- **WHEN** el docente elige un ítem de navegación
- **THEN** el ítem queda destacado como activo y el breadcrumb de la barra superior refleja la sección elegida

#### Scenario: El docente pulsa la búsqueda o la campana
- **WHEN** el docente escribe en el campo de búsqueda o pulsa la campana
- **THEN** el contenido de la pantalla no cambia y no se navega a ninguna parte, porque ambos elementos son composición inerte

#### Scenario: El docente cierra la sesión desde su perfil
- **WHEN** el docente abre su perfil en la barra superior y elige `Cerrar sesión`
- **THEN** la sesión se cierra y el usuario vuelve al acceso

### Requirement: Listado de comisiones asignadas

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la
cuenta}` seguido de una línea de fecha con la fecha real del día que la fuente informa,
formateada para español rioplatense con el día de la semana capitalizado (por ejemplo `Viernes
9 de octubre`), y la frase de apoyo `Tu agenda y tus comisiones en un solo lugar.`. La fecha
SHALL ser un valor calculado a partir del día corriente, no un literal del maquetado. El texto
SHALL NOT anunciar una cantidad de clases ni de entregas: esos valores no están en el
maquetado.

The system SHALL mostrar cuatro tarjetas de indicador —`COMISIONES ACTIVAS`, `ALUMNOS
HABILITADOS`, `BLOQUEADOS` y `PRÓXIMA CLASE`— cuyos valores SHALL derivarse de las comisiones
que el docente tiene asignadas: la cantidad de comisiones asignadas, los conteos de acceso de
esas comisiones y la próxima clase que estas informan, con un `0` real cuando el conteo es cero y
`—` cuando la fuente no puede responder (por ejemplo, cuando no hay ninguna próxima clase). Las
tarjetas SHALL NOT mostrar valores literales fijos, sino los que resultan de las comisiones
asignadas del docente. SHALL mostrar el bloque `Comisiones asignadas` con una fila por comisión
asignada, con su código, su curso, su horario, su próxima clase y los conteos de habilitados y
bloqueados de su padrón. El docente del maquetado tiene exactamente una comisión asignada en los
datos del cliente, por lo que el maquetado SHALL NOT inventar comisiones adicionales para
completar el bloque.

El tablero SHALL conservar siempre su forma: las cuatro tarjetas, el bloque `Comisiones
asignadas` y el bloque `Tu agenda` SHALL renderizarse aunque su dato no exista todavía, y el
tablero SHALL NOT eliminar una tarjeta ni un bloque porque la fuente no pueda responder. Donde la
fuente no puede responder, el valor SHALL ser `—`; donde la fuente responde, SHALL mostrarse el
valor real, incluido un `0` real. El valor `—` SHALL significar "todavía no lo sé" y SHALL NOT
significar "cero". Mientras la lectura de las comisiones asignadas no haya resuelto, cada valor
que depende de ella SHALL ser `—`, nunca un `0` ni un literal.

El tablero SHALL organizarse en dos columnas: a la izquierda, los indicadores y el bloque
`Comisiones asignadas`; a la derecha, un bloque `Tu agenda` con una fila por clase de esa misma
comisión, tomada de su horario y de su próxima clase. Cuando el docente no tiene comisiones
asignadas, el bloque `Comisiones asignadas` SHALL caer a su mensaje de vacío y `Tu agenda` a su
propio mensaje de vacío. El tablero SHALL NOT mostrar bloques de correcciones pendientes,
novedades ni mensajes: el maquetado no registra entregas por corregir ni mensajes, y esos bloques
del prototipo no tienen datos detrás.

Los contadores SHALL renderizarse como chip verde para los habilitados y chip rojo para los
bloqueados, y la forma singular o plural SHALL coincidir con la cantidad. El encabezado que el
prototipo titula `RESTRICCIONES` SHALL renombrarse `ACCESO`, porque sus celdas contienen
conteos de acceso y no restricciones. Este renombrado es una corrección intencional de una
inconsistencia del prototipo.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve el saludo con su nombre y la línea de fecha real del día, las cuatro tarjetas —`COMISIONES ACTIVAS`, `ALUMNOS HABILITADOS`, `BLOQUEADOS` y `PRÓXIMA CLASE`— con los valores derivados de sus comisiones asignadas, el bloque `Comisiones asignadas` y, en la columna derecha, el bloque `Tu agenda`

#### Scenario: El docente espera mientras cargan sus comisiones
- **WHEN** el docente abre `Mis Comisiones` y la consulta de sus comisiones asignadas todavía no resolvió
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de la lectura muestra `—`, nunca un `0` ni un literal, hasta que la consulta resuelve

#### Scenario: El docente no tiene comisiones asignadas
- **WHEN** el docente no tiene ninguna comisión asignada
- **THEN** las cuatro tarjetas muestran un `0` real o `—` según lo que la fuente respalde, el bloque `Comisiones asignadas` cae a su mensaje de vacío y `Tu agenda` a su propio mensaje de vacío, sin eliminar ninguna tarjeta ni bloque

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre los contadores de cada comisión
- **THEN** los habilitados aparecen en chip verde y los bloqueados en chip rojo, y las etiquetas usan singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS` con el contenido del bloque `Comisiones asignadas`
- **THEN** los conteos de las tarjetas coinciden con las comisiones asignadas y su padrón, porque los indicadores se derivan de las comisiones asignadas y no de valores fijos

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los encabezados de la tabla de comisiones
- **THEN** la columna de conteos se titula `ACCESO` y no `RESTRICCIONES`

#### Scenario: El docente busca entregas o mensajes
- **WHEN** el docente recorre el tablero buscando `Correcciones pendientes` o novedades
- **THEN** no los encuentra, porque el maquetado no registra entregas por corregir ni mensajes

### Requirement: Detalle de comisión con padrón de solo lectura

The system SHALL mostrar el detalle `Python Inicial · CUR-101` con la línea de metadatos `Mar y Jue · 19 a 21 hs`, el chip `Solo lectura` y la acción `Copiar emails habilitados`, con el aviso `Se copiará 1 email para que puedas enviar el link de Zoom.` La tabla de alumnos SHALL tener las columnas `ALUMNO`, `EMAIL` y `ESTADO DE HABILITACIÓN`, en este orden literal, y el estado SHALL renderizarse como `HABILITADO` en verde o `BLOQUEADO` en rojo con la causa visible cuando está bloqueado.

El padrón del maquetado tiene exactamente dos filas: Juan Ignacio Pérez con `juan.perez@gmail.com` y estado `HABILITADO`; y Agustina Benítez con `agus.benitez@gmail.com` y estado `BLOQUEADO` por `comprobante ilegible`. La comisión aparece en el catálogo con 7 vacantes sobre un cupo de 30, es decir con más inscriptos de los que la fuente nombra uno por uno: el maquetado SHALL mostrar solo los alumnos que el cliente identifica y SHALL NOT inventar filas para los demás.

El padrón SHALL ser estrictamente de solo lectura: el sistema SHALL NOT renderizar ningún control que permita cambiar el estado de habilitación de un alumno. La única excepción editable de la pantalla es el campo `Link de la clase`. La acción `Copiar emails habilitados` SHALL seguir la misma regla de negocio en todos los casos: copia únicamente los correos de los alumnos habilitados y, cuando no hay ninguno, SHALL informar que no hay correos para copiar.

#### Scenario: El docente abre el detalle de su comisión
- **WHEN** el docente elige `CUR-101` desde `Mis Comisiones`
- **THEN** ve `Python Inicial · CUR-101`, `Mar y Jue · 19 a 21 hs`, el chip `Solo lectura`, la acción `Copiar emails habilitados` y el aviso `Se copiará 1 email para que puedas enviar el link de Zoom.`

#### Scenario: El docente revisa el estado de un alumno bloqueado
- **WHEN** el docente mira la fila de Agustina Benítez
- **THEN** ve el estado `BLOQUEADO` en rojo junto a la causa `comprobante ilegible`

#### Scenario: El docente copia los correos de los habilitados
- **WHEN** el docente pulsa `Copiar emails habilitados` en una comisión que tiene alumnos habilitados y bloqueados
- **THEN** el maquetado copia solo el correo del alumno habilitado y no incluye el del alumno bloqueado

#### Scenario: El docente copia cuando no hay ningún alumno habilitado
- **WHEN** el docente pulsa `Copiar emails habilitados` en una comisión sin alumnos habilitados
- **THEN** el maquetado informa que no hay correos para copiar, en lugar de copiar una lista vacía

#### Scenario: El docente intenta cambiar el estado de un alumno
- **WHEN** el docente intenta editar el estado de habilitación de una fila
- **THEN** la pantalla no ofrece ningún control de edición y el dato permanece sin cambios

### Requirement: Carga del link de la clase

The system SHALL renderizar, en el detalle de comisión, un campo de entrada de URL `Link de la clase` con una acción de guardado y confirmación que el docente asignado pueda usar. El guardado SHALL rechazar cualquier valor que no sea una URL válida e informar el error sin confirmar. El contenido del campo es único por clase del día y SHALL NOT modificar el estado de habilitación de ningún alumno. Esta adición es intencional: el prototipo declara toda la pantalla como `Solo lectura` y no tiene ningún campo para cargar el link, pero la historia de usuario que exige cargarlo está dentro del alcance mínimo. Cuando la pantalla muestre el chip `Solo lectura`, ese alcance SHALL limitarse al padrón de alumnos y no al campo del link.

#### Scenario: El docente carga un link válido
- **WHEN** el docente escribe una URL válida en `Link de la clase` y confirma
- **THEN** el maquetado confirma la carga y muestra el link guardado como disponible en la clase del día

#### Scenario: El docente carga un valor que no es una URL
- **WHEN** el docente escribe un texto que no es una URL válida y confirma
- **THEN** el maquetado rechaza la carga, informa el error y no guarda el valor

#### Scenario: El docente tiene alumnos bloqueados en la comisión
- **WHEN** el docente consulta la fila de un alumno `BLOQUEADO`
- **THEN** la fila no ofrece ninguna forma de obtener el link de la clase, porque el link solo se distribuye a los alumnos habilitados

#### Scenario: El docente lee el chip de solo lectura
- **WHEN** el docente ve el chip `Solo lectura` en el detalle de la comisión
- **THEN** entiende que el alcance de solo lectura cubre el padrón de alumnos y no el campo `Link de la clase`, que sigue siendo editable

### Requirement: Asistencia de la clase del día

The system SHALL mostrar el chip `CUR-101 · Python Inicial` y el botón `Guardar asistencia`, y una barra de sesión con el texto `Jueves · 19 a 21 hs` y los contadores `1 presente · 1 ausente`. La tabla SHALL tener una columna `ALUMNO`, una columna por cada clase ya dictada con los rótulos `MAR 12/05` y `JUE 14/05`, y una columna editable del día corriente rotulada `HOY · JUE 21/05`. Las filas del padrón son las dos de `CUR-101`: Juan Ignacio Pérez y Agustina Benítez. Cada fecha de columna SHALL coincidir con los días de cursada declarados para la comisión: `CUR-101` imparte `Mar y Jue 19 a 21 hs`, de modo que el día del mes, el día de la semana y la barra de sesión tienen que ser consistentes entre sí.

El maquetado SHALL NOT mostrar un contador de avance de cursada, del tipo `Clase 12 de 24`: la fuente del cliente no declara cuántas clases tiene el curso, por lo que inventar ese denominador sería fabricar un dato de negocio. El contenido de la tabla es fijo y los contadores de la barra de sesión son texto del maquetado: el guardado no persiste datos y no altera el estado de habilitación de ningún alumno.

#### Scenario: El docente abre la asistencia
- **WHEN** el docente abre `Asistencia`
- **THEN** ve el chip `CUR-101 · Python Inicial`, la barra `Jueves · 19 a 21 hs` con `1 presente · 1 ausente` y la tabla con las columnas `ALUMNO`, `MAR 12/05`, `JUE 14/05` y `HOY · JUE 21/05`

#### Scenario: El docente revisa las fechas de la tabla
- **WHEN** el docente compara los rótulos de las columnas con los días de cursada de la comisión y con el calendario
- **THEN** ve que el 12 de mayo de 2026 es martes, que el 14 y el 21 son jueves, y que los tres rótulos coinciden con los días `Mar y Jue` declarados para `CUR-101`

#### Scenario: El docente marca un ausente
- **WHEN** el docente cambia un alumno de `Presente` a `Ausente` en la columna `HOY · JUE 21/05`
- **THEN** el maquetado recalcula los contadores de la barra de sesión y los muestra actualizados

#### Scenario: El docente edita una clase ya dictada
- **WHEN** el docente intenta cambiar una celda de las columnas `MAR 12/05` o `JUE 14/05`
- **THEN** solo la columna del día corriente es editable y las columnas de clases anteriores no admiten cambio

#### Scenario: El docente guarda la asistencia
- **WHEN** el docente pulsa `Guardar asistencia`
- **THEN** el maquetado no persiste datos ni modifica el estado de habilitación de ningún alumno

#### Scenario: El docente busca el avance de la cursada
- **WHEN** el docente revisa la cabecera de la pantalla buscando cuántas clases lleva de cuántas
- **THEN** no encuentra ese contador, porque la fuente del cliente no declara la cantidad de clases del curso

### Requirement: Notas y Certificación fuera de alcance

The system SHALL representar `Notas y Certificación` únicamente como un ítem de navegación deshabilitado con la etiqueta `Próximamente`, sin pantalla detrás, sin tabla de notas, sin campo de carga de notas y sin control de certificación. Las tres historias asociadas, cargar notas, habilitar la emisión de certificados y consultar el seguimiento de clases dictadas, quedan reunidas en ese mismo ítem y el sistema SHALL NOT crear ítems separados para ellas. Esta decisión es un punto abierto para el equipo: cuando se implemente el seguimiento de clases dictadas, el equipo definirá si sigue dentro de este ítem o pasa a una pantalla propia.

#### Scenario: El docente elige Notas y Certificación
- **WHEN** el docente pulsa `Notas y Certificación`
- **THEN** no se abre ninguna pantalla y el ítem permanece deshabilitado con la etiqueta `Próximamente`

#### Scenario: El docente busca la carga de notas
- **WHEN** el docente revisa el shell del docente buscando una tabla de notas o un campo de carga
- **THEN** no encuentra ninguno, porque todo ese contenido queda fuera del alcance de este cambio

#### Scenario: El equipo planifica el seguimiento de clases
- **WHEN** el equipo retoma la definición de esta pantalla
- **THEN** tiene registrado que el seguimiento de clases dictadas quedó agrupado en el ítem deshabilitado y que la decisión de separarlo requiere una definición nueva

### Requirement: Perfil del docente

El sistema SHALL mostrar una tarjeta de identidad con el avatar de la cuenta de la sesión, su
nombre y la nota de Secretaría. El bloque de datos personales SHALL mostrar `Nombre`, `Apellido`,
`DNI` y `CUIL` en solo lectura y `Email` y `Teléfono` editables con guardado real. La pantalla
SHALL incluir una tarjeta `Seguridad` que reutilice `POST /auth/change-password` y SHALL mostrar
`Comisiones asignadas` con `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`.

#### Scenario: El docente abre su perfil
- **WHEN** el docente abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con el avatar y el nombre de la cuenta de la sesión y la nota `Los cambios administrativos deben solicitarse a Secretaría BA.`, sin chip de permisos

#### Scenario: El docente revisa sus datos de contacto
- **WHEN** el docente baja al bloque de datos personales
- **THEN** ve `Nombre`, `Apellido`, `DNI` y `CUIL` como campos deshabilitados y `Email` y `Teléfono` como campos editables con el valor guardado

#### Scenario: El docente edita su email y su teléfono
- **WHEN** el docente cambia el email o el teléfono y guarda
- **THEN** la pantalla muestra el aviso de éxito y los valores que devolvió la API, y la sesión refleja el email nuevo

#### Scenario: El guardado falla
- **WHEN** el email ya pertenece a otra persona o el formato es inválido
- **THEN** la pantalla muestra el error, conserva lo ingresado y no confirma el cambio

#### Scenario: El docente cambia su contraseña desde el perfil
- **WHEN** el docente completa contraseña actual, nueva y confirmación y confirma el cambio
- **THEN** la pantalla muestra el aviso de éxito y la contraseña anterior deja de funcionar

#### Scenario: El docente revisa sus comisiones
- **WHEN** el docente baja al bloque `Comisiones asignadas`
- **THEN** ve las columnas `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`, con sus comisiones reales y el estado `Activa` en verde

#### Scenario: El docente intenta editar su perfil
- **WHEN** el docente intenta modificar `Nombre`, `Apellido`, `DNI` o `CUIL`
- **THEN** los campos están deshabilitados y la API rechaza el intento con `422`, mientras `Email`, `Teléfono` y la contraseña sí se pueden editar

### Requirement: Control de acceso al shell del docente

The system SHALL rechazar con 403 a un usuario autenticado con rol docente que navegue a una ruta del shell de Administración o a una del shell de Alumno. The system SHALL rechazar con 403 el acceso al padrón de una comisión a la que el docente no está asignado, sin revelar nombres ni datos de esa comisión.

#### Scenario: El docente navega a un shell ajeno
- **WHEN** un usuario con rol docente navega a una ruta de Administración o de Alumno
- **THEN** el sistema lo rechaza con 403 y no le muestra ninguna pantalla de esos shells

#### Scenario: El docente abre una comisión ajena
- **WHEN** un docente que no está asignado a una comisión intenta abrir su padrón de alumnos
- **THEN** el sistema lo rechaza con 403 sin revelar nombres ni datos de esa comisión

#### Scenario: El docente abre una comisión asignada
- **WHEN** el docente de `CUR-101` abre el padrón de alumnos de esa comisión
- **THEN** el sistema le muestra el padrón de esa comisión
