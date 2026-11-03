# Spec Delta

## MODIFIED Requirements

### Requirement: Estructura y navegación del shell de Administración

The system SHALL renderizar el shell de Administración sobre un fondo con degradado sutil en el
tono del rol, con un panel lateral blanco translúcido **sin rótulo de título**: el panel no lleva
el texto `MENÚ OPERATIVO` ni ninguna categoría de sección. El panel SHALL mostrar la marca del
producto arriba y SHALL ofrecer los ítems de navegación, en este orden exacto: `Dashboard`,
`Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones`, `Cobranzas e Ingresos`, cada uno con
un ícono y el ítem activo destacado en el acento azul del rol. La interfaz SHALL estar escrita en
español rioplatense, y Administración y Secretaría siguen siendo el mismo rol: la interfaz lo
identifica siempre como `Secretaría`.

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
- **THEN** ve el lateral sin rótulo de título con la marca y los cinco ítems con ícono, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline y `Período Lectivo 2026`

#### Scenario: El usuario recorre la navegación
- **WHEN** el usuario abre el panel lateral
- **THEN** los ítems aparecen en el orden `Dashboard`, `Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones` y `Cobranzas e Ingresos`, y cada uno abre su propia pantalla

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

#### Scenario: El usuario busca la sección de habilitación
- **WHEN** el usuario recorre el panel lateral y la barra superior
- **THEN** no encuentra un ítem `Habilitación de Accesos` ni una pantalla independiente de habilitación, porque el forzado se administra desde la ficha del alumno

#### Scenario: El usuario abre la URL anterior de habilitación
- **WHEN** un usuario de Secretaría navega a `/admin/habilitacion`
- **THEN** ve la pantalla 404 existente y no una pantalla de habilitación

### Requirement: Categoría y estado de la comisión en la ficha

El bloque de la comisión elegida SHALL mostrar en filas etiqueta/valor la categoría arancelaria con
su insignia —y el porcentaje si es beca parcial— junto a un botón `Editar categoría` que abre el
mismo formulario; la empresa solo en corporativo; y el estado de habilitación con su insignia y su
causa cuando está bloqueado, identificándolo como forzado cuando lo fue. Una inscripción no activa
SHALL mostrar su estado de inscripción en lugar de un estado de habilitación.

La fila `Estado de habilitación` de una inscripción `ACTIVA` SHALL mostrar, junto al estado, un
botón de edición con el mismo ícono, tamaño, estilo y hover que el botón `Editar categoría`. Ese
botón SHALL abrir un modal de habilitación de esa inscripción, sin navegar a una pantalla nueva,
y SHALL NOT mostrarse en inscripciones que no estén `ACTIVA`.

#### Scenario: Comisión de una inscripción corporativa

- **WHEN** el administrador elige una inscripción corporativa
- **THEN** ve la razón social de la empresa, `Arancel a abonar` en `—` y `Saldo pendiente` en `A cargo de la empresa`, sin indicador de observados

#### Scenario: Comisión de una inscripción terminada

- **WHEN** el administrador elige una inscripción `COMPLETADA`
- **THEN** ve el estado de la inscripción en lugar de un estado de habilitación, sin causa de bloqueo, y los importes siguen informándose

#### Scenario: Editar la categoría desde la ficha

- **WHEN** el administrador pulsa el lápiz de la categoría y guarda otra categoría
- **THEN** se abre el mismo formulario de categoría y la ficha muestra la categoría nueva sin tocar las demás inscripciones

#### Scenario: Editar la habilitación desde la ficha

- **WHEN** el administrador pulsa el lápiz de `Estado de habilitación` de una inscripción `ACTIVA`
- **THEN** se abre el modal de habilitación de esa inscripción, con el alumno, la comisión, el estado automático, el estado efectivo y el indicador de forzado

#### Scenario: Inscripción no activa sin lápiz

- **WHEN** el administrador elige una inscripción `COMPLETADA` o `BAJA`
- **THEN** la fila muestra el estado de la inscripción y no ofrece el lápiz de habilitación

#### Scenario: Ambos lápices conviven

- **WHEN** el administrador revisa la comisión elegida de una inscripción `ACTIVA`
- **THEN** ve el lápiz de `Categoría arancelaria` y el lápiz de `Estado de habilitación`, cada uno con su propia acción

## REMOVED Requirements

### Requirement: Habilitación de accesos y acciones excepcionales

**Reason**: la pantalla independiente `Habilitación de Accesos` ya no forma parte del panel de
Administración. El forzado manual se administra desde la ficha del alumno, sobre la inscripción
seleccionada, y el backend nunca tuvo el endpoint de forzado por alumno que esa pantalla usaba. La
búsqueda de alumnos, la ficha resumen y la emisión de certificados quedan cubiertas por el padrón,
la ficha del alumno y sus huecos ya declarados.

**Migration**: el forzado pasa al lápiz de `Estado de habilitación` de `Ver ficha` y a los
endpoints `POST /inscripciones/{id}/habilitacion` y `DELETE /inscripciones/{id}/habilitacion`. La
copia de correos habilitados sigue disponible en la gestión de una comisión. `/admin/habilitacion`
responde 404.
