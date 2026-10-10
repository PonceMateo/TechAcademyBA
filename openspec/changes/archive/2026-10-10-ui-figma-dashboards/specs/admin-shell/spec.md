# Spec Delta

## Purpose

Actualizar el armazón y el tablero del shell de Administración al diseño de Figma (JSON
`Dashboard · Admin / Secretario` y PDF del prototipo): acento azul, lateral sin rótulo y con
íconos, barra superior nueva con perfil y cierre de sesión en el menú, pie de tres textos, y el
Dashboard con la composición de saludo, indicadores y dos columnas. Cambios de apariencia y
composición: los ítems del menú, sus rutas, los valores del tablero y las reglas sobre lo que no
se calcula no cambian.

## MODIFIED Requirements

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
conectamos.`, el texto `Período Lectivo 2026` y `Última actualización: 09:41`. El período
lectivo SHALL renderizarse como `Período Lectivo 2026`, aunque el prototipo muestre
`Periodo Lectivo 2025` o `Ciclo lectivo 2026`: es una corrección intencional de la línea
temporal del proyecto. El pie SHALL NOT renderizar el nombre `Secretaria BA` ni la etiqueta
`Terminal Interna 04`, y el texto de `Última actualización` SHALL ser un literal del maquetado,
no una hora calculada.

#### Scenario: El usuario abre el shell de Administración
- **WHEN** un usuario con rol Secretaría se autentica y abre una pantalla del shell
- **THEN** ve el lateral sin rótulo de título con la marca y los seis ítems con ícono, la barra superior con el breadcrumb, la búsqueda inerte con `⌘ K`, la campana y el perfil con `Cerrar sesión`, y el pie con el tagline, `Período Lectivo 2026` y `Última actualización: 09:41`

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

### Requirement: Dashboard operativo con indicadores y alertas estáticas

The system SHALL mostrar, como encabezado del tablero, el saludo `Buen día, {nombre de la
cuenta}` seguido de la línea de fecha placeholder `Viernes 9 de octubre · Todo lo que necesitás
para gestionar tu academia.`, donde el nombre es el de la cuenta de la sesión y la fecha es un
literal del maquetado, no un valor calculado.

The system SHALL mostrar cuatro tarjetas de indicador con estos rótulos, valores y textos de
apoyo literales: `ALUMNOS INSCRIPTOS` con valor `8` y el texto `en comisiones abiertas y en
curso`; `COMISIONES` con valor `10` y el texto `en el catálogo`; `COBROS PENDIENTES DE COBRO`
con valor `3` y el texto `3 comprobantes observados`; y `CUPO PROMEDIO OCUPADO` con valor `27%`
y el texto `sobre las comisiones del catálogo`. El valor `27%` es un texto fijo del maquetado,
consistente con los cupos y las vacantes de las comisiones del catálogo: sobre un cupo total de
160 lugares hay 43 ocupados y 117 vacantes. El sistema SHALL NOT calcular ese porcentaje ni
ningún otro agregado en tiempo de ejecución.

El tablero SHALL organizarse en dos columnas: a la izquierda, el bloque `Alertas de Gestión
Pendiente` con sus cuatro líneas; a la derecha, el bloque `Accesos Rápidos del Personal` con sus
tres acciones.

The system SHALL mostrar el bloque `Alertas de Gestión Pendiente` con tres ítems tomados de casos
reales del cliente: `Comprobante ilegible de Agustina Benítez` con chip `Urgente`, `Cheque de
Banco Federal pendiente de acreditación` con chip `Observado` y `Valeria Rossi debe la mitad del
arancel` con chip `Aviso`. Como cuarta línea SHALL mostrarse un texto de lista de espera, `La
comisión CUR-104 alcanzó su cupo de 20 inscriptos y figura cerrada por cupo. Hay lista de espera
activa.`, con chip `Aviso`, que es contenido de ejemplo y no un dato de negocio: la lista de
espera es una función real que el cliente confirmó y que queda fuera del alcance de este change,
por lo que esa línea SHALL NOT ser navegable ni abrir ninguna pantalla.

The system SHALL mostrar el bloque `Accesos Rápidos del Personal` con las acciones `Registrar
Cobranza`, `Verificar Habilitaciones` y `Descargar Reporte del Día`, que usan la misma
denominación que los datos del cliente. Todo el contenido del dashboard es texto fijo: el sistema
no calcula agregados, no consulta datos y las tres acciones rápidas no navegan a ninguna
pantalla. El tablero SHALL NOT mostrar gráficos ni indicadores cuyos valores no estén fijados
por este requisito: los números del prototipo (`1.248 alumnos activos`, `32 comisiones en curso`,
`$ 8,4 M cobrados`) no son datos del maquetado y no se reproducen.

#### Scenario: El usuario abre el Dashboard
- **WHEN** un usuario de Secretaría abre `Dashboard`
- **THEN** ve el saludo con su nombre y la línea de fecha placeholder, las cuatro tarjetas con los rótulos, valores y textos de apoyo indicados, las alertas en la columna izquierda y los accesos rápidos en la derecha

#### Scenario: El usuario compara los indicadores con el catálogo
- **WHEN** el usuario lee `COMISIONES` con valor `10` y lo contrasta con el listado de `Cursos y Comisiones`
- **THEN** el valor coincide con la cantidad de comisiones del catálogo del cliente, y `ALUMNOS INSCRIPTOS` muestra `8`, que es la cantidad de alumnos distintos inscriptos en los datos del cliente

#### Scenario: El usuario pulsa una acción rápida
- **WHEN** el usuario pulsa `Registrar Cobranza`, `Verificar Habilitaciones` o `Descargar Reporte del Día`
- **THEN** no ocurre ninguna navegación ni se ejecuta ninguna lógica, porque ninguna historia de usuario cubre esta pantalla

#### Scenario: El usuario lee la línea de lista de espera
- **WHEN** el usuario lee la cuarta línea del bloque de alertas
- **THEN** ve el texto sobre el cupo alcanzado de `CUR-104` y no encuentra ninguna pantalla de lista de espera en el producto, porque la función existe pero queda fuera de este change

#### Scenario: El usuario busca un gráfico del prototipo
- **WHEN** el usuario recorre el tablero buscando la sección `La academia en números` con sus gráficos
- **THEN** no la encuentra, porque los números del prototipo no corresponden a los datos del maquetado
