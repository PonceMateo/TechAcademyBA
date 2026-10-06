# Spec Delta

## MODIFIED Requirements

### Requirement: Comisiones activas y alta de comisión

The system SHALL mostrar el bloque `Comisiones Activas` con el chip `10 en el catálogo` y las acciones `+ Nueva Comisión` y `+ Nuevo Curso`, seguido de una tabla cuyas columnas, con estos rótulos literales y en este orden, son `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`, `HORARIO`, `CUPO MÁX.`, `VACANTES` y `ARANCEL`. Las filas del maquetado son, en este orden: `CUR-101` Python Inicial con Profe Martín, `Mar y Jue 19 a 21 hs`, cupo 30, 7 vacantes y arancel `$45.000`; `CUR-104` Diseño UX/UI Avanzado con Caro UX, `Miércoles 19 a 22`, cupo 20, 0 vacantes y `$52.000`; `CUR-108` Java Backend Spring con Ing. González, `Sábados intensivo`, cupo 30, 30 vacantes y `$58.000`; `CUR-110` Power BI & Dashboards con Mariana Data, `Mar y Jue 18:30`, cupo 40, 40 vacantes y `$39.000`; y `CUR-103` Marketing Digital & Ads con Santi Ads, `Sábados 10 a 13 hs`, cupo 40, 40 vacantes y `$38.000`.

La columna `VACANTES` SHALL mostrar el conteo de vacantes que el cliente registra para cada comisión, y cuando valga 0 la fila SHALL llevar el chip `LLENO` en rojo junto al valor. La fila de `CUR-104` es la única del maquetado con 0 vacantes, porque el cliente la registra con estado `Cerrada por cupo`. El maquetado SHALL NOT inventar comisiones adicionales para completar el catálogo: las cinco filas son un subconjunto de las diez comisiones del cliente.

The system SHALL abrir el modal `Crear Nueva Comisión` con los campos, en este orden literal: `Curso / Programa` como selección, `Docente Asignado` como selección, `Días y Horarios` con placeholder `Ej: Mar y Jue 19 a 21 hs`, `Cupo Máximo`, `Valor de Arancel de Comisión (AR$)`, `Modalidad` y `Sede`, con los botones `Cancelar` y `Guardar Comisión`. El modal SHALL NOT pedir un código de comisión: el código lo deriva el sistema del curso y del número, y la pantalla lo muestra al confirmar. `Docente Asignado` SHALL ser una selección de los docentes del padrón y SHALL NOT ser un campo de búsqueda de texto libre. `Modalidad` SHALL ofrecer `Virtual`, `Presencial` y `Híbrido`, y `Sede` SHALL ser obligatoria solo cuando la modalidad seleccionada sea `Presencial` o `Híbrido`.

La pantalla SHALL abrir además el modal `Crear Nuevo Curso`, con los campos `Nombre del Curso` y `Descripción` y sin ningún campo de código. La adición de la modal de curso es intencional: sin ella el catálogo no tiene forma de crecer, y el selector de curso de la comisión se armaba con las comisiones existentes, así que un curso nuevo no podía abrir su primera comisión.

Esta pantalla SHALL confirmar sus altas contra la base: un alta aceptada SHALL mostrar el código que devuelve el sistema, un alta rechazada SHALL dejar el formulario abierto con el motivo tal como lo informa la fuente, y un alta que no llega a la base SHALL fallar sin mostrar ninguna confirmación.

Este cambio no incluye edición: el sistema SHALL NOT renderizar ningún control de edición de curso ni de comisión.

#### Scenario: El usuario revisa el listado de comisiones
- **WHEN** un usuario de Secretaría abre `Cursos y Comisiones`
- **THEN** ve el chip `10 en el catálogo`, las acciones `+ Nueva Comisión` y `+ Nuevo Curso` y la tabla con las columnas `CÓDIGO`, `CURSO / PROGRAMA`, `DOCENTE`, `HORARIO`, `CUPO MÁX.`, `VACANTES` y `ARANCEL` en ese orden, con las cinco comisiones del maquetado

#### Scenario: El usuario busca la comisión cerrada por cupo
- **WHEN** el usuario mira la fila de `CUR-104` Diseño UX/UI Avanzado
- **THEN** ve `VACANTES` con valor 0 y el chip `LLENO` en rojo junto a la fila

#### Scenario: El usuario compara las vacantes con el cupo
- **WHEN** el usuario recorre la columna `VACANTES` del maquetado
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
