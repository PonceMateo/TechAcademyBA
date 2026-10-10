# Spec Delta

## Purpose

Actualizar el armazón y el índice del shell del Docente al diseño de Figma (JSON
`Dashboard · Profesor`): acento verde, lateral sin rótulo y con íconos, barra superior nueva con
perfil y cierre de sesión en el menú, pie de tres textos, y el listado de comisiones con la
composición de saludo, indicadores y dos columnas. Cambios de apariencia y composición: los ítems
del menú, sus rutas, los indicadores literales y el padrón no cambian.

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
conectamos.`, el texto `Período Lectivo 2026` y `Última actualización: 09:41`. El período
lectivo SHALL renderizarse como `Período Lectivo 2026`, aunque el prototipo muestre
`Periodo Lectivo 2025` o `Ciclo lectivo 2026`: es una corrección intencional de la línea
temporal del proyecto. El pie SHALL NOT renderizar el avatar `PM`, el nombre `Profe Martín` ni
el rol `DOCENTE`, y el texto de `Última actualización` SHALL ser un literal del maquetado, no
una hora calculada.

#### Scenario: El docente abre su espacio
- **WHEN** un usuario con rol docente se autentica y abre una pantalla de su shell
- **THEN** ve el lateral sin rótulo de título con la marca y sus ítems con ícono, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline, `Período Lectivo 2026` y `Última actualización: 09:41`

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
cuenta}` seguido de la línea de fecha placeholder `Viernes 9 de octubre · Tu agenda y tus
comisiones en un solo lugar.`, donde el nombre es el de la cuenta de la sesión y la fecha es un
literal del maquetado, no un valor calculado. El texto SHALL NOT anunciar una cantidad de clases
ni de entregas: esos valores no están en el maquetado.

The system SHALL mostrar cuatro tarjetas de indicador con los rótulos y valores literales
`COMISIONES ACTIVAS` 1, `ALUMNOS HABILITADOS` 1, `BLOQUEADOS` 1 y `PRÓXIMA CLASE` con el valor
`Hoy · 19:00`. SHALL mostrar el bloque `Comisiones asignadas` con una fila por comisión:
`CUR-101` Python Inicial con Profe Martín, `Mar y Jue · 19 a 21 hs`, próxima clase
`Hoy · 19:00`, 1 habilitado y 1 bloqueado. El docente del maquetado tiene exactamente una
comisión asignada en los datos del cliente, por lo que el maquetado SHALL NOT inventar
comisiones adicionales para completar el bloque.

El tablero SHALL organizarse en dos columnas: a la izquierda, los indicadores y el bloque
`Comisiones asignadas`; a la derecha, un bloque `Tu agenda` con una fila por clase de esa misma
comisión, tomada de su horario y de su próxima clase declarados en este requisito. El tablero
SHALL NOT mostrar bloques de correcciones pendientes, novedades ni mensajes: el maquetado no
registra entregas por corregir ni mensajes, y esos bloques del prototipo no tienen datos detrás.

Los contadores SHALL renderizarse como chip verde para los habilitados y chip rojo para los
bloqueados, y la forma singular o plural SHALL coincidir con la cantidad. El encabezado que el
prototipo titula `RESTRICCIONES` SHALL renombrarse `ACCESO`, porque sus celdas contienen
conteos de acceso y no restricciones. Este renombrado es una corrección intencional de una
inconsistencia del prototipo.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve el saludo con su nombre y la línea de fecha placeholder, las tarjetas `COMISIONES ACTIVAS` 1, `ALUMNOS HABILITADOS` 1, `BLOQUEADOS` 1 y `PRÓXIMA CLASE` con `Hoy · 19:00`, el bloque `Comisiones asignadas` con una sola fila, `CUR-101` Python Inicial, y en la columna derecha el bloque `Tu agenda` con las clases de esa comisión

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre los contadores de cada comisión
- **THEN** los habilitados aparecen en chip verde y los bloqueados en chip rojo, y las etiquetas usan singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS` con el contenido del bloque `Comisiones asignadas`
- **THEN** ve una sola comisión, `CUR-101`, y los indicadores `1` habilitado y `1` bloqueado coinciden con el padrón de esa comisión

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los encabezados de la tabla de comisiones
- **THEN** la columna de conteos se titula `ACCESO` y no `RESTRICCIONES`

#### Scenario: El docente busca entregas o mensajes
- **WHEN** el docente recorre el tablero buscando `Correcciones pendientes` o novedades
- **THEN** no los encuentra, porque el maquetado no registra entregas por corregir ni mensajes
