# Spec Delta

## Purpose

Definir el esquema relacional de dominio de TechAcademy BA derivado de los criterios de aceptación de las 47 historias de usuario: catálogo de cursos, comisiones y sedes, padrón de docentes y alumnos, inscripciones con categoría arancelaria, cuentas corporativas, pagador desacoplado del alumno, cobranzas con su causa e imputaciones, facturas, clases, override de habilitación y auditoría.

Este change define la estructura de datos y su migración inicial. No define endpoints CRUD de dominio.

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

Las dos reglas que dependen de las inscripciones —no Inscribir en una comisión sin vacantes y no
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