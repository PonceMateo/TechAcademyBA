# student-shell Specification

## Purpose

Definir el shell del alumno de TechAcademy BA como maqueta navegable: su curso inscripto, el detalle de esa cursada con su estado de acceso, su historial de pagos y su perfil, apoyados en datos de ejemplo del alumno y de su inscripción y dejando la historia de pago en línea y los certificados fuera de alcance.

## Requirements

### Requirement: Estructura y navegación del shell del alumno

The system SHALL renderizar el shell del alumno con un panel lateral titulado `ESPACIO ALUMNO`, una barra superior con el chip `Rol Alumno · Solo mi información` y el texto `Período Lectivo 2026`, y un pie con el avatar `CR`, el nombre `Camila Rodríguez` y el rol `ALUMNO`. El shell SHALL usar un color de acento terracota distinguible de los shells de Administración y Docente. La interfaz SHALL estar escrita en español rioplatense y SHALL ofrecer los ítems de navegación en este orden: `Mis Cursos`, `Mis Pagos`, `Pagar la cuota` deshabilitado, `Certificados` deshabilitado y `Mi Perfil`. El período lectivo SHALL renderizarse como `Período Lectivo 2026` en las tres pantallas de shell, aunque el prototipo muestre `Periodo Lectivo 2025`: es una corrección intencional de la línea temporal del proyecto.

#### Scenario: El alumno abre su espacio
- **WHEN** un usuario con rol alumno se autentica y abre una pantalla de su shell
- **THEN** ve el panel `ESPACIO ALUMNO`, la barra superior con `Rol Alumno · Solo mi información` y `Período Lectivo 2026`, y el pie con `CR`, `Camila Rodríguez` y `ALUMNO`

#### Scenario: El alumno recorre la navegación
- **WHEN** el alumno abre el panel lateral
- **THEN** los ítems aparecen en el orden `Mis Cursos`, `Mis Pagos`, `Pagar la cuota`, `Certificados` y `Mi Perfil`, y solo `Mis Cursos`, `Mis Pagos` y `Mi Perfil` abren pantalla

#### Scenario: El alumno intenta pagar la cuota
- **WHEN** el alumno pulsa `Pagar la cuota`
- **THEN** el ítem permanece deshabilitado con la etiqueta `Próximamente` y no abre ninguna pantalla, porque el pago en línea desde la plataforma queda fuera del alcance mínimo y el prototipo no muestra ningún botón de pago que deshabilitar

### Requirement: Cursos del alumno

The system SHALL mostrar una tarjeta por comisión inscripta con el chip del código de comisión, un chip de estado, el título del curso, la línea `Docente ·` seguida del nombre del docente, el horario de la comisión, la categoría arancelaria, un banner de acceso grande con `Habilitado` en verde o `Bloqueado` en rojo, y un botón `Ver detalle`. El maquetado tiene una sola inscripción en los datos del cliente, por lo que muestra una sola tarjeta: `CUR-102` Desarrollo Web Full Stack, `Docente · Lic. Laura Benítez`, `Lun y Miér · 18:30 a 21:30`, categoría `Becado parcial 50%`, banner `Habilitado` en verde y botón `Ver detalle`. El maquetado SHALL NOT agregar una segunda tarjeta para ilustrar el estado bloqueado, porque eso sería inventar una inscripción que el cliente no tiene.

El estado bloqueado SHALL especificarse como un estado del componente de banner y no como una tarjeta adicional: cuando la inscripción del alumno no tenga un pago acreditado, esa misma tarjeta SHALL renderizarse con el banner `Bloqueado` en rojo, SHALL mostrar la causa del bloqueo y SHALL ofrecer una forma de ir a `Mis Pagos`. Esta adición es intencional: el prototipo no muestra ni la causa ni ninguna acción ante el bloqueo, y la historia de usuario que exige ver la causa está dentro del alcance. Un alumno sin inscripciones SHALL ver un mensaje informativo de que no tiene cursos activos.

#### Scenario: El alumno abre sus cursos
- **WHEN** el alumno abre `Mis Cursos`
- **THEN** ve una sola tarjeta con `CUR-102`, el chip de estado, el título Desarrollo Web Full Stack, `Docente · Lic. Laura Benítez`, `Lun y Miér · 18:30 a 21:30`, la categoría `Becado parcial 50%`, el banner `Habilitado` en verde y el botón `Ver detalle`

#### Scenario: El alumno tiene un pago sin acreditar
- **WHEN** la inscripción del alumno no tiene ningún pago acreditado
- **THEN** la misma tarjeta de `CUR-102` se renderiza con el banner `Bloqueado` en rojo, con la causa del bloqueo y con una forma de ir a `Mis Pagos`

#### Scenario: El usuario revisa el catálogo de comisiones
- **WHEN** el usuario recorre el listado de comisiones del shell de Administración
- **THEN** no encuentra una segunda tarjeta de curso en el shell del alumno que no corresponda a una inscripción registrada en los datos del cliente

#### Scenario: El alumno no tiene inscripciones
- **WHEN** el alumno no tiene ninguna inscripción
- **THEN** ve un mensaje informativo de que no tiene cursos activos, en lugar de una lista vacía sin explicación

### Requirement: Detalle de curso y acceso a la clase

The system SHALL mostrar el detalle `Desarrollo Web Full Stack · CUR-102` con el bloque `Información de la comisión` que incluye `Docente · Lic. Laura Benítez`, `Lunes y miércoles · 18:30 a 21:30` y el chip `Categoría: Becado parcial 50%`; y con el bloque de acceso, que SHALL cubrir tres estados: con el alumno habilitado y el link de la clase ya cargado, el chip `HABILITADO` en verde, el texto `Tu acceso a la clase está habilitado.` y el botón `Ingresar a la clase por Zoom`; con el alumno habilitado y el link todavía no cargado, el mismo chip y el mismo texto con un mensaje informativo de que el profesor todavía no publicó el link y sin botón de ingreso; y con el alumno bloqueado, ningún link ni botón de ingreso y solo el estado de bloqueo con su causa.

El detalle SHALL mostrar un bloque `Cronograma` con la fecha de inicio y de fin de la cursada, y un bloque `Próximos encuentros` con una fila por clase upcoming, cada una con fecha y tema. Ambos bloques son contenido de referencia del maquetado: sus valores son de ejemplo y serán reemplazados por los reales cuando la secretaría cargue el cronograma de cada comisión.

#### Scenario: El alumno está habilitado con link cargado
- **WHEN** el alumno está habilitado y el profesor ya cargó el link de la clase
- **THEN** ve el chip `HABILITADO` en verde, el texto `Tu acceso a la clase está habilitado.` y el botón `Ingresar a la clase por Zoom`

#### Scenario: El alumno está habilitado sin link cargado
- **WHEN** el alumno está habilitado y el profesor todavía no cargó el link de la clase
- **THEN** ve el chip `HABILITADO` y un mensaje informativo de que el link todavía no está disponible, sin botón de ingreso a la clase

#### Scenario: El alumno está bloqueado
- **WHEN** el alumno está bloqueado
- **THEN** no ve ningún link ni botón de ingreso y solo ve su estado de bloqueo con la causa

#### Scenario: El alumno revisa la información de la comisión
- **WHEN** el alumno abre el detalle de su curso
- **THEN** ve `Docente · Lic. Laura Benítez`, `Lunes y miércoles · 18:30 a 21:30` y el chip `Categoría: Becado parcial 50%`

#### Scenario: El alumno consulta el cronograma de la cursada
- **WHEN** el alumno revisa el detalle de su curso
- **THEN** ve el bloque `Cronograma` con el período de cursada y el bloque `Próximos encuentros` con las clases venideras, cada una con su fecha y su tema

#### Scenario: El alumno reconoce que los datos son de referencia
- **WHEN** el alumno ve el cronograma y los próximos encuentros antes de que la secretaría cargue los datos reales de esa comisión
- **THEN** el contenido tiene forma de fecha y tema pero es material de referencia del maquetado, no el cronograma definitivo del curso

### Requirement: Historial y carga de comprobantes

The system SHALL mostrar el bloque `Historial de comprobantes` con una fila por comprobante que incluye fecha, importe, medio de pago y estado, y SHALL mostrar el bloque `Cargar comprobante` con los campos `Curso`, `Importe`, `Medio de pago`, un área de adjuntos rotulada `Adjuntar comprobante` y el campo opcional `Pagado por (opcional)`, más el botón `Enviar para validación`. Los estados SHALL renderizarse como `Acreditado` en verde, `Observado` en ámbar y `Rechazado` en rojo.

El historial del maquetado muestra solo los comprobantes imputados al propio alumno, por lo que la única fila es la del 11/05/2026 por `$31.000`, medio `Transferencia`, estado `Acreditado` en verde. La lista SHALL NOT incluir pagos de empresas ni cheques corporativos que no están imputados al alumno. Cuando el pago lo realizó un tercero, la fila SHALL indicarlo de forma explícita junto al importe, porque en este dominio el pagador puede no ser el alumno; en el maquetado esa condición no se activa en ninguna fila porque el comprobante acreditado lo pagó la propia alumna. Un alumno sin pagos SHALL ver un mensaje informativo de que no hay pagos registrados.

#### Scenario: El alumno revisa su historial
- **WHEN** el alumno abre `Mis Pagos`
- **THEN** ve el `Historial de comprobantes` con una única fila del 11/05/2026 por `$31.000`, medio `Transferencia` y estado `Acreditado` en verde

#### Scenario: El alumno revisa el importe de su beca
- **WHEN** el alumno compara el importe acreditado con el arancel de la comisión
- **THEN** ve que la mitad del arancel de `$62.000` está cubierta por su beca parcial del 50%, y la pantalla no muestra ningún cálculo derivado que no esté en los datos del cliente

#### Scenario: El comprobante lo pagó un tercero
- **WHEN** el alumno revisa un comprobante cuyo pago realizó otra persona
- **THEN** la fila indica que el pago lo realizó un tercero, sin dejar de ser un comprobante propio del alumno

#### Scenario: El alumno no ve pagos de terceros
- **WHEN** el alumno revisa su historial buscando pagos de empresas o cheques corporativos
- **THEN** no los encuentra, porque la pantalla muestra únicamente los comprobantes imputados al propio alumno

#### Scenario: El alumno no tiene pagos
- **WHEN** el alumno no tiene ningún comprobante
- **THEN** ve un mensaje informativo de que no hay pagos registrados

#### Scenario: El alumno envía un comprobante
- **WHEN** el alumno completa `Curso` e `Importe`, elige `Medio de pago`, adjunta el archivo y pulsa `Enviar para validación`
- **THEN** el maquetado confirma la recepción del envío y no modifica el estado de habilitación del alumno

### Requirement: Certificados fuera de alcance

The system SHALL representar `Certificados` únicamente como un ítem de navegación deshabilitado con la etiqueta `Próximamente` y sin pantalla detrás. El contenido del prototipo, es decir la pantalla de certificados con el botón `Descargar certificado` y el botón atenuado `Descarga no disponible`, SHALL NOT reproducirse en el maquetado.

#### Scenario: El alumno elige Certificados
- **WHEN** el alumno pulsa `Certificados`
- **THEN** el ítem permanece deshabilitado con la etiqueta `Próximamente` y no abre ninguna pantalla

#### Scenario: El alumno busca su historia académica
- **WHEN** el alumno revisa el shell buscando la lista de certificados o un botón de descarga
- **THEN** no encuentra ninguno, porque el contenido del prototipo se reemplaza por el ítem deshabilitado y no debe construirse

### Requirement: Perfil del alumno

The system SHALL mostrar una tarjeta de identidad con el avatar `CR`, el nombre `Camila Rodríguez`, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo podés editar tus datos de contacto.`; y el bloque `Datos personales` con los campos `DNI` y `Nombre` renderizados como campos deshabilitados con la leyenda `solo lectura`, los campos `Email` y `Teléfono` editables y el botón `Guardar cambios`. Los valores del maquetado son `40.112.233` en el DNI, `Camila Rodríguez` en el nombre, `cami_rod@hotmail.com` en el email y `011 4788-1122` en el teléfono, tomados de los datos del cliente. El DNI y el identificador asignado por el sistema SHALL permanecer no editables: el sistema SHALL NOT renderizar ningún control ni acción que los modifique.

#### Scenario: El alumno abre su perfil
- **WHEN** el alumno abre `Mi Perfil`
- **THEN** ve la tarjeta de identidad con `CR`, `Camila Rodríguez`, el chip `ALUMNO · PERMISOS MÍNIMOS` y la nota `Solo podés editar tus datos de contacto.`

#### Scenario: El alumno revisa sus datos personales
- **WHEN** el alumno abre el bloque `Datos personales`
- **THEN** ve `40.112.233` en el campo `DNI`, `Camila Rodríguez` en `Nombre`, `cami_rod@hotmail.com` en `Email` y `011 4788-1122` en `Teléfono`

#### Scenario: El alumno edita sus datos de contacto
- **WHEN** el alumno modifica `Email` o `Teléfono` y pulsa `Guardar cambios`
- **THEN** el maquetado muestra la confirmación de la edición y refleja el nuevo valor en el campo

#### Scenario: El alumno intenta editar el DNI
- **WHEN** el alumno intenta modificar el `DNI` o el identificador asignado por el sistema
- **THEN** los campos aparecen deshabilitados con la leyenda `solo lectura` y el maquetado no ofrece ninguna acción para editarlos

### Requirement: Aislamiento de datos y control de acceso del shell del alumno

The system SHALL rechazar con 403 a un usuario autenticado con rol alumno que navegue a una ruta del shell de Administración o del shell de Docente. El shell SHALL mostrar únicamente las inscripciones y los pagos del propio alumno: el sistema SHALL NOT exponer datos de otros alumnos, de otras comisiones ni de terceros pagadores más allá del nombre que figura en los comprobantes del propio alumno.

#### Scenario: El alumno navega a un shell ajeno
- **WHEN** un usuario con rol alumno navega a una ruta de Administración o de Docente
- **THEN** el sistema lo rechaza con 403 y no le muestra ninguna pantalla de esos shells

#### Scenario: El alumno intenta cambiar de alumno
- **WHEN** el alumno navega por el shell completo
- **THEN** solo ve sus propias inscripciones y sus propios pagos, sin ninguna vía para consultar los de otro alumno
