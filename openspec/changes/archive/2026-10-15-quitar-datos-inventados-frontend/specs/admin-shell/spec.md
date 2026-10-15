# Spec Delta

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

## RENAMED Requirements

- FROM: `### Requirement: Dashboard operativo con indicadores y alertas estáticas`
- TO: `### Requirement: Tablero operativo con indicadores del catálogo y valores pendientes`
