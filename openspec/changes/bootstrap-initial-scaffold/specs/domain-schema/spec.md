# Spec Delta

## Purpose

Definir el esquema relacional de dominio de TechAcademy BA derivado de los criterios de aceptación de las 47 historias de usuario: catálogo de cursos, comisiones y sedes, padrón de docentes y alumnos, inscripciones con categoría arancelaria, cuentas corporativas, pagador desacoplado del alumno, cobranzas con su causa e imputaciones, facturas, clases, override de habilitación y auditoría.

Este change define la estructura de datos y su migración inicial. No define endpoints CRUD de dominio.

## ADDED Requirements

### Requirement: Catálogo de cursos normalizado

El sistema SHALL almacenar un curso con un código y un nombre, y ambos SHALL ser únicos. La unicidad SHALL evaluarse normalizando mayúsculas, acentos, espacios y guiones, de modo que dos códigos que solo difieren en esos caracteres se consideran duplicados y el segundo alta SHALL ser rechazada mostrando el curso existente. El nombre y el código SHALL ser obligatorios, y la edición de un curso SHALL preservar el historial de sus comisiones asociadas (historia #1, historia #3).

#### Scenario: Alta de curso sin duplicados
- **WHEN** se da de alta un curso cuyo nombre y código no existen
- **THEN** el curso se crea y queda disponible en el catálogo

#### Scenario: Código o nombre duplicado por normalización
- **WHEN** se intenta guardar un curso cuyo código solo difiere del existente en mayúsculas, acentos, espacios o guiones
- **THEN** el sistema rechaza el alta e identifica el curso ya existente

#### Scenario: Datos obligatorios faltantes
- **WHEN** se intenta guardar un curso sin nombre o sin código
- **THEN** el sistema no lo crea e indica los campos obligatorios faltantes

#### Scenario: Edición sin pérdida de historial
- **WHEN** se modifica el nombre, el código o la descripción de un curso que ya tiene comisiones
- **THEN** el cambio se guarda y las comisiones y su historial siguen asociados al curso

### Requirement: Comisiones con cupo, arancel, modalidad y sede

El sistema SHALL almacenar una comisión asociada a un curso, con docente, código, días y horarios, `cupo_maximo`, arancel, modalidad, sede y estado. El código de comisión SHALL ser único. `cupo_maximo` SHALL ser un entero mayor que cero, y el arancel SHALL ser un valor numérico mayor que cero. La modalidad SHALL tomar un valor entre Virtual, Presencial e Híbrido. WHEN la modalidad sea Presencial o Híbrido, `sede` SHALL ser obligatoria; WHEN sea Virtual, la sede SHALL ser opcional. Las vacantes SHALL derivarse de `cupo_maximo` menos la cantidad de inscripciones activas y SHALL NOT almacenarse como un valor editable (historias #2, #5, #6, #7, #8).

#### Scenario: Alta de comisión completa
- **WHEN** se crea una comisión con curso, docente, días, horarios, cupo, arancel y modalidad
- **THEN** la comisión queda asociada al curso con un código único

#### Scenario: Modalidad que exige sede
- **WHEN** se selecciona modalidad Presencial o Híbrido y se intenta guardar sin indicar sede
- **THEN** el sistema rechaza el guardado y solicita seleccionar una sede

#### Scenario: Modalidad virtual sin sede
- **WHEN** se selecciona modalidad Virtual y se guarda sin indicar sede
- **THEN** la comisión se registra con su modalidad y sin exigir sede

#### Scenario: Cupo inválido
- **WHEN** se intenta guardar un cupo cero, negativo o no numérico
- **THEN** el sistema rechaza el valor e informa que el cupo debe ser un entero positivo

#### Scenario: Arancel inválido
- **WHEN** se intenta guardar un arancel negativo o no numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Vacantes calculadas
- **WHEN** una comisión tiene cupo máximo 20 y 12 inscripciones activas
- **THEN** el sistema muestra 8 vacantes, derivadas y sin recalculado manual

#### Scenario: Comisión completa
- **WHEN** una comisión no tiene vacantes y se intenta una nueva inscripción
- **THEN** el sistema rechaza la inscripción e informa que la comisión está completa

#### Scenario: Reducción de cupo por debajo de los inscriptos
- **WHEN** una comisión tiene 15 inscripciones activas y se intenta reducir su cupo máximo a un valor menor que 15
- **THEN** el sistema rechaza el cambio e informa la cantidad actual de inscripciones activas

### Requirement: Padrón de docentes y alumnos

El sistema SHALL almacenar un docente con nombre, apellido, DNI, CUIL, email y teléfono, y un alumno con nombre, DNI o pasaporte, email y teléfono. El CUIL del docente es obligatorio: es el identificador que la institute usa para las liquidaciones, y el docente no existe en el sistema sin él. El sistema SHALL garantizar que el DNI del docente sea único, que el DNI o pasaporte del alumno sea único y que el email sea único dentro de cada padrón y además único frente al padrón del otro rol, de modo que una misma dirección de correo no identifique a dos personas. WHEN se cargue un email con formato inválido SHALL rechazarse el alta (historias #9, #13).

El alta de un alumno SHALL admitir que el documento sea un pasaporte y que el alumno no tenga DNI, porque el instituto inscribe alumnos del exterior. Los datos adicionales que un alumno extranjero requiere no forman parte de este change: su definición se discute con el cliente.

#### Scenario: Alta de docente con CUIL
- **WHEN** se da de alta un docente con nombre, apellido, DNI, CUIL, email y teléfono cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email y queda disponible para ser asignado a comisiones

#### Scenario: Docente sin CUIL
- **WHEN** se intenta guardar un docente sin CUIL
- **THEN** el sistema rechaza el alta e informa que el CUIL es obligatorio

#### Scenario: Alta de docente
- **WHEN** se completa nombre, apellido, DNI, email y teléfono de un docente cuyos datos no están registrados
- **THEN** el docente se crea con acceso por su email

#### Scenario: DNI o email de docente duplicado
- **WHEN** se intenta registrar un docente con un DNI o un email ya registrados
- **THEN** el sistema rechaza el alta e informa el dato duplicado

#### Scenario: Alta de alumno
- **WHEN** se completa DNI o pasaporte, nombre, email y teléfono de un alumno cuyos datos no están registrados
- **THEN** el alumno se crea en el padrón

#### Scenario: Documento de alumno duplicado
- **WHEN** se intenta registrar un alumno con un DNI o pasaporte ya registrado
- **THEN** el sistema rechaza el alta y muestra el alumno existente

#### Scenario: Alumno del exterior sin DNI
- **WHEN** se da de alta un alumno con pasaporte y sin DNI, y con un email no registrado
- **THEN** el sistema crea el alumno en el padrón y lo admite como identificador del legajo

#### Scenario: Email con formato inválido
- **WHEN** se intenta guardar un alumno o docente con un email de formato incorrecto
- **THEN** el sistema rechaza el alta e indica el error de formato

### Requirement: Inscripciones con categoría arancelaria

El sistema SHALL almacenar una inscripción que vincule un alumno con una comisión, y la combinación alumno y comisión SHALL ser única. Cada inscripción SHALL tener una categoría arancelaria y un estado entre Activa, En espera, Baja y Completada. La categoría SHALL tomar un valor entre Particular, Becado parcial, Becado total y Corporativo. WHEN la categoría sea Becado parcial, `porcentaje_beca` SHALL ser obligatorio y SHALL estar entre 1 y 99; en cualquier otra categoría SHALL ser nulo. WHEN la categoría sea Corporativo, la empresa asociada SHALL ser obligatoria. La categoría Becado total SHALL implicar exención de pago (historia #14, historia #15).

#### Scenario: Inscripción única
- **WHEN** se inscribe un alumno en una comisión en la que ya está inscripto
- **THEN** el sistema rechaza la operación e informa que ya está inscripto

#### Scenario: Beca parcial con porcentaje válido
- **WHEN** se selecciona Becado parcial y se informa un porcentaje de descuento entre 1 y 99
- **THEN** el sistema guarda la categoría y el porcentaje, y el arancel a abonar se deriva con ese descuento

#### Scenario: Porcentaje de beca fuera de rango
- **WHEN** la categoría es Becado parcial y el porcentaje está fuera del rango o no es numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Corporativo sin empresa
- **WHEN** se selecciona la categoría Corporativo sin asociar una empresa registrada
- **THEN** el sistema rechaza el guardado y solicita seleccionar la empresa

#### Scenario: Beca total exenta
- **WHEN** una inscripción tiene categoría Becado total
- **THEN** el sistema la registra como exenta de pago sin requerir imputación de cobros

### Requirement: Cuentas corporativas y nómina de empleados

El sistema SHALL almacenar una empresa con razón social, CUIT e indicador de necesidad de Factura A. El CUIT SHALL ser único y SHALL validarse tanto por formato como por dígito verificador. El sistema SHALL almacenar un contrato corporativo con tipo entre Charla y Curso formal, monto y estado. WHEN el tipo sea Charla, el sistema SHALL NOT generar alumnos ni solicitar la carga de nómina, porque una charla cerrada no genera alumnos (historia #19). WHEN el tipo sea Curso formal, la empresa SHALL poder cargar su nómina de empleados y el sistema SHALL crear una inscripción por empleado en la comisión contratada, clasificando a cada empleado como Becado parcial o Becado total, y SHALL vincular al alumno existente cuando el documento ya esté en el padrón, sin duplicar su registro. WHEN la nómina supere las vacantes disponibles, el sistema SHALL rechazar la carga e informar las vacantes (historias #18, #19, #20).

#### Scenario: Alta de empresa
- **WHEN** se completa razón social, un CUIT válido y se indica si requiere Factura A
- **THEN** la empresa se crea y queda disponible para asociar contratos e inscripciones corporativas

#### Scenario: CUIT duplicado o inválido
- **WHEN** se intenta registrar una empresa con un CUIT ya registrado, o con un CUIT de formato o dígito verificador incorrecto
- **THEN** el sistema rechaza el alta e informa el error

#### Scenario: Charla corporativa cerrada
- **WHEN** la empresa contrata una charla corporativa sin inscripción formal
- **THEN** el sistema no genera alumnos ni solicita la carga de nómina para esa contratación

#### Scenario: Carga de nómina en curso formal
- **WHEN** se carga la nómina de empleados de una empresa con curso formal y una comisión con vacantes suficientes
- **THEN** el sistema crea una inscripción por empleado vinculada a la empresa y a la comisión

#### Scenario: Empleado ya registrado en el padrón
- **WHEN** un empleado de la nómina ya existe en el padrón de alumnos
- **THEN** el sistema lo vincula al alumno existente sin duplicar su registro

#### Scenario: Nómina que excede las vacantes
- **WHEN** la cantidad de empleados de la nómina supera las vacantes de la comisión
- **THEN** el sistema rechaza la carga e informa las vacantes disponibles

### Requirement: Pagador desacoplado del alumno

El sistema SHALL almacenar un pagador con nombre y CUIT o documento, asociado a la cobranza, y representa la persona o entidad que efectuó el pago. El pagador SHALL NOT ser un alumno ni SHALL incorporarse al padrón de alumnos, y su existencia SHALL NOT alterar los datos del alumno beneficiario. WHEN se cargue un CUIT de formato incorrecto el sistema SHALL rechazarlo. Esta separación existe porque los comprobantes llegan a nombre de padres, familiares o empresas (historia #22).

#### Scenario: Titular distinto del alumno
- **WHEN** se registra un pago cuyo titular es un tercero y se informa su nombre y su CUIT
- **THEN** los datos del titular quedan asociados al pago y se muestran en su detalle, sin crear ni modificar ningún alumno

#### Scenario: Titular que no es alumno
- **WHEN** el titular del pago no figura en el padrón
- **THEN** el sistema lo conserva solo como pagador del pago y no lo incorpora al padrón de alumnos

#### Scenario: CUIT de pagador inválido
- **WHEN** se informa un CUIT de pagador con formato incorrecto
- **THEN** el sistema rechaza el dato e informa el error

### Requirement: Cobranzas con estado auditado

El sistema SHALL almacenar una cobranza con fecha, importe, medio de pago, origen y estado. La fecha SHALL ser obligatoria y SHALL NOT ser futura, y el importe SHALL ser numérico y mayor que cero. El medio de pago SHALL tomar un valor entre Transferencia, Efectivo, Cheque, Tarjeta, Billetera y Otro. El origen SHALL distinguir el registro manual de una pasarela. El estado SHALL tomar un valor entre Acreditado, Observado y Rechazado. WHEN el estado de un comprobante cambie, el sistema SHALL registrar quién realizó el cambio y cuándo, y el estado Observado SHALL NOT habilitar el acceso a las clases (historias #21, #24).

#### Scenario: Registro de pago válido
- **WHEN** se registra fecha, importe mayor que cero y medio de pago
- **THEN** el pago queda registrado con esos datos

#### Scenario: Importe o fecha inválidos
- **WHEN** se informa un importe menor o igual a cero, o una fecha futura
- **THEN** el sistema rechaza el registro e informa el error

#### Scenario: Datos obligatorios faltantes
- **WHEN** se omite la fecha, el importe o el medio de pago
- **THEN** el sistema no registra el pago e indica los campos faltantes

#### Scenario: Cambio de estado de un comprobante
- **WHEN** un comprobante pasa de Observado a Acreditado
- **THEN** el sistema actualiza el estado y registra el usuario y la fecha del cambio

#### Scenario: Comprobante observado
- **WHEN** un comprobante queda en estado Observado
- **THEN** el sistema lo muestra como tal en el listado de pagos y en la ficha del alumno, y no lo considera válido para habilitar el acceso

### Requirement: Causa registrada de un comprobante no acreditado

Una cobranza que no está acreditado SHALL registrar la causa por la que no lo está, y esa causa SHALL ser obligatoria. WHEN se marca una cobranza como Observada o Rechazada sin informar la causa, el sistema SHALL rechazar el cambio. WHEN se registra la causa, el sistema SHALL conservar quién la registró y cuándo. La causa SHALL distinguir, entre otros, el comprobante ilegible, el cheque pendiente de acreditación y la existencia de un saldo pendiente.

*Por qué:* sin la causa registrada, un comprobante ilegible y una mora de tres meses producen el mismo estado y el mismo resultado, que es exactamente la ambigüedad que el cliente reporta. La causa es lo que después se muestra como motivo del bloqueo (historias #24, #28, #30).

#### Scenario: Comprobante ilegible con causa
- **WHEN** un comprobante que no se puede leer se marca como Observado informando que es ilegible
- **THEN** el sistema guarda el estado y la causa, con el usuario y la fecha, y la causa queda visible junto al comprobante

#### Scenario: Observado sin causa
- **WHEN** se intenta marcar una cobranza como Observada dejando la causa vacía
- **THEN** el sistema rechaza el cambio y solicita la causa

#### Scenario: Dos comprobantes no acreditados con causas distintas
- **WHEN** hay un cheque pendiente de acreditación y un comprobante ilegible
- **THEN** ambos quedan no acreditados y cada uno muestra su propia causa, de modo que no se confundan entre sí

El sistema SHALL registrar imputaciones que asocien una cobranza con una inscripción o con una empresa, indicando el monto imputado. Una misma cobranza SHALL admitir varias imputaciones, de modo que un pago pueda repartirse entre varios alumnos. WHEN se intente imputar un monto superior al saldo no imputado de la cobranza, el sistema SHALL rechazarlo e informar el saldo disponible. El saldo no imputado de una cobranza SHALL derivarse de su importe menos la suma de sus imputaciones y SHALL NOT almacenarse como un valor editable. El esquema SHALL permitir agregar más adelante una imputación dirigida a una cuota sin requerir redefinir las imputaciones existentes (historia #23).

#### Scenario: Imputación a un alumno
- **WHEN** se imputa una cobranza a un alumno inscripto, sea cual sea el titular del pago
- **THEN** la imputación queda asociada a la inscripción del alumno y se refleja en su historial de pagos

#### Scenario: Imputación a una empresa
- **WHEN** se imputa una cobranza a la cuenta de una empresa
- **THEN** la imputación queda asociada a la empresa y no a un alumno individual

#### Scenario: Pago dividido entre varios alumnos
- **WHEN** se reparte el importe de una cobranza entre varios alumnos
- **THEN** cada alumno recibe su monto imputado y la suma de las imputaciones no supera el importe de la cobranza

#### Scenario: Imputación que excede el saldo
- **WHEN** el monto a imputar supera el saldo no imputado de la cobranza
- **THEN** el sistema rechaza la operación e informa el saldo disponible

### Requirement: Registro de facturas y de su emisión

El sistema SHALL almacenar una factura con tipo, indicador de si fue requerida, indicador de si fue emitida y número. El tipo SHALL distinguir la factura A, que se emite a una empresa con CUIT, de la factura B, que se emite a un consumidor final. WHEN una empresa requiere Factura A, el sistema SHALL permitir registrar que la factura fue emitida y que ese estado sea visible en la ficha de la empresa. WHEN la empresa no requiere Factura A, el sistema SHALL NOT mostrar seguimiento de factura pendiente (historia #25).

#### Scenario: Factura A emitida
- **WHEN** se marca como emitida la factura requerida por una empresa
- **THEN** el estado queda registrado y es visible en la ficha de la empresa

#### Scenario: Factura A pendiente
- **WHEN** se consulta la ficha de una empresa que requiere Factura A sin factura emitida
- **THEN** figura como pendiente de emisión

#### Scenario: Empresa que no requiere Factura A
- **WHEN** se consulta la ficha de una empresa que no requiere Factura A
- **THEN** el sistema no muestra seguimiento de factura pendiente

#### Scenario: Factura B a un alumno particular
- **WHEN** se registra una factura de tipo B a favor de un alumno particular que abonó por transferencia
- **THEN** el sistema la registra con su tipo, y el alumno puede verla junto a sus pagos

### Requirement: Clases con link virtual validado

El sistema SHALL almacenar una clase asociada a una comisión, con fecha, tema y link virtual. WHEN se informe un valor de link virtual que no sea una URL válida, el sistema SHALL rechazarlo e informar el error. El link de una clase SHALL quedar disponible únicamente para los alumnos habilitados de esa comisión, y un alumno bloqueado SHALL NOT poder obtenerlo por ninguna vía (historia #33).

#### Scenario: Carga de un link válido
- **WHEN** el docente de la comisión informa un link con formato de URL válida y confirma
- **THEN** el link queda disponible en el panel del docente y en el del alumno habilitado de esa comisión

#### Scenario: Link inválido
- **WHEN** se informa un texto que no es una URL válida
- **THEN** el sistema rechaza el link e informa el error

#### Scenario: Alumno bloqueado y link cargado
- **WHEN** el link de una clase ya fue cargado y el alumno está bloqueado
- **THEN** el alumno no recibe el link ni puede verlo en su panel

### Requirement: Asistencia por alumno y clase

El sistema SHALL registrar la asistencia de cada alumno a cada clase como Presente o Ausente, y SHALL permitir calcular los totales de presentes y ausentes. WHEN se modifique una asistencia ya registrada y se guarde, el sistema SHALL actualizar el registro y recalcular los totales (historia #34).

#### Scenario: Registro de asistencia
- **WHEN** el docente marca a cada alumno inscripto como Presente o Ausente y guarda
- **THEN** la asistencia queda registrada para esa clase y fecha, con el total de presentes y ausentes

#### Scenario: Corrección de asistencia
- **WHEN** se modifica el estado de un alumno en una asistencia ya registrada y se guarda
- **THEN** el registro se actualiza y los totales se recalculan

### Requirement: Override del estado de habilitación

El sistema SHALL almacenar el forzaje manual del estado de habilitación de una inscripción, con el estado forzado, un motivo, el usuario que lo aplicó, la fecha y un indicador de vigencia. WHEN se intenta forzar un estado sin informar un motivo, el sistema SHALL rechazarlo y solicitar el motivo. WHEN el estado forzado está vigente, SHALL prevalecer sobre el cálculo automático. WHEN se quita el forzaje, el estado vuelve a derivarse de la regla automática. Quitar el forzaje SHALL registrar la acción en la auditoría (historia #30).

#### Scenario: Forzado con motivo
- **WHEN** se fuerza el estado contrario al automático y se informa un motivo
- **THEN** el estado forzado se aplica, prevalece sobre la regla automática y se registran usuario, fecha y motivo

#### Scenario: Forzado sin motivo
- **WHEN** se intenta forzar el estado y el motivo queda vacío
- **THEN** el sistema rechaza la operación y solicita el motivo

#### Scenario: Retorno a la regla automática
- **WHEN** se quita el estado forzado de una inscripción
- **THEN** el estado vuelve a derivarse de la regla automática

### Requirement: El estado de habilitación se calcula, no se almacena

El sistema SHALL derivar el estado de habilitación de una inscripción a partir de su situación arancelaria, y SHALL NOT persistirlo como un atributo de la inscripción. El estado derivado SHALL distinguir entre Habilitado y Bloqueado y SHALL producir la causa del bloqueo cuando el resultado sea Bloqueado. WHEN exista un override vigente, el estado por override SHALL prevalecer y SHALL quedar identificado como forzado junto con su motivo. Este change SHALL NOT implementar la regla automática: solo SHALL persistir la estructura que la sostiene.

#### Scenario: El estado no es un atributo almacenado
- **WHEN** se consulta la estructura de datos de una inscripción
- **THEN** no existe un campo de estado de habilitación persistido en ella

#### Scenario: Bloqueado con causa
- **WHEN** una inscripción resulta bloqueada según su situación arancelaria
- **THEN** el sistema expone un estado Bloqueado junto con la causa, por ejemplo pago pendiente, comprobante observado, empresa impaga o nómina faltante

#### Scenario: Estado forzado identificado
- **WHEN** una inscripción tiene un override vigente
- **THEN** el estado expuesto se identifica como forzado y muestra el motivo registrado

### Requirement: Registro de auditoría

El sistema SHALL mantener un registro de auditoría general que capte las operaciones relevantes con su actor, su fecha y el detalle de lo ocurrido. Este registro SHALL ser de solo agregado y no SHALL permitir la modificación ni el borrado de sus entradas.

#### Scenario: Operación relevante registrada
- **WHEN** un usuario autenticado realiza una operación que la auditoría debe conservar
- **THEN** el sistema registra la entrada con el usuario, la fecha y el detalle de la operación

#### Scenario: Auditoría inmutable
- **WHEN** se intenta modificar o eliminar una entrada de auditoría
- **THEN** el sistema no lo permite

### Requirement: Convenciones transversales del esquema

Todas las entidades del dominio SHALL tener marca de creación y de última actualización. Las entidades que representan registros operativos con historial SHALL admitir baja lógica en lugar de borrado físico. Todos los montos SHALL expresarse en pesos argentinos con precisión decimal, y las fechas y horas SHALL registrarse con zona horaria `America/Argentina/Buenos_Aires`.

#### Scenario: Marcas de tiempo
- **WHEN** se crea o se modifica cualquier entidad del dominio
- **THEN** quedan registradas su fecha de creación y su fecha de última actualización

#### Scenario: Baja lógica
- **WHEN** se da de baja una entidad que tiene historial asociado
- **THEN** queda marcada como baja lógica y sus referencias históricas se conservan

#### Scenario: Moneda y zona horaria
- **WHEN** se lee un monto o una fecha del dominio
- **THEN** el monto está expresado en pesos argentinos y la fecha incluye la zona horaria `America/Argentina/Buenos_Aires`

### Requirement: El esquema de cuotas no se incluye en la migración inicial

La migración inicial SHALL NOT incluir la entidad de cuotas ni el esquema de cobro asociado, porque el equipo debe definirlo con el cliente antes de implementar la historia #27. Los esquemas de inscripción e imputación SHALL quedar diseñados de modo que la entidad de cuotas pueda agregarse en una migración posterior sin romper los datos ni las referencias existentes. La regla automática de habilitación SHALL NOT implementarse en este change.

#### Scenario: Migración inicial sin cuotas
- **WHEN** se aplica la migración inicial sobre una base vacía
- **THEN** el esquema resultante no contiene ninguna entidad de cuotas

#### Scenario: Imputaciones compatibles con cuotas futuras
- **WHEN** se revisa la estructura de las imputaciones
- **THEN** admite agregar una imputación dirigida a una cuota en una migración posterior sin alterar las imputaciones ya existentes

#### Scenario: Regla de habilitación diferida
- **WHEN** se revisa el alcance de este change
- **THEN** la evaluación automática del estado de habilitación queda asignada a un change posterior
