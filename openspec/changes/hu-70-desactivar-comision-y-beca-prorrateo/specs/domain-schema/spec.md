# Spec Delta

## MODIFIED Requirements

### Requirement: Comisiones con cupo, arancel, modalidad y sede

El sistema SHALL almacenar una comisión asociada a un curso, con docente, días y
horarios, `cupo_maximo`, arancel, modalidad, sede y estado. La comisión **SHALL NOT
almacenar su código**: `comision.codigo` SHALL NOT existir, y con él su índice único ni
su CHECK de obligatorio. En su lugar SHALL existir `numero`, un entero mayor que cero,
único dentro del curso, de modo que dos comisiones del mismo curso no puedan compartir
número. El número SHALL ser incremental por curso: SHALL ser el máximo de los números de
ese curso más uno. El código de la comisión SHALL ser un valor **derivado** con la forma
`{código del curso}-{número}`, por ejemplo `CUR001-1`, y SHALL estar disponible sin
persistirse como columna. `cupo_maximo` SHALL ser un entero mayor que cero, y el arancel
SHALL ser un valor numérico mayor que cero. La modalidad SHALL tomar un valor entre
Virtual, Presencial e Híbrido. La sede SHALL ser **opcional en toda modalidad** y
`sede_id` SHALL admitir ausencia en el esquema; WHEN la modalidad sea Virtual, la
comisión SHALL NOT llevar `sede_id`. Las vacantes SHALL derivarse de `cupo_maximo` menos
la cantidad de inscripciones activas y SHALL NOT almacenarse como un valor editable
(historias #2, #5, #6, #7 y #8).

El **estado de la comisión** SHALL derivarse de `fecha_fin` y SHALL NOT almacenarse como columna
ni requerir un job programado. La comparación SHALL hacerse contra el día corriente en la zona
horaria `America/Argentina/Buenos_Aires`: la comisión SHALL estar `Vigente` cuando `fecha_fin` sea
hoy o posterior y `Finalizada` cuando `fecha_fin` sea anterior a hoy (H/U 70).

Las dos reglas que dependen de las inscripciones —no inscribir en una comisión sin vacantes y no
reducir el cupo por debajo de los inscriptos— **quedan diferidas al change de inscripciones**.
Este change no incluye el alta de inscripciones, así que todavía no hay servicio ni endpoint que
las pueda rechazar. Se mantienen escritas porque el modelo las tiene que sostener cuando existan,
y la forma de derivar las vacantes por consulta —que es su base— ya está resuelta (D10).

#### Scenario: Alta de comisión completa
- **WHEN** se crea una comisión con curso, docente, días, horarios, cupo, arancel y modalidad
- **THEN** la comisión queda asociada al curso con un número propio y su código derivado se compone con el código del curso

#### Scenario: Número único dentro del curso
- **WHEN** se intenta crear dos comisiones del mismo curso con el mismo número
- **THEN** la base rechaza la segunda y la API informa el conflicto

#### Scenario: Número cero o negativo
- **WHEN** se intenta guardar una comisión con número cero o negativo
- **THEN** la base rechaza el valor

#### Scenario: No existe columna de código en la comisión
- **WHEN** se revisa la estructura de la tabla de comisiones
- **THEN** no hay columna de código persistida, ni índice único sobre ella, ni CHECK de obligatorio

#### Scenario: Modalidad que exige sede
- **WHEN** se selecciona modalidad Presencial o Híbrido y se intenta guardar sin indicar sede
- **THEN** la comisión se guarda y `sede_id` queda en `NULL`, porque la sede es opcional en toda modalidad. El nombre del escenario conserva el de la regla anterior: ya no hay modalidad que exija sede

#### Scenario: Modalidad virtual sin sede
- **WHEN** se selecciona modalidad Virtual y se guarda sin indicar sede
- **THEN** la comisión se registra con su modalidad y sin exigir sede

#### Scenario: Cupo inválido
- **WHEN** se intenta guardar un cupo cero, negativo o no numérico
- **THEN** el sistema rechaza el valor con `422`. El texto que llega de la API es el del validador y no está en es-AR; el mensaje «El cupo debe ser un entero positivo» lo muestra el formulario de la pantalla antes de enviar, y el del backend queda pendiente del change que escriba los mensajes de rechazo

#### Scenario: Arancel inválido
- **WHEN** se intenta guardar un arancel negativo o no numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Vacantes calculadas
- **WHEN** una comisión tiene cupo máximo 20 y 12 inscripciones activas
- **THEN** el sistema muestra 8 vacantes, derivadas y sin recalculado manual

#### Scenario: Comisión completa
- **WHEN** una comisión no tiene vacantes y se intenta una nueva inscripción
- **THEN** **Diferido a las inscripciones.** Hoy no hay servicio ni endpoint de inscripciones, así que la inscripción no se puede intentar y la regla no está verificada. La base de la regla ya está: las vacantes se derivan por consulta, así que una comisión sin vacantes es una comisión cuyo cupo iguala la cantidad de inscripciones activas

#### Scenario: Reducción de cupo por debajo de los inscriptos
- **WHEN** una comisión tiene 15 inscripciones activas y se intenta reducir su cupo máximo a un valor menor que 15
- **THEN** **Diferido a las inscripciones.** No existe endpoint que modifique `cupo_maximo`, así que el cambio no se puede intentar y la regla no está verificada. Cuando exista, la regla se sostiene con la misma derivación de vacantes por consulta, sin columna nueva

#### Scenario: Estado derivado de la fecha de fin
- **WHEN** se consulta una comisión cuya `fecha_fin` es hoy o una fecha posterior en `America/Argentina/Buenos_Aires`
- **THEN** el sistema informa el estado `Vigente`

#### Scenario: Comisión finalizada
- **WHEN** se consulta una comisión cuya `fecha_fin` es anterior a hoy en `America/Argentina/Buenos_Aires`
- **THEN** el sistema informa el estado `Finalizada`, sin haber escrito ninguna columna de estado ni ejecutado un job

#### Scenario: El cambio de día mueve el estado sin intervención
- **WHEN** llega el día siguiente al `fecha_fin` de una comisión `Vigente`
- **THEN** la misma consulta la informa como `Finalizada`, porque el estado se calcula por consulta

#### Scenario: Comisión heredada sin fecha de fin
- **WHEN** se consulta una comisión que no tiene `fecha_fin` cargada
- **THEN** el sistema la informa como `Vigente`, porque no hay fecha con la que afirmar que terminó y bloquearla impediría inscribir sobre datos incompletos

### Requirement: Inscripciones con categoría arancelaria

El sistema SHALL almacenar una inscripción que vincule un alumno con una comisión, y la combinación alumno y comisión SHALL ser única. Cada inscripción SHALL tener una categoría arancelaria, un estado entre Activa, En espera, Baja y Completada y un importe arancelario base. La categoría SHALL tomar un valor entre Particular, Becado parcial, Becado total y Corporativo. WHEN la categoría sea Becado parcial, `porcentaje_beca` SHALL ser obligatorio y SHALL estar entre 1 y 99; en cualquier otra categoría SHALL ser nulo. WHEN la categoría sea Corporativo, la empresa asociada SHALL ser obligatoria y el importe SHALL provenir del contrato corporativo. Para una inscripción Particular o Becado parcial en una comisión con período válido, el importe base SHALL calcularse con las clases restantes y SHALL NOT incluir el descuento de beca: el descuento SHALL aplicarse cada vez que se deriva el monto requerido, sobre el importe base guardado. La categoría Becado total SHALL implicar exención de pago (historias #14, #15 y #50).

#### Scenario: Inscripción única
- **WHEN** se inscribe un alumno en una comisión en la que ya está inscripto
- **THEN** el sistema rechaza la operación e informa que ya está inscripto

#### Scenario: Beca parcial con porcentaje válido
- **WHEN** se selecciona Becado parcial y se informa un porcentaje de descuento entre 1 y 99
- **THEN** el sistema guarda la categoría y el porcentaje, y el monto requerido se deriva aplicando el descuento al importe base

#### Scenario: Porcentaje de beca fuera de rango
- **WHEN** la categoría es Becado parcial y el porcentaje está fuera del rango o no es numérico
- **THEN** el sistema rechaza el valor e informa el error

#### Scenario: Corporativo sin empresa
- **WHEN** se selecciona la categoría Corporativo sin asociar una empresa registrada
- **THEN** el sistema rechaza el guardado y solicita seleccionar la empresa

#### Scenario: Beca total exenta
- **WHEN** una inscripción tiene categoría Becado total
- **THEN** el sistema la registra como exenta de pago sin requerir imputación de cobros

#### Scenario: Alta antes del inicio
- **WHEN** se crea una inscripción Particular o Becado parcial en la fecha de inicio o antes
- **THEN** el importe base corresponde al arancel completo de la comisión

#### Scenario: Alta tardía prorrateada
- **WHEN** se crea una inscripción Particular en una comisión iniciada, con período válido y clases restantes
- **THEN** el importe base persistido es el arancel multiplicado por clases restantes y dividido por clases totales, redondeado a centavos

#### Scenario: Beca parcial tardía
- **WHEN** se crea una inscripción Becado parcial en una comisión iniciada
- **THEN** el importe base persistido es el arancel prorrateado por clases restantes, **sin** descuento, y el monto requerido se deriva con el porcentaje de beca aplicado sobre ese base

#### Scenario: Cambio de categoría después del alta
- **WHEN** una inscripción con importe base prorrateado cambia a Becado parcial con un porcentaje entre 1 y 99, o cambia de Becado parcial a Particular
- **THEN** el monto requerido se vuelve a derivar aplicando o quitando el descuento sobre el mismo importe base, sin volver a prorratear y sin perder el importe histórico de la cursada

#### Scenario: El importe base no sigue al arancel de la comisión
- **WHEN** se edita el arancel de una comisión que ya tiene inscripciones
- **THEN** el importe base y el monto requerido de cada inscripción existente conservan el valor calculado en su alta

#### Scenario: Comisión sin período prorrateable
- **WHEN** se intenta una inscripción que requiere prorrateo y la comisión no tiene período válido o no tiene clases computables
- **THEN** el sistema rechaza la operación con un mensaje que informa que no se pudo calcular el importe
