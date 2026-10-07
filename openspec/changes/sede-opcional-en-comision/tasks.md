# Tasks

**Trazabilidad del pull request: `Refs #8`. Nunca `Closes`.** La #8 sigue abierta porque este
change no le cierra los criterios de edición (#3 y #4).

**El modelo y la migración entran en el mismo commit.** `alembic check` corre dentro de
`test_la_migracion_escrita_a_mano_cuadra_con_los_modelos`, así que separados la suite queda roja
por una diferencia que no nombra el archivo culpable. Un work unit, un commit.

Cada grupo deja sus propios tests y su documentación. Los grupos 1 y 3 están atados por
dependencia; el frontend no depende del backend y puede ir en paralelo.

## 1. `fix(catalogo)` — CHECK invertido y migración `0003_sede_opcional_comision`

- [x] 1.1 En `backend/app/models/catalogo.py` (~137-141), sacar
  `CheckConstraint("modalidad = 'VIRTUAL' OR sede_id IS NOT NULL", name="modalidad_presencial_requiere_sede")`
  y poner `CheckConstraint("modalidad <> 'VIRTUAL' OR sede_id IS NULL", name="modalidad_virtual_sin_sede")`;
  reescribir el comentario `# Historia #8:` que dice que Presencial e Híbrido exigen sede.
  **Verificar** acá no con `alembic check`: al correr esta tarea la migración `0003` de 1.2 todavía
  no existe, así que `alembic check` **tiene** que reportar una diferencia —el CHECK nuevo del
  modelo contra el `modalidad_presencial_requiere_sede` de la base—, y reportarla es lo correcto.
  La verificación de sincronía va en **1.4**, con modelo y migración ya en el mismo commit.
- [x] 1.2 Crear `backend/alembic/versions/0003_sede_opcional_comision.py` con
  `revision = "0003_sede_opcional_comision"`, `down_revision = "0002_altas_catalogo"`, y el `upgrade()`
  en tres pasos en este orden: `op.drop_constraint("ck_comision_modalidad_presencial_requiere_sede",
  "comision", type_="check")`, `op.execute("UPDATE comision SET sede_id = NULL WHERE modalidad =
  'VIRTUAL'")` y `op.create_check_constraint("ck_comision_modalidad_virtual_sin_sede", "comision",
  "modalidad <> 'VIRTUAL' OR sede_id IS NULL")`. **Verificar** con `alembic upgrade head` contra una
  base que tenga una comisión `VIRTUAL` con `sede_id` asignado: el `upgrade` tiene que terminar en
  cero y la fila quedar con `sede_id` en `NULL`. Si el `UPDATE` no estuviera, ese mismo comando
  revienta con el `create_check_constraint`.
- [x] 1.3 En la misma migración, escribir el `downgrade()` al revés —baja el CHECK nuevo y restaura
  `ck_comision_modalidad_presencial_requiere_sede`— y un docstring largo al estilo de
  `0002_altas_catalogo.py` que diga **por qué** el `UPDATE` va entre el `drop` y el `create`, que
  **no** hay ningún `UPDATE` que deshaga ese, y que el `downgrade` **falla** si quedan comisiones
  presenciales sin sede en vez de rellenar sedes inventadas. **Verificar** con `alembic upgrade head`
  y `alembic downgrade 0002_altas_catalogo` los dos en cero, porque `conftest.py` corre `downgrade
  base` y `upgrade head` al inicio de cada sesión y un `downgrade` a medias ensucia la base de
  pruebas entre corridas. La ausencia del `UPDATE` contrario es deliberada y está anotada en el
  **Migration Plan** del `design.md`; ver 7.5.
- [x] 1.4 Con el modelo de 1.1 y la migración de 1.2 y 1.3 ya en el mismo commit, **verificar** con
  `alembic check` reportando **cero** diferencias entre la migración y los modelos, o sea que no
  queda nada que sincronizar. Este es el primer momento en que esa verificación es posible: antes
  de que exista `0003`, modelo y base discrepan a propósito.

## 2. `docs(catalogo)` — Docstrings que nombran la regla vieja

Sin cambio de comportamiento: la regla vive en un solo lugar y estos textos la describen.

- [x] 2.1 En `backend/app/api/catalogo.py` (~96-98), el docstring de `crear_comision`: sacar del
  422 la frase «si la modalidad exige sede y no vino» y dejar el 422 de virtual con sede. **Verificar**
  con un grep de `exige sede` en `backend/app/`: no queda ninguno que afirme la obligatoriedad.
- [x] 2.2 En `backend/app/api/catalogo.py` (~138-144), el docstring de `_regla_de_alta_rota`:
  cambiar la lista de CHECK de `comision` para que nombre la regla nueva. **Verificar** leyendo el
  docstring contra `Comision.__table_args__`: los tres CHECK que nombra existen con esos nombres.
- [x] 2.3 En `backend/app/services/catalogo.py` (~145-149 y ~178-181), el docstring de
  `crear_comision` y el comentario que sigue al `except IntegrityError`: sacar «sede obligatoria para
  Presencial e Híbrido» y el nombre `modalidad_presencial_requiere_sede`. **Verificar** con `grep -rn
  modalidad_presencial_requiere_sede backend/` acotado a lo que no sea historial: quedan exactamente
  **dos** ocurrencias del nombre viejo, las dos dentro de `0003_sede_opcional_comision.py` —el
  `drop_constraint` del `upgrade()` y el `create_check_constraint` del `downgrade()` de 1.3, que es
  donde el nombre viejo tiene que sobrevivir porque es el que se restaura—. Ninguna en `app/`. Del
  nombre nuevo quedan el `CheckConstraint` del modelo y el `create_check_constraint` del `upgrade()`,
  y no el viejo.
- [x] 2.4 En `backend/app/schemas/catalogo.py` (~73-75), el docstring de `ComisionCreate`: decir que
  `sede_id` es opcional en **toda** modalidad y que solo se acepta cuando la modalidad no es Virtual.
  **Verificar** que el campo sigue siendo `int | None` y sin validador de modalidad: la regla no se
  duplica en Pydantic.

## 3. `test(catalogo)` — Tests de backend sobre la regla nueva

Depende del grupo 1: los asserts nombran el CHECK nuevo y la versión `0003`.

- [x] 3.1 En `backend/app/tests/test_migration.py`, sacar
  `ck_comision_modalidad_presencial_requiere_sede` de `CHECKS_ESPERADOS` (~51) y agregar
  `ck_comision_modalidad_virtual_sin_sede`. **Verificar** con
  `pytest app/tests/test_migration.py`: si la migración no hubiera creado el CHECK, el conjunto
  comparado no coincide y el assert del nombre dice cuál falta.
- [x] 3.2 En el mismo archivo (~145), cambiar `versiones == ["0002_altas_catalogo"]` por
  `["0003_sede_opcional_comision"]`. **Verificar** con
  `pytest app/tests/test_migration.py::test_la_version_de_alembic_queda_registrada`.
- [x] 3.3 En `backend/app/tests/test_altas_api.py` (~244-265), invertir
  `test_modalidad_que_exige_sede_sin_sede_es_rechazada`: sobre el parametrize de `PRESENCIAL` y
  `HIBRIDO`, ahora espera `201` y `sede_id is None` en la respuesta. **Verificar** con
  `pytest app/tests/test_altas_api.py -k sede` sobre PostgreSQL real: los dos casos del parametrize
  en verde.
- [x] 3.4 En el mismo archivo, agregar el caso nuevo: `POST /comisiones` con `modalidad: VIRTUAL` y
  un `sede_id` válido. **Verificar** con el test afirmando `422` **y** que el texto de la respuesta
  trae `ck_comision_modalidad_virtual_sin_sede`, que es lo que lo prueba como origen: sale del
  `IntegrityError` que traduce `_regla_de_alta_rota`, no de un validador.
- [x] 3.5 En `backend/app/tests/test_catalogo.py` (~144-152), invertir
  `test_modalidad_presencial_u_hibrida_sin_sede_es_rechazada`: crear la comisión con
  `con_sede=False` y afirmar que persiste con `sede_id is None`. **Verificar** con
  `pytest app/tests/test_catalogo.py -k sede`.
- [x] 3.6 En el mismo archivo, agregar la contraparte del servicio: `crear_comision` con
  `modalidad=Modalidad.VIRTUAL.value` y `con_sede=True` levanta `IntegrityError` cuyo motivo trae
  `ck_comision_modalidad_virtual_sin_sede`, con `assert_rechazado`. **Verificar** con
  `pytest app/tests/test_catalogo.py -k sede`: es el test que cubre la regla en la capa que la
  escribe, sin pasar por la ruta.
- [x] 3.7 En `backend/app/tests/factories.py` (~113-115), corregir el docstring de `con_sede=False`,
  que hoy dice que la modalidad presencial sin sede tiene que ser rechazada por la base.
  **Verificar** que el docstring dice para qué existe el parámetro ahora.
- [x] 3.8 Correr `pytest app/tests/` completo. **Verificar** que termina en cero: el CHECK nuevo no
  puede romper ningún otro test, y si aparece uno que armaba una comisión virtual con sede, el
  nombre del CHECK aparece en el motivo del fallo.

## 4. `feat(frontend)` — `mostrarSede` y el `sede_id` derivado

- [x] 4.1 En `frontend/src/admin/CoursesPage.jsx` (~172), renombrar `exigeSede` a `mostrarSede`,
  dejando la misma prueba de dos ramas. **Verificar** con `npm run lint` y con los tests de la
  pantalla: el nombre viejo no queda en el archivo.
- [x] 4.2 En el mismo archivo, borrar la rama `else if (campos.sede === '' && exigeSede)` de
  `validar()` (~229-233). **Verificar** con el test de 5.2: guardar sin sede no muestra error de
  formulario.
- [x] 4.3 En el mismo archivo (~265), armar el payload como
  `sede_id: mostrarSede && campos.sede !== '' ? Number(campos.sede) : null`. **Verificar** con un test
  que elige `Presencial`, elige una sede, cambia a `Virtual` y guarda: el `crearComision` recibe
  `sede_id: null`. Es el caso que la expresión derivada cubre y el `onChange` de modalidad no.
- [x] 4.4 En el mismo archivo (~480), envolver el `Campo` de `Sede` en `{mostrarSede && …}` y sacarle
  `obligatorio`. **Verificar** con el test de 5.1: el rótulo `Sede` no está entre las etiquetas del
  modal recién abierto, porque la modalidad arranca en `Seleccionar…`.
- [x] 4.5 En el docstring del componente (~38-41), corregir el párrafo que dice que `Sede` es
  obligatoria para `Presencial` y `Híbrido` y que es el CHECK `modalidad_presencial_requiere_sede`.
  **Verificar** con `grep -rn modalidad_presencial_requiere_sede frontend/`: no queda ninguno.

## 5. `test(frontend)` — Tests de pantalla y título del test de mocks

- [x] 5.1 En `frontend/src/admin/CoursesPage.test.jsx` (~295-322), sacar `'Sede'` del `toEqual` del
  test de orden de campos y agregar en ese mismo test
  `expect(screen.queryByLabelText(/^Sede/)).not.toBeInTheDocument()`. **Verificar** con `npm run
  test`: es la aserción negativa la que puede fallar, no el `toEqual` —como `Sede` no está en el
  patrón de `getAllByText`, el rótulo se filtra y el orden daría igual con el campo renderizado—. Ver
  7.1.
- [x] 5.2 En el mismo archivo (~355-378), invertir los dos tests de rechazo —presencial y
  híbrida— a «guarda la comisión»: el modal se cierra y aparece el aviso con el código derivado.
  **Verificar** con `npm run test`: los dos en verde sin el mensaje «El campo Sede es obligatorio…».
- [x] 5.3 En el mismo archivo (~380), dejar el test de modalidad virtual como está y agregar el que
  afirma que con `Virtual` el campo `Sede` no está en el documento. **Verificar** con
  `queryByLabelText(/^Sede/)` en `null` después de elegir la modalidad.
- [x] 5.4 En `frontend/src/mocks/mocks.test.js` (~144), renombrar el test que dice «como la exige el
  CHECK del modelo» y corregir su comentario: lo que verifica es que las cinco comisiones del
  ejemplo son `PRESENCIAL` con una sede que existe en el catálogo `SEDES`. **Verificar** con
  `npm run test`: la aserción no cambia, solo el nombre que la nombraba.
- [x] 5.5 Correr `npm run lint`, `npm run test` y `npm run build`. **Verificar** que los tres
  terminan en cero.

## 6. `docs` — CSV, glosario y decisiones

Al último, para que la decisión cite lo que se construyó.

- [x] 6.1 En `docs/requirements/Historias_de_Usuario_TechAcademy_BA.csv` (historia #8, ~84), reescribir
  el criterio de aceptación del escenario «Modalidad presencial o híbrida»: ya no rechaza el guardado
  ni pide seleccionar una sede. **Verificar** con `grep -n "solicita seleccionar una sede"` sobre el
  CSV: no queda ninguna ocurrencia.
- [x] 6.2 En `docs/glossary.md` (~26), corregir la fila de **Sede**, que dice «Es obligatoria para toda
  comisión que no sea virtual». **Verificar** que la fila dice que es opcional en toda modalidad.
- [x] 6.3 Agregar **M35** en `docs/decisions.md` con **fecha y autor**, siguiendo el formato de las
  entradas existentes: que la sede es opcional en toda modalidad y que la regla se invirtió en el
  CHECK (`modalidad_virtual_sin_sede`) en lugar de desaparecer, que la migración `0003` pone en
  `NULL` la sede de las comisiones virtuales porque es el dato que el CHECK nuevo prohíbe, y que el
  `422` de virtual con sede sale del `IntegrityError` por `_regla_de_alta_rota`. **Verificar** que el
  encabezado es `### M35 —` y que tiene fecha y autor; el número se ubica **después de M34** (~437),
  no al final del archivo: `M32` figura en la sección anterior y el archivo no está ordenado por
  número.
- [x] 6.4 Corregir en el sitio la frase de **M33** (~426) que dice que hay `422` «si la modalidad exige
  sede y no vino». **Verificar** con `grep -n "modalidad exige sede" docs/decisions.md`: no queda
  ninguna, y M33 sigue diciendo que el `sede_id` del alta de comisión es opcional.

## 7. Correcciones de verify

Lo que encontró la pasada de verificación después de los grupos anteriores. Ninguna cambia
comportamiento: un test que no podía fallar, dos textos que afirmaban la regla vieja y el registro de
una desviación deliberada.

- [x] 7.1 (W2) El test de orden de campos **no podía fallar**: con `Sede` fuera del patrón de
  `getAllByText` el rótulo se filtraba y el `toEqual` daba verde aunque el campo se renderizara. Se
  agregó `expect(screen.queryByLabelText(/^Sede/)).not.toBeInTheDocument()` en el mismo test, que sí
  falla si aparece. **Verificar** con `npm run test`: el escenario «abre con los campos en el orden
  del spec» tiene una aserción que se puede romper.
- [x] 7.2 (W3) El docstring de `test_altas_api.py` decía que «presencial sin sede se rechaza», falso
  desde `f7c245e`: el mismo archivo afirma `201`. Reescrito para decir que la presencial y la
  híbrida sin sede **se registran** y que la que se rechaza es la virtual **con** sede. **Verificar**
  con `pytest app/tests/test_altas_api.py`: el docstring nombra las dos mitades.
- [x] 7.3 (S1) `errores.sede` ya no lo setea nadie —la rama de validación de 4.2 se borró—, así que el
  `error` del `Campo` de `Sede` era `undefined ?? null`, siempre `null`. Se sacó el prop. **Verificar**
  con `grep -rn "errores.sede" frontend/src`: no queda ninguna ocurrencia.
- [x] 7.4 (S2) El docstring de `Comision.sede_nombre` decía que el `None` es el de una comisión
  virtual; bajo la regla nueva también —y sobre todo— es el de una presencial o híbrida sin sede.
  Reescrito para decir qué produce el `None`. **Verificar** leyendo el docstring contra el CHECK
  `modalidad_virtual_sin_sede`.
- [x] 7.5 (S3) La tarea 1.3 pedía un `UPDATE` contrario en el `downgrade` que nunca se escribió, y
  archivarla habría dejado el registro diciendo que sí. La omisión era correcta —decisión 4— y ahora
  está anotada en la tarea y en el **Migration Plan** del `design.md`. **Verificar** con
  `openspec validate sede-opcional-en-comision --strict`.