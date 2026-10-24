# Spec Delta

## MODIFIED Requirements

### Requirement: Padrón de docentes

The system SHALL mostrar la pantalla `Docentes` con un listado cuyas columnas, en este orden literal, son `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS`, `ESTADO` y `ACCIONES`, con un campo de búsqueda por nombre, apellido, DNI o email, y la acción `+ Nuevo Docente`. La columna `CUIL` SHALL mostrar el dato cuando el docente lo tenga y SHALL NOT exigirlo: el CUIL es único pero opcional en el modelo, y un docente sin CUIL es una fila válida. Las filas del maquetado son, en este orden: Profe Martín con `Programación`, 1 comisión asignada y estado `Activa`; Lic. Laura Benítez con `Desarrollo Web`, 1 comisión asignada y `Activa`; Santi Ads con `Marketing`, 2 comisiones asignadas y `Activa`; Dr. Marcelo Ríos con `Datos`, 1 comisión asignada y `Activa`; e Ing. González con `Programación`, 1 comisión asignada y `Activa`. La columna `ESTADO` SHALL renderizar `Activa` en verde. El maquetado SHALL NOT mostrar columnas de documento, correo ni teléfono de los docentes, porque los datos del cliente no registran esos datos y no deben inventarse.

Esta pantalla es una adición intencional: el prototipo no la incluye y el alta de docente está dentro del alcance mínimo. La acción `+ Nuevo Docente` SHALL abrir el modal `Nuevo Docente`, con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y `Teléfono`, y sin ningún campo de CUIL porque el contrato del alta no lo admite.

La columna `ACCIONES` SHALL mostrar los botones `Editar` y `Restablecer contraseña` en cada fila. El
sistema SHALL abrir el modal `Editar Docente` con los campos `Nombre`, `Apellido`, `DNI`, `Mail` y
`Teléfono` precargados con los valores actuales y sin ningún campo de CUIL, con los botones `Cancelar`
y `Guardar Cambios`. Un guardado aceptado SHALL actualizar la fila y mostrar una confirmación; un
rechazo SHALL dejar el modal abierto con el motivo que informa la fuente.

El sistema SHALL abrir además el modal `Restablecer contraseña` con los campos de contraseña nueva y
confirmación, y SHALL avisar que el docente deberá cambiarla en su próximo ingreso. WHEN las dos
contraseñas no coincidan o la nueva tenga menos de 8 caracteres, la pantalla SHALL rechazar el envío
sin llamar a la fuente. Un restablecimiento aceptado SHALL cerrar el modal y confirmar la operación.

El control de clases dictadas por el profesor queda fuera del alcance mínimo: la pantalla SHALL mostrar un ítem deshabilitado con la etiqueta `Próximamente` y sin ninguna pantalla detrás.

#### Scenario: El usuario abre el padrón de docentes
- **WHEN** un usuario de Secretaría abre `Docentes`
- **THEN** ve el listado con las columnas `DOCENTE`, `DNI`, `CUIL`, `EMAIL`, `TELÉFONO`, `CÁTEDRA O ESPECIALIDAD`, `COMISIONES ASIGNADAS`, `ESTADO` y `ACCIONES`, los cinco docentes del maquetado, sus datos de contacto, sus especialidades, sus comisiones asignadas y el estado `Activa` en verde, más la acción `+ Nuevo Docente`

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
- **THEN** la acción `+ Nuevo Docente` abre el formulario de alta real, la columna `ACCIONES` ofrece `Editar` y `Restablecer contraseña`, y el control de clases dictadas aparece como ítem deshabilitado con la etiqueta `Próximamente` que no abre ninguna pantalla

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
