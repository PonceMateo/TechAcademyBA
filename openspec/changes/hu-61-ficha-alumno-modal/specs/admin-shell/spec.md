# Spec Delta

## MODIFIED Requirements

### Requirement: Alumnos, categorías arancelarias y cuentas corporativas

The system SHALL mostrar el bloque `Padrón de Alumnos Regulares` con una acción
`+ Nuevo Alumno`, un campo de búsqueda de placeholder `Buscar por DNI o Nombre…`, y una tabla
cuyas columnas, con estos rótulos literales y en este orden, son `DNI`, `NOMBRE`, `EMAIL` y
`TELÉFONO`. La tabla SHALL NOT mostrar `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA`,
`ACCESO PLATAFORMA` ni una columna de acciones: los datos de inscripción y las acciones viven en la
ficha del alumno y en la consulta de habilitación.

La acción `+ Nuevo Alumno` SHALL abrir un modal titulado `Nuevo Alumno` con los campos
`DNI`, `Nombre`, `Email` y `Teléfono`, en ese orden, y los botones `Cancelar` y `Guardar
Alumno`. El modal SHALL reutilizar el diseño y los componentes del modal de Docentes y
SHALL NOT modificar colores, tipografías, navegación ni estilos globales. El formulario
SHALL NOT pedir `tipo_documento`: esta entrega registra solo DNI.

WHEN el alta es exitosa, la pantalla SHALL cerrar el modal de alta, abrir un modal superpuesto
con las credenciales e incorporar al padrón el alumno que devuelve la fuente. El modal SHALL
mostrar el nombre del alumno, el usuario —el email— y la contraseña inicial que devuelve el alta,
reutilizando los componentes visuales existentes y conservando la identidad visual del sistema, y
SHALL poder cerrarse con su botón de cierre o con su acción de cierre. La contraseña inicial SHALL
NOT incorporarse a la fila del padrón ni pedirse de nuevo a la fuente. WHEN el alta es rechazada, la
pantalla SHALL mantener el formulario abierto con lo que el operador completó y SHALL
mostrar el motivo que devuelve la fuente, sin confirmar el alta. WHEN la fuente no puede
registrar el alta, la pantalla SHALL fallar y SHALL NOT mostrar una confirmación.

Las filas del maquetado son, en este orden: Juan Ignacio Pérez, documento `38.456.789`,
`juan.perez@gmail.com`; Camila Rodríguez, documento `40.112.233`, `cami_rod@hotmail.com`;
Matías Fernández, documento `39.887.665`, `mati.fdez@yahoo.com.ar`; Nicolás Castro, documento
`Sin DNI (alumno exterior)`, `nicocastro_uy@gmail.com`; Agustina Benítez, documento
`41.332.114`, `agus.benitez@gmail.com`; y Valeria Rossi, documento `36.778.990`,
`valerossi@gmail.com`. La columna `DNI` SHALL renderizar el documento exactamente como lo
registra el cliente, incluido el texto `Sin DNI (alumno exterior)` del alumno de Uruguay.

En el modo por omisión, las filas SHALL ser las que devuelve `GET /alumnos`. La pantalla SHALL
NOT inventar una comisión, una categoría ni un estado de habilitación para completar la fila:
esos datos ya no viajan en la consulta del padrón.

La misma pantalla SHALL mostrar el bloque `Cuentas Corporativas Vinculadas` con una tabla
cuyas columnas, en este orden literal, son `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y
`NÓMINA DE EMPLEADOS`, donde la preferencia de factura se renderiza como badge `A` o `B`.
Las filas del maquetado son, en este orden: `Tech Solutions S.A.` con CUIT
`30-71665544-9`, preferencia de factura `A` y nómina `Grupo 5 (Data Analytics) y Grupo 2
(Python Inicial), segunda tanda de empleados`; y `Banco Federal (Capacitaciones)` con CUIT
`30-50001234-4`, preferencia de factura `A` y nómina `10 personas, falta enviar la nómina`.
El alta de cuenta corporativa pertenece a esta misma pantalla y no a una pantalla separada
de empresas.

#### Scenario: El usuario abre el padrón de alumnos

- **WHEN** un usuario de Secretaría abre `Alumnos e Inscripciones`
- **THEN** ve el bloque `Padrón de Alumnos Regulares` con la acción `+ Nuevo Alumno` y la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL` y `TELÉFONO`

#### Scenario: La tabla no muestra datos de inscripción

- **WHEN** el padrón devuelve un alumno con una o varias inscripciones
- **THEN** la fila muestra solo sus datos personales y no muestra comisión, categoría ni estado de acceso

#### Scenario: Alumno sin inscripción en la tabla

- **WHEN** el padrón devuelve un alumno que todavía no tiene inscripción
- **THEN** la fila muestra sus datos personales y no inventa una comisión, una categoría ni un estado de acceso

#### Scenario: El usuario revisa las categorías

- **WHEN** el usuario abre el formulario de categoría de una inscripción
- **THEN** encuentra las cuatro categorías con el color que las distingue: `PARTICULAR` en gris, `BECADO PARCIAL` en violeta con su porcentaje de descuento, `BECADO TOTAL` en magenta y `CORPORATIVO` en celeste

#### Scenario: El usuario revisa los bloqueos reales

- **WHEN** el usuario consulta la habilitación de Agustina Benítez y de Valeria Rossi en los datos de ejemplo
- **THEN** ve `BLOQUEADO` en rojo junto a las causas `comprobante ilegible` y `debe saldo`, respectivamente

#### Scenario: El usuario abre el modal de alta

- **WHEN** el usuario pulsa `+ Nuevo Alumno`
- **THEN** se abre el modal `Nuevo Alumno` con los campos `DNI`, `Nombre`, `Email` y `Teléfono`, los botones `Cancelar` y `Guardar Alumno`, y ningún campo de tipo de documento

#### Scenario: Alta de alumno correcta

- **WHEN** el usuario completa DNI, nombre, email y teléfono de un alumno no registrado y pulsa `Guardar Alumno`
- **THEN** el modal de alta se cierra, se abre el modal de credenciales, la pantalla incorpora el alumno creado al padrón y el modal muestra el nombre, el usuario y la contraseña inicial

#### Scenario: El usuario cierra el modal de credenciales

- **WHEN** el usuario pulsa la acción de cierre del modal de credenciales o su botón de cerrar
- **THEN** el modal se cierra y la pantalla queda en el padrón, sin un bloque de credenciales fijo dentro de la página

#### Scenario: Alta rechazada por dato duplicado

- **WHEN** la fuente rechaza el alta porque el DNI o el email ya están registrados
- **THEN** el modal sigue abierto con lo que el operador completó, muestra el motivo que devuelve la fuente y no confirma el alta

#### Scenario: Alta que no llega a la base

- **WHEN** la fuente no puede registrar el alta
- **THEN** la pantalla no muestra ninguna confirmación y muestra el motivo de la falla

#### Scenario: El formulario valida antes de enviar

- **WHEN** el usuario deja vacío el DNI, el nombre o el email, o informa un DNI que no tiene 7 u 8 dígitos o un email con formato inválido
- **THEN** el formulario muestra el error en el campo correspondiente y no envía el alta

#### Scenario: El usuario busca al alumno del exterior

- **WHEN** el usuario recorre la columna `DNI` con los datos de ejemplo
- **THEN** ve el valor `Sin DNI (alumno exterior)` en la fila de Nicolás Castro, tal como lo registra el cliente, sin un documento numérico inventado

#### Scenario: El buscador está deshabilitado

- **WHEN** el usuario intenta escribir en `Buscar por DNI o Nombre…`
- **THEN** el campo no filtra ni navega y muestra la leyenda `Próximamente`, porque la búsqueda es la historia #16

#### Scenario: La búsqueda no arroja resultados

- **WHEN** el usuario intenta buscar un DNI o un nombre que no existe en el padrón
- **THEN** el campo está deshabilitado, no filtra ni informa resultados y muestra la leyenda `Próximamente`. El escenario conserva el nombre de la regla anterior, que ya no aplica porque la búsqueda es la historia #16

#### Scenario: El usuario revisa las cuentas corporativas

- **WHEN** el usuario baja al bloque `Cuentas Corporativas Vinculadas`
- **THEN** ve las columnas `RAZÓN SOCIAL`, `CUIT`, `PREFERENCIA FACTURA` y `NÓMINA DE EMPLEADOS`, con `Tech Solutions S.A.` y `Banco Federal (Capacitaciones)` y el badge `A` de factura en ambas

#### Scenario: El usuario busca la nómina faltante

- **WHEN** el usuario lee la columna `NÓMINA DE EMPLEADOS`
- **THEN** ve que la fila de Banco Federal aclara que falta enviar la nómina y que la de Tech Solutions S.A. describe la segunda tanda de empleados

#### Scenario: El usuario da de alta una empresa

- **WHEN** el usuario pulsa `+ Nueva Empresa`, completa razón social, un CUIT válido, marca o no `Requiere Factura A` y confirma
- **THEN** el modal se cierra y la empresa aparece en la tabla `Cuentas Corporativas Vinculadas` con su badge de preferencia de factura

#### Scenario: Razón social vacía en el alta

- **WHEN** el usuario confirma el alta sin razón social
- **THEN** el formulario no se envía e indica que la razón social es obligatoria

#### Scenario: El backend rechaza el alta

- **WHEN** el backend rechaza el alta, por ejemplo por un CUIT ya registrado o con dígito verificador inválido
- **THEN** el modal permanece abierto y muestra el motivo tal como lo devuelve la fuente, identificando la empresa existente cuando el rechazo es por duplicado

### Requirement: Acciones de edición, contraseña y baja en el padrón de alumnos

La pantalla `Alumnos e Inscripciones` SHALL ofrecer las acciones **Editar**, **Categoría**,
**Restablecer contraseña** y **Eliminar alumno** en el menú ⋮ de la ficha del alumno, reutilizando
los componentes `Button`, `Modal` e `Input` existentes y sin cambiar colores, tipografías ni
navegación. La tabla SHALL NOT ofrecer una columna `ACCIONES`. Las operaciones SHALL pasar por
`src/services/` y SHALL actualizar los datos visibles al terminar.

La acción **Categoría** SHALL operar sobre la inscripción de la pestaña abierta en la ficha; sin
pestañas, SHALL informar que primero hay que inscribir al alumno.

#### Scenario: Editar desde la fila

- **WHEN** el administrador elige **Editar** en el menú de la ficha
- **THEN** se abre un modal con DNI, nombre, email y teléfono precargados y, al guardar, la ficha y la fila muestran los datos actualizados

#### Scenario: Rechazo de un dato duplicado

- **WHEN** la edición se rechaza por DNI o email repetido
- **THEN** el modal queda abierto con lo cargado y muestra el motivo informado por la fuente

#### Scenario: Restablecer la contraseña

- **WHEN** el administrador elige **Restablecer contraseña** y confirma una nueva contraseña válida
- **THEN** el modal se cierra y la pantalla informa que la contraseña fue restablecida, sin mostrarla en claro

#### Scenario: Confirmar la baja

- **WHEN** el administrador elige **Eliminar alumno**
- **THEN** se abre un modal de confirmación con el nombre del alumno y las opciones de cancelar o confirmar

#### Scenario: Cancelar la baja

- **WHEN** el administrador cancela la confirmación
- **THEN** el alumno sigue visible y no se modifica ningún registro

#### Scenario: Baja confirmada

- **WHEN** el administrador confirma la baja
- **THEN** la fila desaparece del listado, la ficha se cierra y la pantalla muestra un mensaje de confirmación

#### Scenario: Categoría de un alumno con una inscripción

- **WHEN** el administrador elige **Categoría** en la ficha de un alumno con una sola inscripción
- **THEN** se abre el formulario de categoría de esa inscripción sin pedir una selección previa

#### Scenario: Categoría de un alumno con varias inscripciones

- **WHEN** el administrador cambia la categoría desde una pestaña de un alumno con dos inscripciones
- **THEN** solo esa inscripción cambia y la otra pestaña conserva su categoría

#### Scenario: Categoría de un alumno sin inscripciones

- **WHEN** el administrador abre la ficha de un alumno sin inscripciones
- **THEN** no hay pestañas y la ficha informa que primero hay que inscribirlo

#### Scenario: Aviso de reactivación al intentar un alta duplicada

- **WHEN** el alta de un alumno choca con un DNI o email de un alumno dado de baja
- **THEN** la pantalla muestra un modal que indica que el alumno fue dado de baja antes y ofrece **Reactivar alumno**

#### Scenario: Reactivación confirmada desde el modal

- **WHEN** el administrador confirma **Reactivar alumno**
- **THEN** el alumno vuelve al listado de activos y la pantalla muestra las nuevas credenciales iniciales

#### Scenario: Reactivación cancelada desde el modal

- **WHEN** el administrador cancela el aviso de reactivación
- **THEN** no se modifica ningún dato y el formulario de alta conserva lo cargado

#### Scenario: La tabla no tiene columna de acciones

- **WHEN** el usuario mira la tabla del padrón
- **THEN** no ve una columna `ACCIONES` y las acciones solo están en el menú de la ficha

## ADDED Requirements

### Requirement: Ficha del alumno en modal

El padrón SHALL abrir un modal de ficha al pulsar una fila o al presionar Enter con la fila
enfocada. La ficha SHALL mostrar los datos del alumno en modo lectura, un menú ⋮ de acciones y una
pestaña por cada inscripción, activa o no, con su comisión, categoría, empresa, el estado de la
inscripción —y, en las `ACTIVA`, el estado de habilitación con su causa— e importes. SHALL cerrarse
con Escape, con su botón de cierre y al completar una baja, y SHALL devolver el foco a la fila que
la abrió.

#### Scenario: Abrir la ficha con el mouse

- **WHEN** el administrador pulsa una fila del padrón
- **THEN** se abre el modal con el DNI, el nombre, el email y el teléfono del alumno en modo lectura

#### Scenario: Abrir la ficha con el teclado

- **WHEN** el administrador enfoca una fila y presiona Enter
- **THEN** se abre la misma ficha, sin navegar a otra pantalla

#### Scenario: Menú de acciones

- **WHEN** el administrador abre el menú ⋮ de la ficha
- **THEN** ve **Editar**, **Eliminar** y **Restablecer contraseña**, con el comportamiento ya desarrollado

#### Scenario: Pestañas por inscripción

- **WHEN** el alumno tiene una inscripción particular y otra corporativa
- **THEN** la ficha muestra dos pestañas, cada una con su comisión, su categoría —con el porcentaje si es beca parcial— y su estado de habilitación con la causa cuando está bloqueada

#### Scenario: Pestaña de una inscripción corporativa

- **WHEN** el administrador abre la pestaña de una inscripción corporativa
- **THEN** ve la razón social de la empresa y el arancel a cargo de la empresa, en lugar de un saldo del alumno

#### Scenario: Pestaña de una inscripción terminada

- **WHEN** el administrador abre la pestaña de una inscripción `COMPLETADA`
- **THEN** ve el estado de la inscripción en lugar de un estado de habilitación, sin causa de bloqueo, y los importes siguen informándose

#### Scenario: Dinero de la inscripción

- **WHEN** el administrador abre la pestaña de una inscripción particular con pagos
- **THEN** ve el total pagado, lo pendiente de acreditación y el saldo pendiente para cubrir esa inscripción

#### Scenario: Alumno sin inscripciones

- **WHEN** el alumno no tiene ninguna inscripción
- **THEN** la ficha muestra un mensaje informativo en lugar de las pestañas

#### Scenario: Cerrar la ficha

- **WHEN** el administrador presiona Escape o usa el botón de cierre de la ficha
- **THEN** el modal se cierra y el foco vuelve a la fila del padrón que lo abrió

#### Scenario: No se puede leer el detalle

- **WHEN** la consulta del detalle falla
- **THEN** la ficha muestra el motivo de la falla y no inventa inscripciones, estados ni importes
