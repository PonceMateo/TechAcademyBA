# admin-shell Specification

## Purpose

Definir el shell de Administración y Secretaría de TechAcademy BA como maqueta navegable: su navegación, sus seis pantallas y la forma visible de representar el estado de acceso de cada alumno, apoyadas en datos de ejemplo de comisiones, docentes, alumnos, cuentas corporativas y cobranzas, y sin implementar lógica de negocio ni historias de usuario.

## Requirements

### Requirement: Estructura y navegación del shell de Administración

The system SHALL renderizar el shell de Administración con un panel lateral titulado `MENÚ OPERATIVO`, una barra superior con el chip `Sede Constituciones` y el texto `Período Lectivo 2026`, y un pie con el nombre `Secretaria BA` y la etiqueta `Terminal Interna 04`. Administración y Secretaría son el mismo rol: la interfaz lo identifica siempre como `Secretaría`. La interfaz SHALL estar escrita en español rioplatense y SHALL ofrecer los ítems de navegación, en este orden exacto: `Dashboard`, `Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones`, `Cobranzas e Ingresos`, `Habilitación de Accesos`. El período lectivo SHALL renderizarse como `Período Lectivo 2026` en las tres pantallas de shell, aunque el prototipo muestre `Periodo Lectivo 2025`: es una corrección intencional de la línea temporal del proyecto.

#### Scenario: El usuario abre el shell de Administración
- **WHEN** un usuario con rol Secretaría se autentica y abre una pantalla del shell
- **THEN** ve el panel `MENÚ OPERATIVO`, la barra superior con `Sede Constituciones` y `Período Lectivo 2026`, y el pie con `Secretaria BA` y `Terminal Interna 04`

#### Scenario: El usuario recorre la navegación
- **WHEN** el usuario abre el panel lateral
- **THEN** los ítems aparecen en el orden `Dashboard`, `Cursos y Comisiones`, `Docentes`, `Alumnos e Inscripciones`, `Cobranzas e Ingresos` y `Habilitación de Accesos`, y cada uno abre su propia pantalla

#### Scenario: El usuario cambia de pantalla
- **WHEN** el usuario elige un ítem de navegación
- **THEN** el ítem queda destacado como activo y la dirección de la pantalla refleja la sección elegida

### Requirement: Dashboard operativo con indicadores y alertas estáticas

The system SHALL mostrar cuatro tarjetas de indicador con estos rótulos, valores y textos de apoyo literales: `ALUMNOS INSCRIPTOS` con valor `8` y el texto `en comisiones abiertas y en curso`; `COMISIONES` con valor `10` y el texto `en el catálogo`; `COBROS PENDIENTES DE COBRO` con valor `3` y el texto `3 comprobantes observados`; y `CUPO PROMEDIO OCUPADO` con valor `27%` y el texto `sobre las comisiones del catálogo`. El valor `27%` es un texto fijo del maquetado, consistente con los cupos y las vacantes de las comisiones del catálogo: sobre un cupo total de 160 lugares hay 43 ocupados y 117 vacantes. El sistema SHALL NOT calcular ese porcentaje ni ningún otro agregado en tiempo de ejecución.

The system SHALL mostrar el bloque `Alertas de Gestión Pendiente` con tres ítems tomados de casos reales del cliente: `Comprobante ilegible de Agustina Benítez` con chip `Urgente`, `Cheque de Banco Federal pendiente de acreditación` con chip `Observado` y `Valeria Rossi debe la mitad del arancel` con chip `Aviso`. Como cuarta línea SHALL mostrarse un texto de lista de espera, `La comisión CUR-104 alcanzó su cupo de 20 inscriptos y figura cerrada por cupo. Hay lista de espera activa.`, con chip `Aviso`, que es contenido de ejemplo y no un dato de negocio: la lista de espera es una función real que el cliente confirmó y que queda fuera del alcance de este change, por lo que esa línea SHALL NOT ser navegable ni abrir ninguna pantalla.

The system SHALL mostrar el bloque `Accesos Rápidos del Personal` con las acciones `Registrar Cobranza`, `Verificar Habilitaciones` y `Descargar Reporte del Día`, que usan la misma denominación que los datos del cliente. Todo el contenido del dashboard es texto fijo: el sistema no calcula agregados, no consulta datos y las tres acciones rápidas no navegan a ninguna pantalla.

#### Scenario: El usuario abre el Dashboard
- **WHEN** un usuario de Secretaría abre `Dashboard`
- **THEN** ve las cuatro tarjetas con los rótulos, valores y textos de apoyo indicados, y el bloque de alertas con sus tres casos reales y la cuarta línea de lista de espera

#### Scenario: El usuario compara los indicadores con el catálogo
- **WHEN** el usuario lee `COMISIONES` con valor `10` y lo contrasta con el listado de `Cursos y Comisiones`
- **THEN** el valor coincide con la cantidad de comisiones del catálogo del cliente, y `ALUMNOS INSCRIPTOS` muestra `8`, que es la cantidad de alumnos distintos inscriptos en los datos del cliente

#### Scenario: El usuario pulsa una acción rápida
- **WHEN** el usuario pulsa `Registrar Cobranza`, `Verificar Habilitaciones` o `Descargar Reporte del Día`
- **THEN** no ocurre ninguna navegación ni se ejecuta ninguna lógica, porque ninguna historia de usuario cubre esta pantalla

#### Scenario: El usuario lee la línea de lista de espera
- **WHEN** el usuario lee la cuarta línea del bloque de alertas
- **THEN** ve el texto sobre el cupo alcanzado de `CUR-104` y no encuentra ninguna pantalla de lista de espera en el producto, porque la función existe pero queda fuera de este change

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
hs`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)`, `Modalidad` y `Sede`, con los botones
`Cancelar` y `Guardar Comisión`. El modal SHALL NOT pedir un código de comisión: el código lo deriva
el sistema del curso y del número, y la pantalla lo muestra al confirmar. `Docente Asignado` SHALL
ser una selección de los docentes del padrón y SHALL NOT ser un campo de búsqueda de texto libre.
`Modalidad` SHALL ofrecer `Virtual`, `Presencial` y `Híbrido`, y `Sede` SHALL ser obligatoria solo
cuando la modalidad seleccionada sea `Presencial` o `Híbrido`.

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
- **THEN** el modal `Crear Nueva Comisión` muestra los campos en el orden `Curso / Programa`, `Docente Asignado`, `Días y Horarios`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)`, `Modalidad` y `Sede`, con los botones `Cancelar` y `Guardar Comisión`, y no muestra ningún campo para el código de la comisión porque el sistema lo genera

#### Scenario: El usuario elige modalidad virtual
- **WHEN** el usuario selecciona modalidad `Virtual` y confirma sin elegir sede
- **THEN** el sistema acepta la carga y no exige sede, porque la sede solo es obligatoria para modalidad `Presencial` o `Híbrido`

#### Scenario: El usuario elige modalidad presencial sin sede
- **WHEN** el usuario selecciona modalidad `Presencial` o `Híbrido` y confirma sin elegir sede
- **THEN** el sistema no confirma la carga e indica que el campo `Sede` es obligatorio

#### Scenario: El usuario busca en el catálogo
- **WHEN** el usuario escribe en el buscador de cualquiera de las dos vistas
- **THEN** el campo no acepta la escritura y su leyenda explica que la búsqueda todavía no está disponible, y el contenido de la vista no cambia

#### Scenario: La ruta apunta a un curso que no existe
- **WHEN** el usuario abre la dirección de un curso que no está en el catálogo
- **THEN** ve que el curso no existe y puede volver al catálogo, en lugar de una tabla de comisiones vacía

#### Scenario: El usuario busca una acción de edición
- **WHEN** el usuario recorre el listado y el modal
- **THEN** no encuentra ningún control de edición de curso ni de comisión, porque esas historias quedan fuera de este cambio

### Requirement: Padrón de docentes

The system SHALL mostrar la pantalla `Docentes` con un listado cuyas columnas, en este orden literal, son `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS` y `ESTADO`, con un campo de búsqueda por nombre, apellido, DNI o email, y la acción `+ Nuevo Docente`. La columna `CUIL` SHALL mostrar el dato cuando el docente lo tenga y SHALL NOT exigirlo: el CUIL es único pero opcional en el modelo, y un docente sin CUIL es una fila válida. Las filas del maquetado son, en este orden: Profe Martín con `Programación`, 1 comisión asignada y estado `Activa`; Lic. Laura Benítez con `Desarrollo Web`, 1 comisión asignada y `Activa`; Santi Ads con `Marketing`, 2 comisiones asignadas y `Activa`; Dr. Marcelo Ríos con `Datos`, 1 comisión asignada y `Activa`; e Ing. González con `Programación`, 1 comisión asignada y `Activa`. La columna `ESTADO` SHALL renderizar `Activa` en verde. El maquetado SHALL NOT mostrar columnas de documento, correo ni teléfono de los docentes, porque los datos del cliente no registran esos datos y no deben inventarse.

Esta pantalla es una adición intencional: el prototipo no la incluye y el alta de docente está dentro del alcance mínimo. La acción `+ Nuevo Docente` SHALL abrir el modal `Nuevo Docente`, con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y `Teléfono`, y sin ningún campo de CUIL porque el contrato del alta no lo admite. El sistema SHALL NOT renderizar un formulario de edición de docente. El control de clases dictadas por el profesor queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin ninguna pantalla detrás.

#### Scenario: El usuario abre el padrón de docentes
- **WHEN** un usuario de Secretaría abre `Docentes`
- **THEN** ve el listado con las columnas `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS` y `ESTADO`, los cinco docentes del maquetado, sus datos de contacto, sus especialidades, sus comisiones asignadas y el estado `Activa` en verde, más la acción `+ Nuevo Docente`

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
- **THEN** la acción `+ Nuevo Docente` abre el formulario de alta real, no hay control de edición, y el control de clases dictadas aparece como ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

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

The system SHALL mostrar el bloque `Buscador de Alumnos y Cuentas Corporativas` con un campo de búsqueda, el botón `Consultar Habilitación` y la ayuda `Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.`; el bloque `Ficha Resumen del Alumno` con los campos `DNI / Documento`, `Nombre Completo`, `Email Registrado`, `Curso Inscrito`, `Categoría Arancelaria` y `Último Pago Imputado`; y el bloque `Estado del Acceso`, que SHALL mostrar una marca verde con `HABILITADO` y el texto `El alumno cumple con la condición arancelaria.`, o la variante roja `BLOQUEADO` que SHALL mostrar la causa del bloqueo junto al estado. Debajo, el bloque `ACCIONES EXCEPCIONALES` SHALL renderizar la acción `Forzar Bloqueo Manual` acompañada de un campo `Motivo` obligatorio y de la identificación del usuario y de la fecha de la operación, más la acción `Copiar emails habilitados de CUR-101`.

La aparición del campo `Motivo` es intencional: el prototipo ofrece el forzado de bloqueo con un botón y ningún campo para justificarlo, y la historia de usuario exige un motivo no vacío junto al usuario y la fecha de la operación. La acción de copia SHALL seguir la misma regla de negocio en todos los casos: copia únicamente los correos de los alumnos habilitados de la comisión indicada, y cuando la comisión no tiene ningún alumno habilitado SHALL informar que no hay correos para copiar en lugar de copiar una lista vacía.

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
- **WHEN** el usuario pulsa `Copiar emails habilitados de CUR-101` sobre una comisión que tiene alumnos habilitados y bloqueados
- **THEN** el maquetado copia solo los correos de los alumnos habilitados y no incluye los de los bloqueados

#### Scenario: La comisión no tiene alumnos habilitados
- **WHEN** el usuario pulsa la copia de correos habilitados sobre una comisión sin ningún alumno habilitado
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
