# Spec Delta

## MODIFIED Requirements

### Requirement: Tablero del Alumno en la ruta raíz

The system SHALL mostrar en la raíz del shell del alumno —el ítem `Dashboard` del panel lateral— un
encabezado con el saludo `Buen día, {nombre de la cuenta}` y una línea de fecha con la fecha real del
día que la fuente informa, formateada para español rioplatense con el día de la semana capitalizado
(por ejemplo `Viernes 9 de octubre`), seguida de la frase de apoyo `Cada paso cuenta. Este es tu
espacio para avanzar.`. El nombre es el de la cuenta de la sesión y la fecha SHALL ser un valor
calculado a partir del día corriente, no un literal del maquetado.

The system SHALL mostrar cuatro tarjetas de indicador, cada una con su ícono, su rótulo, su valor y
una línea de contexto: `CURSOS EN MARCHA` con la cantidad real de inscripciones y el contexto con sus
códigos y cursos; `ACCESO A LA CLASE` con el estado real de sus inscripciones —`BLOQUEADO` en rojo con
la causa cuando alguna lo está, y `HABILITADO` en verde solo cuando todas lo están— y `—` cuando no
tiene ninguna; `COMPROBANTES ACREDITADOS` con la cantidad real de pagos en estado `ACREDITADO` que
devuelve `GET /alumno/pagos` y el contexto con el total imputado y la cantidad en revisión; y `PRÓXIMA
CLASE` con la próxima clase del cronograma real y el curso al que pertenece, o `—` cuando no hay
ninguna.

El sistema SHALL mostrar el bloque `Tu situación de pagos` con la cantidad de comprobantes acreditados
y su importe total, la cantidad de comprobantes en revisión (`PENDIENTE_REVISION`) y la cantidad de
comprobantes observados, cada uno con su enlace a `Mis Pagos` en `/alumno/pagos`. WHEN no tenga
comprobantes, el bloque SHALL mostrar un mensaje de vacío con el enlace para cargar el primero. El
bloque SHALL NOT mostrar progreso, lecciones completadas, tareas ni calificaciones: esas entidades no
existen en el modelo.

El sistema SHALL mostrar el bloque `Comprobantes recientes` con hasta cinco comprobantes enviados por
el alumno, de cualquier estado, ordenados por fecha de recepción descendente, con fecha, importe, medio
y estado. Las etiquetas de estado SHALL ser las mismas que las de `Mis Pagos` y el bloque SHALL ofrecer
`Ver mis pagos`, que navega a `/alumno/pagos`. El bloque que el prototipo titula `Organizá tus
próximas entregas` se reemplaza por este: el sistema no registra entregas.

El sistema SHALL mostrar el bloque `Tu agenda` con la semana corriente y los próximos encuentros de
todas sus inscripciones, agrupados por fecha, ordenados por fecha y hora, con el rango horario de ese
día, el curso y el tema solo cuando esté cargado. Los encuentros SHALL tomarse de los mismos datos que
muestra el detalle del curso. El bloque SHALL ofrecer `Ver mis cursos`, que navega a `/alumno/cursos`.
WHEN no haya encuentros, SHALL mostrar su mensaje de vacío y, si la lectura falla, SHALL informar el
fallo en lugar de afirmar que no hay encuentros.

El sistema SHALL mostrar el bloque `Requiere tu atención` con los avisos accionables reales: cada
inscripción bloqueada, con su curso y su causa, y cada comprobante observado, con su motivo. Cada aviso
SHALL navegar a `Mis Pagos` en `/alumno/pagos`. WHEN no haya avisos, el bloque SHALL mostrar un mensaje
informativo y SHALL NOT quedar vacío. El bloque SHALL NOT mostrar novedades, logros, mensajes ni
recordatorios de cuota que el sistema no registra.

El tablero SHALL conservar siempre su forma y SHALL NOT colapsar a su estado vacío: las cuatro
tarjetas y los bloques `Tu situación de pagos`, `Comprobantes recientes`, `Tu agenda` y `Requiere tu
atención` SHALL renderizarse aunque su dato no exista todavía, y el tablero SHALL NOT eliminar una
tarjeta ni un bloque porque la fuente no pueda responder. Donde la fuente no puede responder, el valor
SHALL ser `—`; donde la fuente responde, SHALL mostrarse el valor real, incluido un `0` real. El valor
`—` SHALL significar "todavía no lo sé" y SHALL NOT significar "cero". Mientras una lectura no haya
resuelto, los valores que dependen de ella SHALL ser `—`, nunca un `0` ni un literal.

Las tarjetas de las inscripciones NO forman parte del tablero: viven en la pantalla `Mis Cursos`, que
es la que conserva su mensaje de vacío cuando el alumno no tiene ninguna inscripción.

#### Scenario: La alumna abre su tablero
- **WHEN** la alumna abre la raíz de su shell
- **THEN** ve el saludo con su nombre y la fecha real, las cuatro tarjetas —`CURSOS EN MARCHA`, `ACCESO A LA CLASE`, `COMPROBANTES ACREDITADOS` y `PRÓXIMA CLASE`—, `Tu situación de pagos`, `Comprobantes recientes`, `Tu agenda` y `Requiere tu atención`

#### Scenario: La alumna espera mientras cargan sus inscripciones
- **WHEN** la alumna abre la raíz de su shell y las consultas todavía no resolvieron
- **THEN** el tablero ya se pinta con su forma completa y cada valor que depende de una lectura muestra `—`, nunca un `0` ni un literal

#### Scenario: La alumna no tiene inscripciones
- **WHEN** la alumna no tiene ninguna inscripción
- **THEN** `CURSOS EN MARCHA` muestra un `0` real, `ACCESO A LA CLASE` y `PRÓXIMA CLASE` muestran `—`, el tablero no colapsa y `Tu agenda` cae a su mensaje de vacío, mientras que `Mis Cursos` es la que muestra el mensaje de que no tiene cursos activos

#### Scenario: La alumna compara el indicador de acceso con su tarjeta
- **WHEN** la alumna revisa `ACCESO A LA CLASE` en el tablero y la tarjeta de su inscripción en `Mis Cursos`
- **THEN** ambas muestran el mismo estado, porque el indicador refleja el campo de la inscripción y no un cálculo

#### Scenario: La alumna tiene el acceso bloqueado
- **WHEN** la inscripción de la alumna está bloqueada
- **THEN** `ACCESO A LA CLASE` muestra `BLOQUEADO` en rojo con la causa y `Requiere tu atención` muestra el aviso con su enlace a `Mis Pagos`

#### Scenario: La alumna tiene comprobantes acreditados
- **WHEN** `GET /alumno/pagos` devuelve dos pagos en estado `ACREDITADO` por $ 60.000 en total
- **THEN** `COMPROBANTES ACREDITADOS` muestra `2` y su contexto informa el total y la cantidad en revisión

#### Scenario: La alumna no tiene pagos acreditados
- **WHEN** la consulta de pagos responde con una lista vacía
- **THEN** `COMPROBANTES ACREDITADOS` muestra un `0` real y `Tu situación de pagos` cae a su mensaje de vacío

#### Scenario: La alumna tiene comprobantes en revisión
- **WHEN** la alumna envió comprobantes que siguen en `PENDIENTE_REVISION`
- **THEN** `Tu situación de pagos` informa cuántos están en revisión y ofrece el enlace a `Mis Pagos`

#### Scenario: La alumna tiene un comprobante observado
- **WHEN** la alumna tiene un comprobante en estado `OBSERVADO` con su motivo
- **THEN** `Requiere tu atención` muestra el aviso con el motivo y el enlace a `Mis Pagos`

#### Scenario: La alumna no tiene avisos
- **WHEN** la alumna no tiene ninguna inscripción bloqueada ni comprobante observado
- **THEN** `Requiere tu atención` muestra un mensaje informativo y no un bloque vacío

#### Scenario: La alumna revisa su agenda
- **WHEN** la alumna mira un encuentro de `Tu agenda`
- **THEN** ve la fecha agrupada, el horario de ese día y el curso, ve el tema solo si la clase de esa fecha ya está cargada, sin texto de relleno, y los encuentros están ordenados por fecha y hora

#### Scenario: La alumna compara el indicador de acceso con varias cursadas
- **WHEN** la alumna tiene una cursada habilitada y otra bloqueada
- **THEN** `ACCESO A LA CLASE` muestra `BLOQUEADO` en rojo con la causa de la cursada bloqueada, sin importar el orden de la respuesta

#### Scenario: La alumna busca sus tareas o sus calificaciones
- **WHEN** la alumna recorre el tablero buscando tareas pendientes, calificaciones o un porcentaje de progreso
- **THEN** no los encuentra, porque esas entidades no existen en el modelo
