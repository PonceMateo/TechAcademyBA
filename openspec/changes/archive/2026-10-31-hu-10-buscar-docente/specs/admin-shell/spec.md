# Spec Delta

## MODIFIED Requirements

### Requirement: Padrón de docentes

The system SHALL mostrar la pantalla `Docentes` con un listado cuyas columnas, en este orden
literal, son `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`,
`COMISIONES ASIGNADAS` y `ESTADO`, con un campo de búsqueda por nombre, apellido, DNI o email, y
la acción `+ Nuevo Docente`. La columna `CUIL` SHALL mostrar el dato cuando el docente lo tenga y
SHALL NOT exigirlo: el CUIL es único pero opcional en el modelo, y un docente sin CUIL es una fila
válida. Las filas del maquetado son, en este orden: Profe Martín con `Programación` y estado
`Activa`; Lic. Laura Benítez con `Desarrollo Web` y `Activa`; Santi Ads con `Marketing` y
`Activa`; Dr. Marcelo Ríos con `Datos` y `Activa`; e Ing. González con `Programación` y `Activa`.
La columna `ESTADO` SHALL renderizar `Activa` en verde.

El campo de búsqueda SHALL filtrar automáticamente mientras el administrador escribe, sin exigir
que presione `Enter`, y SHALL aceptar coincidencias por el comienzo de las palabras del nombre o
del apellido, respetando el orden de las palabras de la consulta. La comparación SHALL ignorar
mayúsculas, minúsculas y tildes, y el DNI SHALL poder informarse con o sin puntos, espacios o
guiones, con coincidencia desde el inicio de sus dígitos. El email SHALL admitir un fragmento
desde el inicio de su valor. Una búsqueda de una sola letra SHALL
mostrar solo a los docentes cuyo nombre o apellido tiene una palabra que empieza con esa letra, y
SHALL NOT mostrar a los que solo la contienen en el medio. Una sola letra SHALL disparar la
consulta: no hay mínimo de caracteres. La pantalla SHALL ordenar los resultados por campo —nombre,
después DNI y al final email— y, dentro del nombre, por la posición de la primera palabra que
coincide, priorizando el inicio del nombre sobre las palabras posteriores o el apellido. La
pantalla SHALL esperar aproximadamente 300 ms desde la última tecla antes de consultar a la fuente
y SHALL descartar la respuesta de cualquier consulta anterior que llegue después de una más
reciente. WHEN el campo queda vacío, la pantalla SHALL volver al listado habitual de docentes
activos.

La columna `COMISIONES ASIGNADAS` SHALL mostrar las comisiones que devuelve la fuente para el
docente, con el código y el nombre del curso de cada una. WHEN el docente no tiene comisiones,
SHALL mostrar `Sin comisión`. WHEN la búsqueda no tiene coincidencias, la pantalla SHALL mostrar
`No se encontraron docentes`. La pantalla SHALL NOT inventar comisiones ni datos personales para
completar una fila.

La pantalla SHALL mostrar solo docentes activos. Los docentes dados de baja SHALL NOT aparecer en
el listado ni en los resultados de búsqueda.

La acción `+ Nuevo Docente` SHALL abrir el modal `Nuevo Docente`, con los campos `Nombre`,
`Apellido`, `DNI`, `Mail` y `Teléfono`, y sin ningún campo de CUIL porque el contrato del alta no
lo admite. El sistema SHALL NOT renderizar un formulario de edición de docente. El control de
clases dictadas por el profesor queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem
deshabilitado con la etiqueta `Próximamente` y sin ninguna pantalla detrás. Estos comportamientos
del alta y del control deshabilitado SHALL conservarse sin cambios.

#### Scenario: El usuario abre el padrón de docentes

- **WHEN** un usuario de Secretaría abre `Docentes`
- **THEN** ve el listado con las columnas `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS` y `ESTADO`, los docentes activos que devuelve la fuente, sus datos de contacto, sus comisiones asignadas y el estado `Activa` en verde, más la acción `+ Nuevo Docente`

#### Scenario: El usuario localiza a un docente por CUIL

- **WHEN** el usuario recorre la fila de un docente
- **THEN** ve su CUIL visible junto al DNI cuando el docente lo tiene, y la fila no lo exige porque el CUIL es único pero opcional en el modelo, así que un docente cargado sin ese dato sigue siendo una fila válida del padrón

#### Scenario: El usuario compara las cargas de los docentes

- **WHEN** el usuario recorre la columna `COMISIONES ASIGNADAS`
- **THEN** ve que Santi Ads tiene 2 comisiones asignadas y los otros cuatro docentes tienen 1 cada uno

#### Scenario: El usuario busca un docente

- **WHEN** el usuario escribe un nombre en el buscador
- **THEN** el listado del maquetado se filtra por ese texto

#### Scenario: El usuario busca mientras escribe

- **WHEN** el usuario escribe `perez` en el buscador y no presiona `Enter`
- **THEN** después de la pausa de 300 ms la pantalla consulta a la fuente y muestra los docentes cuyo nombre o apellido tiene una palabra que empieza con ese texto, sin distinguir mayúsculas ni tildes

#### Scenario: El usuario busca una sola letra

- **WHEN** el usuario escribe `a` en el buscador
- **THEN** la pantalla consulta a la fuente con una sola letra, sin exigir un mínimo de caracteres, y muestra solo los docentes cuyo nombre o apellido tiene una palabra que empieza con `a`, y no a los que solo contienen esa letra en el medio de una palabra

#### Scenario: La coincidencia en el nombre se muestra primero

- **WHEN** el usuario busca `al` y existen `Rita Alonso` y `Alfonso Pérez`
- **THEN** la pantalla muestra primero a `Alfonso Pérez`, porque la coincidencia está al inicio de la primera palabra de su nombre

#### Scenario: El usuario respeta el orden de las palabras

- **WHEN** el usuario escribe `ana gom`
- **THEN** la pantalla muestra a `Ana Gómez`; WHEN escribe `gom ana` SHALL NOT mostrarlo

#### Scenario: El usuario busca un DNI con separadores

- **WHEN** el usuario escribe `30.111.222` o `30111` en el buscador
- **THEN** la pantalla muestra el docente cuyo DNI empieza con esos dígitos, con o sin separadores y aunque el número esté incompleto

#### Scenario: El usuario vacía el buscador

- **WHEN** el usuario borra todo el texto del buscador
- **THEN** la pantalla vuelve a mostrar el listado habitual de docentes activos

#### Scenario: La búsqueda no arroja resultados

- **WHEN** el usuario busca un dato que no coincide con ningún docente activo
- **THEN** la pantalla muestra `No se encontraron docentes`

#### Scenario: El usuario recorre las comisiones asignadas

- **WHEN** el usuario recorre la columna `COMISIONES ASIGNADAS`
- **THEN** ve el código y el nombre del curso de cada comisión del docente, o `Sin comisión` cuando no tiene ninguna

#### Scenario: Llega una respuesta vieja

- **WHEN** una consulta anterior termina después de una consulta más reciente
- **THEN** la pantalla conserva los resultados de la consulta más reciente y descarta la respuesta vieja

#### Scenario: El usuario busca un docente dado de baja

- **WHEN** el usuario busca por el nombre, DNI o email de un docente con `activo = false`
- **THEN** la pantalla no lo muestra, porque el padrón visible solo incluye docentes activos

#### Scenario: El usuario abre el alta de docente

- **WHEN** el usuario pulsa `+ Nuevo Docente`
- **THEN** se abre el modal `Nuevo Docente` con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y `Teléfono`, sin CUIL, con la misma identidad visual y sin cambios en el alta

#### Scenario: El usuario busca edición o control de clases

- **WHEN** el usuario revisa la pantalla buscando editar a un docente o controlar las clases que dicta
- **THEN** la acción `+ Nuevo Docente` abre el formulario de alta real, no hay control de edición, y el control de clases dictadas aparece como ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

#### Scenario: El usuario edita los datos de un docente

- **WHEN** el usuario pulsa `Editar`, cambia nombre, apellido, DNI, mail o teléfono y guarda
- **THEN** el modal se cierra, la fila muestra los nuevos datos y la pantalla confirma que el docente se actualizó

#### Scenario: El usuario edita con un DNI o mail duplicado

- **WHEN** el usuario intenta guardar un DNI o un mail que ya pertenece a otro registro
- **THEN** el modal queda abierto, muestra el motivo que devuelve la fuente y la fila conserva sus datos anteriores

#### Scenario: El usuario restablece la contraseña de un docente

- **WHEN** el usuario pulsa `Restablecer contraseña`, define una contraseña válida y confirma
- **THEN** el modal se cierra y la pantalla informa que el docente deberá cambiarla en su próximo ingreso

#### Scenario: Las contraseñas no coinciden

- **WHEN** el usuario escribe dos contraseñas distintas en el modal de restablecimiento
- **THEN** la pantalla no envía la operación y muestra que las contraseñas no coinciden

#### Scenario: El modal de edición no pide CUIL

- **WHEN** el usuario abre `Editar Docente`
- **THEN** ve nombre, apellido, DNI, mail y teléfono, y no ve ningún campo de CUIL
