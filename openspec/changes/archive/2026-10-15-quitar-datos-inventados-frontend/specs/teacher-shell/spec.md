# Spec Delta

## MODIFIED Requirements

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

### Requirement: Perfil del docente

The system SHALL mostrar una tarjeta de identidad con el avatar formado por las iniciales de la
cuenta de la sesión, el nombre de esa cuenta, el chip `DOCENTE · PERMISOS REDUCIDOS` y la nota
`Los cambios administrativos deben solicitarse a Secretaría BA.`; y un bloque de datos de
contacto en modo de solo lectura que, además del nombre, muestre únicamente `Especialidad` con
el valor `Programación` y `Sede de referencia` con el valor `Sede Constituciones`. El bloque de
contacto SHALL NOT mostrar correo institucional ni teléfono, porque la fuente del cliente no los
registra para los docentes y no deben inventarse. La tarjeta de identidad SHALL NOT mostrar un
avatar ni un nombre literales del maquetado.

The system SHALL mostrar el bloque `Comisiones asignadas` con las columnas `CÓDIGO`, `CURSO`,
`HORARIO` y `ESTADO`, con la fila `CUR-101`, Python Inicial, `Mar y Jue · 19 a 21 hs` y estado
`Activa` renderizado en verde. La pantalla SHALL ser completamente de solo lectura: el sistema
SHALL NOT renderizar botones de guardado ni campos editables.

#### Scenario: El docente abre su perfil
- **WHEN** el docente abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con el avatar y el nombre de la cuenta de la sesión —no un avatar ni un nombre literales del maquetado—, el chip `DOCENTE · PERMISOS REDUCIDOS` y la nota `Los cambios administrativos deben solicitarse a Secretaría BA.`

#### Scenario: El docente revisa sus datos de contacto
- **WHEN** el docente baja al bloque de datos de contacto
- **THEN** ve `Especialidad` con `Programación` y `Sede de referencia` con `Sede Constituciones`, y no encuentra correo ni teléfono

#### Scenario: El docente revisa sus comisiones
- **WHEN** el docente baja al bloque `Comisiones asignadas`
- **THEN** ve las columnas `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`, con la fila `CUR-101` / Python Inicial / `Mar y Jue · 19 a 21 hs` y el estado `Activa` en verde

#### Scenario: El docente intenta editar su perfil
- **WHEN** el docente intenta modificar un dato de contacto
- **THEN** la pantalla no ofrece campos editables ni botón de guardado, y los datos se muestran solo como lectura
