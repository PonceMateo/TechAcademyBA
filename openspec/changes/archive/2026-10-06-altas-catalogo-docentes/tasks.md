# Tasks

Cada work unit deja sus propios tests y su propia documentación. No hay un grupo final de
testing ni de docs: un grupo que llega tarde y exercise trabajo de un grupo anterior hace
que los fallos se propaguen hacia atrás y obliga a rehacer.

**Trazabilidad del pull request: `Refs #1, #2, #9`. Nunca `Closes`.** #1, #2, #5 y #8 no
cierran hasta que existan las historias de edición #3, #4 y #11. Cerrar los issues a
medías haría que el backlog mintiera sobre el estado real del producto (D21).

## 1. `chore(catalogo)` — Migración 0002, modelo, factories y `test_migration.py`

- [x] 1.1 Escribir `backend/alembic/versions/0002_altas_catalogo.py` con
  `down_revision = "0001_initial"`: `curso.codigo` a
  `GENERATED ALWAYS AS ('CUR' || lpad(id::text, greatest(3, length(id::text)), '0')) STORED`,
  baja de `curso.codigo_norm` con su índice y creación de `uq_curso_codigo`; `comision.numero`
  `NOT NULL` con `ck_comision_numero_positivo` y `uq_comision_curso_numero`, y baja de
  `comision.codigo` con su CHECK y `uq_comision_codigo`; `docente.cuil` sin `NOT NULL` y sin
  `ck_docente_docente_cuil_obligatorio`, conservando `uq_docente_cuil`. **Verificar** que
  `alembic upgrade head` y `alembic downgrade 0001_initial` terminan los dos en cero, porque
  `conftest.py` corre `downgrade base` y `upgrade head` al inicio de cada sesión y un
  `downgrade` a medias ensucia la base de pruebas entre corridas.
- [x] 1.2 Actualizar `backend/app/models/catalogo.py`: `Curso.codigo` como
  `Computed(..., persisted=True)`, borrar `codigo_norm`, mantener `no_vacio("codigo", ...)`;
  `Comision` sin `codigo`, con `numero`, `ck_comision_numero_positivo`,
  `uq_comision_curso_numero`, y el código derivado como **propiedad del ORM** que compone
  `{curso.codigo}-{numero}`. **Verificar** con `ruff check .` y con
  `test_la_migracion_escrita_a_mano_cuadra_con_los_modelos` en verde — sabiendo que esa
  prueba **no** alcanza para la expresión (ver 1.5).
- [x] 1.3 Actualizar `backend/app/models/padron.py`: `Docente.cuil` anulable y sin el CHECK
  de obligatorio; `uq_docente_cuil` intacto. **Verificar** que `alembic check` sigue
  **reportando** cero diferencias y que el índice del CUIL sigue existiendo en `pg_indexes`.
- [x] 1.4 Actualizar `backend/app/tests/factories.py`: `crear_curso` sin `codigo` ni
  `codigo_norm`, `crear_comision` con `numero` en vez de `codigo`, `crear_docente` con
  `cuil` opcional. **Verificar** que las fábricas arman filas válidas: cualquier test que
  use `crear_curso` tiene que pasar sin tocar el esquema.
- [x] 1.5 Agregar a `backend/app/tests/` el test de la expresión generada. Sembrar con
  `setval('curso_id_seq', 999, false)`: el `false` es lo que hace que el **próximo**
  `nextval` devuelva 999, así que los tres inserts toman 999, 1000 y 1001. Comprobar que los
  códigos son `CUR999`, `CUR1000` y `CUR1001`, los tres distintos. Restaurar la secuencia con
  `setval('curso_id_seq', <last_value>, <is_called>)` en un `finally`, leyendo los **dos**
  valores antes de sembrar: si se restaura con `is_called = true` sobre una secuencia que
  nunca se usó, `last_value` es el valor de arranque y el contador queda corrido en uno.
  **Verificar** que el test pasa **y que la corrida completa de la suite también pasa después
  de él**: en PostgreSQL las secuencias no son transaccionales y un `setval` sobrevive al
  `rollback()` del fixture, así que si no se restaura se rompen tests de otros archivos según
  el orden de ejecución. Este test es la **única** red real de la expresión:
  `alembic check` **ignora las columnas generadas**, así que no la verifica.
  **Verificar también, contra un PostgreSQL real, que la expresión sin `greatest` falla de la
  forma que este test previene**: con `lpad(id::text, 3, '0')`, insertar el id 100 y después
  el id 1000 produce `duplicate key value violates unique constraint` con
  `Key (codigo)=(CUR100) already exists`, porque los dos truncan al mismo código. Si el test
  pasa por el motivo equivocado, esa es la forma de verlo.
- [x] 1.6 Actualizar `backend/app/tests/test_migration.py` **entero**, no con un caso
  suelto: `CHECKS_ESPERADOS` saca `ck_comision_comision_codigo_obligatorio` y
  `ck_docente_docente_cuil_obligatorio` y agrega `ck_comision_numero_positivo`, conservando
  `ck_curso_curso_codigo_obligatorio`; `INDICES_ESPERADOS` saca `uq_curso_codigo_norm` y
  `uq_comision_codigo` y agrega `uq_curso_codigo` y `uq_comision_curso_numero`;
  `test_la_version_de_alembic_queda_registrada` afirma `["0002_altas_catalogo"]`.
  **Verificar** con `pytest app/tests/test_migration.py`.
- [x] 1.7 Reescribir o borrar los tests del modelo que el cambio de contrato invalida
  (`test_curso_sin_codigo_es_rechazado`, `test_codigo_duplicado_por_normalizacion`,
  `test_codigo_de_comision_unico`) y **mantener** `test_nombre_duplicado_por_normalizacion`,
  porque `nombre_norm` sigue siendo lo que mata el duplicado de nombres. Agregar el caso de
  que dos docentes sin CUIL conviven y el de que el CUIL repetido se sigue rechazando.
  **Verificar** con `pytest app/tests/test_catalogo.py app/tests/test_padron.py`.
- [x] 1.8 Arreglar `backend/app/services/seed.py`: buscar al docente por `dni_norm` en
  lugar de por `cuil`, conservando el CUIL de Rita Molina en `CUENTAS_DEMO`. **Verificar**
  con `pytest app/tests/test_seed.py` y con una segunda corrida del seed, que tiene que ser
  idempotente.
- [x] 1.9 Documentar en `docs/decisions.md` el cambio de esquema con **fecha y autor**,
  siguiendo el formato de las entradas existentes. **Verificar** que la entrada existe con
  las dos cosas.

## 2. `feat(api)` — Servicios y endpoints del catálogo y del padrón de docentes

- [x] 2.1 Agregar los esquemas de entrada y salida de cursos en
  `backend/app/schemas/`: el alta admite **solo** `nombre` y `descripcion` opcional, y la
  salida devuelve el curso con su código generado. **Verificar** con `ruff check .` y con
  una prueba que falle si algún campo de código entra en el contrato.
- [x] 2.2 Agregar `GET /cursos` y `POST /cursos`. El nombre se normaliza con
  `nombre_norm` antes de insertar, y un choque se traduce a un error que diga **que el
  nombre está repetido** e identifique el curso existente, no un error genérico de
  integridad. **Verificar** con pruebas del endpoint: alta correcta devuelve el código
  generado, nombre duplicado por normalización se rechaza, nombre vacío se rechaza.
- [x] 2.3 Agregar los esquemas de comisiones: el alta admite `curso_id`, `docente_id`,
  `dias_horarios`, `arancel`, `cupo_maximo`, `modalidad` y `sede_id` opcional, y la salida
  devuelve el **código derivado** armado desde el código del curso y el número.
  **Verificar** con `ruff check .`.
- [x] 2.4 Agregar `GET /comisiones` y `POST /comisiones`. El `docente_id` es obligatorio
  **en el alta** aunque la columna admita nulo; el `numero` es el máximo de ese curso más
  uno; la modalidad que exige sede la cubre `CHECK modalidad_presencial_requiere_sede`; un
  choque de `uq_comision_curso_numero` se traduce a **409**. **Verificar** con pruebas del
  endpoint: alta completa, docente faltante, cupo inválido, arancel inválido, modalidad
  presencial sin sede, y numeración consecutiva dentro del mismo curso.
- [x] 2.5 Agregar los esquemas de docentes: el alta admite `nombre`, `apellido`, `dni`,
  `email` y `telefono` opcional, y **ningún campo de CUIL**. **Verificar** con `ruff
  check .` y con una prueba que falle si el contrato incluye `cuil`.
- [x] 2.6 Agregar `GET /docentes` y `POST /docentes`. El alta crea el `Docente` y el
  `Usuario` con `rol = DOCENTE`, `password_hash = hashear_password('Demo2026!')` y
  `must_change_password = False`, **en una sola transacción**. La unicidad cruzada de mail
  la sigue sosteniendo `ensure_email_available`. **Verificar** con pruebas del endpoint:
  alta exitosa con las dos filas, DNI repetido identificado como DNI, email repetido
  identificado como email, email tomado en el padrón de alumnos rechazado, y que la cuenta
  creada entra a su panel.
- [x] 2.7 Agregar `GET /sedes`, de solo lectura. **Verificar** con una prueba que devuelva
  identificador y nombre de cada sede.
- [x] 2.8 Registrar los routers nuevos en `backend/app/api/router.py`. **Verificar** con
  `pytest app/tests/` completo en verde.
- [x] 2.9 Documentar las formas de entrada y salida reales y los códigos de error en las
  entradas de `docs/decisions.md`, reemplazando la provisoidad que M17 dejó anotada.
  **Verificar** que la entrada nueva existe con fecha y autor y que ya no dice que los
  caminos de `PATHS` son provisionales para estos cuatro recursos.

## 3. `feat(frontend)` — Formularios de alta, `dataService` y el modo real

- [x] 3.1 Cambiar `resolveApiMode()` en `frontend/src/services/dataSourceFactory.js` para
  que `api` sea el valor por defecto, y publicar `VITE_API_MODE: ${VITE_API_MODE:-api}` en
  `docker-compose.yml`. **Verificar** con un test de la fábrica que, sin variable de
  entorno, el modo resuelto es el real.
- [x] 3.2 En `frontend/src/services/apiDataSource.js`, hacer que las **lecturas** caigan al
  datasource de ejemplo **solo** con respuesta 404, y que cualquier otro error se propague.
  **Verificar** con tests de la fuente: 404 devuelve el ejemplo, 500 propaga el fallo.
- [x] 3.3 Dejar explícito en `apiDataSource.js` que **los POST nunca caen**: un alta que no
  llega a la base falla y lo dice, y no escribe en un almacén de memoria. **Verificar** con
  un test que hace fallar el POST y afirma que la pantalla recibe un error y no una
  confirmación.
- [x] 3.4 Agregar a `frontend/src/services/dataService.js` las funciones de las tres altas
  y de la consulta de sedes, con los nombres del dominio en español sin tildes (D19).
  **Verificar** con `npm run lint` y con el test de la frontera de datos.
- [x] 3.5 Agregar a `frontend/src/services/apiDataSource.js` los cuatro endpoints que ya
  existen, y sacar de `PATHS` los que este change define. **Verificar** con un test que
  afirma que la fuente real llama a las rutas del contrato.
- [x] 3.6 Convertir el modal de `frontend/src/admin/CoursesPage.jsx` en un alta real: quitar
  el campo `codigo`, dejar nombre y descripción, y **mostrar el código generado** al
  confirmar. Sacar el aviso de "el maquetado no guarda nada todavía". **Verificar** con los
  tests de la pantalla: alta exitosa muestra el código, alta rechazada muestra el motivo y
  mantiene lo que el operador completó, alta que no llega a la base informa que no se guardó.
- [x] 3.7 Agregar el alta de comisión real al mismo lugar: `docente_id` obligatorio aunque la
  columna admita nulo, la regla de modalidad que exige sede en el formulario —un botón
  deshabilitado taparía el mensaje de error— y la numeración la muestra el código derivado
  que devuelve la API. **Verificar** con los tests de la pantalla.
- [x] 3.8 En `frontend/src/admin/TeachersPage.jsx`, reemplazar la acción sin formulario
  detrás por el formulario real, con nombre, apellido, DNI, email y teléfono, **sin campo de
  CUIL**. **Verificar** con los tests de la pantalla.
- [x] 3.9 Corregir el resumen del catálogo: `obtenerResumenCatalogo()` pide
  `GET /comisiones?resumen=true`, que ningún endpoint define, así que el chip tiene que
  **derivar el total de la lista** en lugar de leer `total_comisiones`. **Verificar** con el
  test de la pantalla del catálogo: el chip muestra la cantidad de comisiones que devolvió la
  lista, y no `undefined`.
- [x] 3.10 Agregar `listarCursos()` a `dataService.js` y a **las dos** implementaciones de
  la frontera (`apiDataSource.js` y `mockDataSource.js`), y **arreglar el selector de curso
  de `CoursesPage.jsx`, que hoy se arma con `comisiones.map((c) => c.curso)`**: eso solo
  ofrece cursos que **ya tienen una comisión**, así que un curso recién creado no puede
  abrirle la primera, que es justamente el flujo que este change habilita. El selector tiene
  que consumir `listarCursos()`. **Verificar** con un test que el selector ofrece un curso
  sin comisiones, que es el caso que hoy no aparece.
- [x] 3.11 Corregir los tres tests de pantalla que hoy **afirman el aviso de que el maquetado
  no guarda nada**, y correr `npm run lint`, `npm run test` y `npm run build`. **Verificar**
  que los tres comandos terminan en cero.

## 4. Decisiones y cierre de pendientes

Esta tarea es explícita y tiene su propia verificación porque el CSV de historias y los
issues del backlog **ya citan D32, D33 y D34**: si no se hace, quedan referencias colgando.

- [x] 4.1 Registrar **D32** en `docs/decisions.md` con fecha y autor, y **textual y
  explícito**: que el código del curso lo genera el sistema y no el operador; que los
  códigos del Excel (`CUR101`, `CUR-101`, `103`) **se descartan a propósito** y no se
  intentan preservar; que las variantes sucias del nombre (`"Curso Python"`,
  `"curso  de  python"`, `"Py 101"`) se resuelven con `nombre_norm` durante la migración del
  Excel, que todavía no está escrita; y la consecuencia de que **cuando se importe el Excel,
  los códigos de las comisiones también se regeneran**, porque sus `curso_id` se resuelven
  por `nombre_norm` y su número sale del orden de aparición en la planilla.
  **Verificar** que la entrada existe, tiene fecha y autor, dice las cuatro cosas, y que la
  cita a D32 del CSV de historias deja de apuntar a la nada.
- [x] 4.2 Registrar **D33** con fecha y autor: el CUIL del docente pasa a ser opcional
  porque en esta fase los docentes no son personas reales y **un CUIL inventado es peor que
  ningún CUIL**. Decir que **revierte D27** y dejar el **alcance del revert explícito**: se
  revierte la obligatoriedad, **no se borra la columna ni el índice**, y la fila de Rita
  Molina conserva su CUIL. **Verificar** que la entrada dice las dos cosas del alcance.
- [x] 4.3 Registrar **D34** con fecha y autor: el código de la comisión es derivado, el
  número es incremental por curso, y la carrera entre dos altas simultáneas la corta el
  índice único que la API traduce a 409, con su techo anotado —a la escala declarada de 10
  comisiones no hace falta secuencia por curso ni lock—. **Verificar** que la entrada nombra
  el techo.
- [x] 4.4 Registrar **D35** con fecha y autor: **todos los montos quedan en pesos
  argentinos**, lo que **cierra el pendiente P4** (había al menos un cobro en dólares en el
  Excel). Anotar que **no hay cambio de código por moneda**: el modelo ya usa
  `Numeric(14, 2)` y la spec `domain-schema` ya lo dice. **Verificar** que P4 sale de la
  tabla de pendientes con su resolución escrita y que D35 dice que no hay cambio de código.
- [x] 4.5 Registrar **D36** con fecha y autor: `api` pasa a ser el modo por defecto, lo que
  **modifica D14**. Lo que no tiene endpoint cae al ejemplo **solo** con 404 y **los POST
  nunca caen**, con la razón de por qué. Anotar su techo: **se borra cuando el shell tenga
  todos sus endpoints**; es un atajo deliberado, no una arquitectura. **Verificar** que la
  entrada nombra el techo y que dice que modifica D14.
- [x] 4.6 Corregir las referencias al modelo viejo que quedaron desactualizadas: el
  docstring de `docs/decisions.md` sobre D27 y los de `app/models/padron.py` y
  `app/services/seed.py` que dicen que el CUIL es obligatorio. **Verificar** con un grep de
  "obligatorio" junto a `cuil` en el repo: no queda ninguno que afirme la obligatoriedad.
- [x] 4.7 Anotar en el README, en la sección del despliegue, que la migración se aplica
  **antes** de desplegar el backend nuevo y el **alcance real del `downgrade`**: sí
  reconstruye los códigos que elimina, pero **falla si hay docentes cargados sin CUIL** y no
  vuelve el texto libre que el operador haya cargado a mano en `comision.codigo`.
  **Verificar** que la sección dice el orden de los tres pasos y el alcance del rollback.
  - *Corregido al ejecutar:* esta tarea decía que el `downgrade` "no recupera los datos de
    las columnas eliminadas". La migración terminada sí los recupera, porque copia el código
    generado a una columna temporal antes de borrarlo. El README y `design.md` describen lo
    que el código hace.