# Spec Delta

## Purpose

Definir el shell del docente de TechAcademy BA como maqueta navegable: su navegación, el detalle de la única comisión que el cliente tiene asignada con su padrón de alumnos, la carga del link de la clase, la asistencia y su perfil, apoyadas en datos de ejemplo de docentes y alumnos y dejando fuera de alcance las notas y la certificación.

## ADDED Requirements

### Requirement: Estructura y navegación del shell del docente

The system SHALL renderizar el shell del docente con un panel lateral titulado `ESPACIO DOCENTE`, una barra superior con el chip `Rol Docente · Solo mis comisiones` y el texto `Período Lectivo 2026`, y un pie con el avatar `PM`, el nombre `Profe Martín` y el rol `DOCENTE`. El shell SHALL usar un color de acento verde azulado distinguible del shell de Administración. La interfaz SHALL estar escrita en español rioplatense y SHALL ofrecer los ítems de navegación en este orden: `Mis Comisiones`, `Mis Alumnos`, `Asistencia`, `Notas y Certificación` deshabilitado y `Mi Perfil`. El período lectivo SHALL renderizarse como `Período Lectivo 2026` en las tres pantallas de shell, aunque el prototipo muestre `Periodo Lectivo 2025`: es una corrección intencional de la línea temporal del proyecto.

#### Scenario: El docente abre su espacio
- **WHEN** un usuario con rol docente se autentica y abre una pantalla de su shell
- **THEN** ve el panel `ESPACIO DOCENTE`, la barra superior con `Rol Docente · Solo mis comisiones` y `Período Lectivo 2026`, y el pie con `PM`, `Profe Martín` y `DOCENTE`

#### Scenario: El docente recorre la navegación
- **WHEN** el docente abre el panel lateral
- **THEN** los ítems aparecen en el orden `Mis Comisiones`, `Mis Alumnos`, `Asistencia`, `Notas y Certificación` y `Mi Perfil`, y los primeros tres más el último abren su pantalla

#### Scenario: El docente elige una comisión desde sus cursos
- **WHEN** el docente elige `Mis Alumnos` y después una comisión de las que tiene asignadas
- **THEN** abre el detalle de esa comisión con su padrón de alumnos

### Requirement: Listado de comisiones asignadas

The system SHALL mostrar cuatro tarjetas de indicador con los rótulos y valores literales `COMISIONES ACTIVAS` 1, `ALUMNOS HABILITADOS` 1, `BLOQUEADOS` 1 y `PRÓXIMA CLASE` con el valor `Hoy · 19:00`. SHALL mostrar el bloque `Comisiones asignadas` con una fila por comisión: `CUR-101` Python Inicial con Profe Martín, `Mar y Jue · 19 a 21 hs`, próxima clase `Hoy · 19:00`, 1 habilitado y 1 bloqueado. El docente del maquetado tiene exactamente una comisión asignada en los datos del cliente, por lo que el maquetado SHALL NOT inventar comisiones adicionales para completar el bloque.

Los contadores SHALL renderizarse como chip verde para los habilitados y chip rojo para los bloqueados, y la forma singular o plural SHALL coincidir con la cantidad. El encabezado que el prototipo titula `RESTRICCIONES` SHALL renombrarse `ACCESO`, porque sus celdas contienen conteos de acceso y no restricciones. Este renombrado es una corrección intencional de una inconsistencia del prototipo.

#### Scenario: El docente abre sus comisiones
- **WHEN** el docente abre `Mis Comisiones`
- **THEN** ve las tarjetas `COMISIONES ACTIVAS` 1, `ALUMNOS HABILITADOS` 1, `BLOQUEADOS` 1 y `PRÓXIMA CLASE` con `Hoy · 19:00`, y el bloque `Comisiones asignadas` con una sola fila, `CUR-101` Python Inicial

#### Scenario: El docente compara los contadores de acceso
- **WHEN** el docente recorre los contadores de cada comisión
- **THEN** los habilitados aparecen en chip verde y los bloqueados en chip rojo, y las etiquetas usan singular o plural según la cantidad, por ejemplo `1 bloqueado` frente a `4 bloqueados`

#### Scenario: El docente cruza los indicadores con su única comisión
- **WHEN** el docente compara `COMISIONES ACTIVAS` con el contenido del bloque `Comisiones asignadas`
- **THEN** ve una sola comisión, `CUR-101`, y los indicadores `1` habilitado y `1` bloqueado coinciden con el padrón de esa comisión

#### Scenario: El docente busca la columna de restricciones
- **WHEN** el docente lee los encabezados de la tabla de comisiones
- **THEN** la columna de conteos se titula `ACCESO` y no `RESTRICCIONES`

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

The system SHALL mostrar una tarjeta de identidad con el avatar `PM`, el nombre `Profe Martín`, el chip `DOCENTE · PERMISOS REDUCIDOS` y la nota `Los cambios administrativos deben solicitarse a Secretaría BA.`; y un bloque de datos de contacto en modo de solo lectura que, además del nombre, muestre únicamente `Especialidad` con el valor `Programación` y `Sede de referencia` con el valor `Sede Constituciones`. El bloque de contacto SHALL NOT mostrar correo institucional ni teléfono, porque la fuente del cliente no los registra para los docentes y no deben inventarse.

The system SHALL mostrar el bloque `Comisiones asignadas` con las columnas `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`, con la fila `CUR-101`, Python Inicial, `Mar y Jue · 19 a 21 hs` y estado `Activa` renderizado en verde. La pantalla SHALL ser completamente de solo lectura: el sistema SHALL NOT renderizar botones de guardado ni campos editables.

#### Scenario: El docente abre su perfil
- **WHEN** el docente abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con `PM`, `Profe Martín`, el chip `DOCENTE · PERMISOS REDUCIDOS` y la nota `Los cambios administrativos deben solicitarse a Secretaría BA.`

#### Scenario: El docente revisa sus datos de contacto
- **WHEN** el docente baja al bloque de datos de contacto
- **THEN** ve `Especialidad` con `Programación` y `Sede de referencia` con `Sede Constituciones`, y no encuentra correo ni teléfono

#### Scenario: El docente revisa sus comisiones
- **WHEN** el docente baja al bloque `Comisiones asignadas`
- **THEN** ve las columnas `CÓDIGO`, `CURSO`, `HORARIO` y `ESTADO`, con la fila `CUR-101` / Python Inicial / `Mar y Jue · 19 a 21 hs` y el estado `Activa` en verde

#### Scenario: El docente intenta editar su perfil
- **WHEN** el docente intenta modificar un dato de contacto
- **THEN** la pantalla no ofrece campos editables ni botón de guardado, y los datos se muestran solo como lectura

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
