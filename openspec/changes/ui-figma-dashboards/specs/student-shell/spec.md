# Spec Delta

## Purpose

Actualizar el armazón del shell del Alumno al diseño de Figma (JSON `Dashboard · Alumno`) y dar
la composición de tablero a la pantalla que hoy es su índice: acento dorado, lateral sin rótulo y
con íconos, barra superior nueva con perfil y cierre de sesión en el menú, pie de tres textos, y
un tablero de saludo, indicadores y dos columnas armado con la inscripción, el acceso y el
comprobante del maquetado. Sin pantallas nuevas, sin ítems de menú nuevos y sin datos
inventados.

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
conectamos.`, el texto `Período Lectivo 2026` y `Última actualización: 09:41`. El período
lectivo SHALL renderizarse como `Período Lectivo 2026`, aunque el prototipo muestre
`Periodo Lectivo 2025` o `Ciclo lectivo 2026`: es una corrección intencional de la línea
temporal del proyecto. El pie SHALL NOT renderizar el avatar `CR`, el nombre `Camila Rodríguez`
ni el rol `ALUMNO`, y el texto de `Última actualización` SHALL ser un literal del maquetado, no
una hora calculada.

#### Scenario: El alumno abre su espacio
- **WHEN** un usuario con rol alumno se autentica y abre una pantalla de su shell
- **THEN** ve el lateral sin rótulo de título con la marca y sus ítems con ícono en acento dorado, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline, `Período Lectivo 2026` y `Última actualización: 09:41`

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

## ADDED Requirements

### Requirement: Tablero del Alumno en la ruta raíz

The system SHALL mostrar en la ruta raíz del shell del alumno, sobre la tarjeta de cursos que ya
ofrece el requisito `Cursos del alumno`, un encabezado de tablero con el saludo `Buen día,
{nombre de la cuenta}` y la línea de fecha placeholder `Viernes 9 de octubre · Cada paso cuenta.
Este es tu espacio para avanzar.`, donde el nombre es el de la cuenta de la sesión y la fecha es
un literal del maquetado, no un valor calculado.

The system SHALL mostrar cuatro tarjetas de indicador: `CURSOS EN MARCHA` con valor `1` y apoyo
`CUR-102 · Desarrollo Web Full Stack`; `ACCESO A LA CLASE` con el valor tomado del estado de la
inscripción —`HABILITADO` en verde o `BLOQUEADO` en rojo con su causa—, que es un campo existente
y no un cálculo; `COMPROBANTES ACREDITADOS` con valor `1` y apoyo `$31.000 · Transferencia`; y
`PRÓXIMA CLASE` con el valor `Lun y Miér · 18:30 a 21:30` y apoyo `Desarrollo Web Full Stack`.

El tablero SHALL organizarse en dos columnas: a la izquierda, las tarjetas de las inscripciones
que ya lista la pantalla; a la derecha, un bloque `Tu agenda` con una fila por próximo encuentro
de la inscripción, tomado de los mismos datos que muestra el detalle del curso. El tablero SHALL
NOT calcular porcentajes de progreso, asistencia ni avance, y SHALL NOT mostrar bloques de
tareas, calificaciones ni novedades: el maquetado no tiene esas entidades y los valores del
prototipo (`68 %` de progreso, `3` tareas pendientes, `96 %` de asistencia) no son datos del
sistema.

#### Scenario: La alumna abre su tablero
- **WHEN** la alumna abre la raíz de su shell
- **THEN** ve el saludo con su nombre y la línea de fecha placeholder, las cuatro tarjetas de indicador, sus inscripciones en la columna izquierda y `Tu agenda` con sus próximos encuentros en la derecha

#### Scenario: La alumna compara el indicador de acceso con su tarjeta
- **WHEN** la alumna revisa `ACCESO A LA CLASE` y la tarjeta de su inscripción
- **THEN** ambas muestran el mismo estado, porque el indicador refleja el campo de la inscripción y no un cálculo

#### Scenario: La alumna tiene el acceso bloqueado
- **WHEN** la inscripción de la alumna está bloqueada por un comprobante observado
- **THEN** el indicador `ACCESO A LA CLASE` muestra `BLOQUEADO` en rojo con la causa, junto con la tarjeta que ya la informa

#### Scenario: La alumna busca sus tareas o sus calificaciones
- **WHEN** la alumna recorre el tablero buscando tareas pendientes, calificaciones o un porcentaje de progreso
- **THEN** no los encuentra, porque esas entidades no existen en el maquetado
