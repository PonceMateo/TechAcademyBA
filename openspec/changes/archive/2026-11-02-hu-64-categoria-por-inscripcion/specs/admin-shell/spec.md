# Spec Delta

## MODIFIED Requirements

### Requirement: Alumnos, categorías arancelarias y cuentas corporativas

The system SHALL mostrar el bloque `Padrón de Alumnos Regulares` con una acción
`+ Nuevo Alumno`, un campo de búsqueda de placeholder `Buscar por DNI o Nombre…`, y una tabla
cuyas columnas, con estos rótulos literales y en este orden, son `DNI`, `NOMBRE`, `EMAIL`,
`TELÉFONO` y `ACCIONES`. La tabla SHALL NOT mostrar `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA`
ni `ACCESO PLATAFORMA`: esos datos pertenecen a cada inscripción y se consultan en la ficha del
alumno y en la consulta de habilitación.

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
- **THEN** ve el bloque `Padrón de Alumnos Regulares` con la acción `+ Nuevo Alumno` y la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL`, `TELÉFONO` y `ACCIONES`

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

### Requirement: Habilitación de accesos y acciones excepcionales

The system SHALL mostrar el bloque `Buscador de Alumnos y Cuentas Corporativas` con un campo de búsqueda, el botón `Consultar Habilitación` y la ayuda `Buscá por DNI de alumno, Email institucional, CUIT de empresa o Razón Social.`; el bloque `Ficha Resumen del Alumno` con los campos `DNI / Documento`, `Nombre Completo` y `Email Registrado`; y **una sección por cada inscripción `ACTIVA`** del alumno, cada una con `Curso Inscrito`, `Categoría Arancelaria` y `Estado del Acceso`. `Estado del Acceso` SHALL mostrar una marca verde con `HABILITADO` y el texto `El alumno cumple con la condición arancelaria.`, o la variante roja `BLOQUEADO` que SHALL mostrar la causa del bloqueo junto al estado. Cuando el alumno no tiene inscripciones activas, la ficha SHALL mostrar un mensaje informativo en lugar de secciones.

La búsqueda SHALL resolverse contra el padrón por DNI, email o nombre y, cuando no encuentre un alumno, contra las cuentas corporativas por CUIT o razón social. Para una empresa, la ficha SHALL mostrar su CUIT como `DNI / Documento`, su razón social como `Nombre Completo`, `Sin email en el padrón de alumnos` como `Email Registrado` y `Contrato corporativo` como curso, sin secciones de inscripción. El campo `Último Pago Imputado` SHALL NOT mostrarse: es un dato del alumno y el pago se informa por inscripción en la ficha de la HU 61.

Debajo, el bloque `ACCIONES EXCEPCIONALES` SHALL renderizar la acción `Forzar Bloqueo Manual` acompañada de un campo `Motivo` obligatorio y de la identificación del usuario y de la fecha de la operación, más la acción de copia de correos habilitados de una comisión elegida.

La comisión sobre la que se copian los correos SHALL elegirse del catálogo real de comisiones y SHALL NOT ser un código fijo del maquetado; el rótulo de la acción SHALL reflejar la comisión elegida.

La aparición del campo `Motivo` es intencional: el prototipo ofrece el forzado de bloqueo con un botón y ningún campo para justificarlo, y la historia de usuario exige un motivo no vacío junto al usuario y la fecha de la operación. La acción de copia SHALL seguir la misma regla de negocio en todos los casos: copia únicamente los correos de los alumnos habilitados de la comisión elegida, y cuando esa comisión no tiene ningún alumno habilitado SHALL informar que no hay correos para copiar en lugar de copiar una lista vacía.

La emisión de certificados queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin pantalla detrás.

#### Scenario: El usuario busca a un alumno

- **WHEN** el usuario escribe un DNI, un email institucional, un CUIT o una razón social y pulsa `Consultar Habilitación`
- **THEN** ve la `Ficha Resumen del Alumno` con `DNI / Documento`, `Nombre Completo` y `Email Registrado`, y una sección por inscripción activa con su curso, categoría y estado

#### Scenario: La búsqueda devuelve una empresa

- **WHEN** el usuario escribe el CUIT o la razón social de una cuenta corporativa y pulsa `Consultar Habilitación`
- **THEN** la ficha muestra el CUIT como `DNI / Documento`, la razón social, `Contrato corporativo` como curso y ninguna sección de inscripción

#### Scenario: Alumno con dos inscripciones

- **WHEN** el alumno buscado tiene una inscripción particular y otra corporativa
- **THEN** la ficha muestra dos secciones, cada una con su curso, su categoría y su propio estado de acceso

#### Scenario: El acceso del alumno está bloqueado

- **WHEN** una sección de la ficha muestra el estado `BLOQUEADO`
- **THEN** la pantalla muestra el indicador rojo junto a la causa del bloqueo de esa inscripción, sin importar que el prototipo nunca muestre la causa

#### Scenario: El usuario consulta a Agustina Benítez

- **WHEN** el usuario busca a Agustina Benítez y pulsa `Consultar Habilitación`
- **THEN** ve `CUR-101` Python Inicial, categoría `Becado parcial 50%` y el estado `BLOQUEADO` con la causa `comprobante ilegible`

#### Scenario: Alumno sin inscripciones activas

- **WHEN** el alumno buscado no tiene ninguna inscripción activa
- **THEN** la ficha muestra sus datos personales y un mensaje informativo en lugar de secciones

#### Scenario: El usuario fuerza un bloqueo con motivo

- **WHEN** el usuario completa el `Motivo` y confirma
- **THEN** el estado forzado queda a la vista junto al usuario registrado y la fecha de la operación

#### Scenario: El usuario copia los correos habilitados de la comisión

- **WHEN** el usuario elige una comisión del catálogo real y pulsa la acción de copia de correos habilitados sobre una comisión que tiene alumnos habilitados y bloqueados
- **THEN** el maquetado copia solo los correos de los alumnos habilitados de esa comisión y no incluye los de los bloqueados

#### Scenario: La comisión no tiene alumnos habilitados

- **WHEN** el usuario elige una comisión y pulsa la copia de correos habilitados sobre una comisión sin ningún alumno habilitado
- **THEN** el maquetado informa que no hay correos para copiar

#### Scenario: El usuario fuerza un bloqueo sin motivo

- **WHEN** el usuario pulsa `Forzar Bloqueo Manual` con el campo `Motivo` vacío
- **THEN** el maquetado no confirma la operación e indica que el motivo es obligatorio

#### Scenario: El usuario busca la emisión de certificados

- **WHEN** el usuario busca la emisión de certificados
- **THEN** encuentra un ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

### Requirement: Acciones de edición, contraseña y baja en el padrón de alumnos

La pantalla `Alumnos e Inscripciones` SHALL ofrecer por cada fila las acciones **Editar**,
**Categoría**, **Restablecer contraseña** y **Eliminar alumno**, reutilizando los componentes
`Button`, `Modal` e `Input` existentes y sin cambiar colores, tipografías ni navegación. Las
operaciones SHALL pasar por `src/services/` y SHALL actualizar los datos visibles al terminar.

La acción **Categoría** SHALL operar sobre una inscripción, no sobre el alumno: WHEN el alumno
tiene una sola inscripción, SHALL abrir directo el formulario de categoría; WHEN tiene más de una,
SHALL pedir primero cuál, mostrando comisión, categoría y estado, incluidas las inscripciones no
activas. WHEN el alumno no tiene inscripciones, SHALL informar que primero hay que inscribirlo.

#### Scenario: Editar desde la fila

- **WHEN** el administrador elige **Editar**
- **THEN** se abre un modal con DNI, nombre, email y teléfono precargados y, al guardar, la fila muestra los datos actualizados

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
- **THEN** la fila desaparece del listado y la pantalla muestra un mensaje de confirmación

#### Scenario: Categoría de un alumno con una inscripción

- **WHEN** el administrador elige **Categoría** sobre un alumno con una sola inscripción
- **THEN** se abre el formulario de categoría de esa inscripción sin pedir una selección previa

#### Scenario: Categoría de un alumno con varias inscripciones

- **WHEN** el administrador elige **Categoría** sobre un alumno con dos inscripciones
- **THEN** la pantalla pide elegir la inscripción mostrando su comisión, categoría y estado, y el cambio se aplica solo a la elegida

#### Scenario: Categoría de un alumno sin inscripciones

- **WHEN** el administrador elige **Categoría** sobre un alumno sin ninguna inscripción
- **THEN** la pantalla informa que primero hay que inscribirlo y no abre el formulario

#### Scenario: Aviso de reactivación al intentar un alta duplicada

- **WHEN** el alta de un alumno choca con un DNI o email de un alumno dado de baja
- **THEN** la pantalla muestra un modal que indica que el alumno fue dado de baja antes y ofrece **Reactivar alumno**

#### Scenario: Reactivación confirmada desde el modal

- **WHEN** el administrador confirma **Reactivar alumno**
- **THEN** el alumno vuelve al listado de activos y la pantalla muestra las nuevas credenciales iniciales

#### Scenario: Reactivación cancelada desde el modal

- **WHEN** el administrador cancela el aviso de reactivación
- **THEN** no se modifica ningún dato y el formulario de alta conserva lo cargado

## ADDED Requirements

### Requirement: Alta de inscripción con categoría arancelaria

El modal de inscripción de la pantalla de Comisiones SHALL pedir alumno, comisión y categoría
arancelaria. WHEN la categoría sea beca parcial, SHALL pedir un porcentaje entero entre 1 y 99.
WHEN sea corporativo, SHALL pedir una empresa del padrón y SHALL ofrecer `+ Nueva Empresa` para
darla de alta sin perder lo cargado. La pantalla SHALL validar antes de enviar y SHALL mostrar bajo
el campo correspondiente el motivo que devuelva la fuente cuando el alta se rechace.

#### Scenario: Inscripción particular

- **WHEN** el administrador elige alumno, comisión y categoría particular y guarda
- **THEN** la inscripción se crea con esa categoría y la vacante de la comisión baja en uno

#### Scenario: Inscripción de beca parcial

- **WHEN** el administrador elige beca parcial e informa un porcentaje entre 1 y 99
- **THEN** la inscripción se crea con la categoría y el porcentaje

#### Scenario: Porcentaje faltante o inválido

- **WHEN** el administrador elige beca parcial y deja el porcentaje vacío, fuera de 1 a 99 o con decimales
- **THEN** el formulario no envía y muestra el error en el campo del porcentaje

#### Scenario: Inscripción corporativa

- **WHEN** el administrador elige corporativo y selecciona una empresa del padrón
- **THEN** la inscripción se crea con la categoría corporativa y la empresa elegida

#### Scenario: Corporativo sin empresa

- **WHEN** el administrador elige corporativo y guarda sin elegir empresa
- **THEN** el formulario no envía e indica que hay que seleccionar la empresa

#### Scenario: Alta rápida de empresa

- **WHEN** el administrador pulsa `+ Nueva Empresa` desde el modal de inscripción y completa el alta
- **THEN** la empresa queda seleccionada en el formulario de inscripción, que conserva alumno, comisión y categoría

#### Scenario: La comisión está completa

- **WHEN** la fuente rechaza el alta porque la comisión alcanzó su cupo
- **THEN** el modal sigue abierto con lo cargado y muestra el motivo que devuelve la fuente

### Requirement: Identificación de la inscripción al imputar un pago

El selector de inscripción de la pantalla de Cobranzas SHALL mostrar, por cada inscripción, la
comisión, la categoría arancelaria y el estado, además del curso. WHEN el alumno tiene una sola
inscripción activa, la pantalla SHALL seleccionarla sola, como hasta ahora.

#### Scenario: Alumno con dos inscripciones

- **WHEN** el administrador elige un alumno con una inscripción corporativa y otra particular
- **THEN** el selector muestra las dos, cada una con su comisión, su categoría y su estado, y el pago se imputa a la elegida

#### Scenario: La imputación no se mezcla

- **WHEN** el administrador imputa un pago a una de las inscripciones
- **THEN** la otra inscripción queda sin imputación y su estado de acceso no cambia
