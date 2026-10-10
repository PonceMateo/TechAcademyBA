# Design

## Context

Estado **anterior** al change que condiciona el approach. La motivación está en `proposal.md`;
el comportamiento exigido, en `specs/`. Lo que este change cambia de lo que está descrito acá está
en las decisiones D36, D34 y D33.

- **El frontend no habla con el backend más que para el login.** `resolveApiMode()` en
  `src/services/dataSourceFactory.js` devuelve `mock` salvo que la variable valga `api`,
  y `docker-compose.yml` publica `VITE_API_MODE: ${VITE_API_MODE:-mock}`. La fuente real
  ya existe y ya llama rutas que **no existen todavía** (M17).
- **La frontera ya está donde tiene que estar.** `src/services/dataService.js` es el
  único módulo del que una pantalla saca datos, y la verificación de que ningún componente
  importa `src/mocks/` ya corre (`mocksBoundary.test.js`, M18). Cambiar la fuente es
  cambiar **un** archivo.
- **El esquema está en `0001_initial`, escrita a mano** porque Alembic no emite CHECKs ni
  índices sobre columnas normalizadas (D16). `app/tests/test_migration.py` la compara con
  el metadata mediante `alembic check` y mediante dos listas fijas de nombres.
- **Las pruebas corren contra PostgreSQL real** con una transacción por test que se
  descarta (D15). `conftest.py` corre `downgrade base` y `upgrade head` al inicio de cada
  sesión.
- **Las tres pantallas de alta no escriben.** `CoursesPage.jsx` cierra el modal y avisa que
  el maquetado no guarda nada; `TeachersPage.jsx` muestra la acción sin formulario detrás
  (M20); el formulario de comisión pide un `codigo` que el operador escribe a mano.
- **`docente.cuil` es obligatorio** por D27, y la spec `domain-schema` tiene un escenario
  que dice que el alta sin CUIL se rechaza. D27 vino de derivar el modelo, y el CSV de
  historias nunca pidió CUIL.

## Goals / Non-Goals

**Goals:**

- Que el código del curso y el de la comisión dejen de ser datos que el operador carga, y
  que no puedan quedar desincronizados con la fila que los identifican.
- Que las tres altas lleguen a la base y que la pantalla diga la verdad cuando no llegan.
- Que la caída de `comision.codigo` y `curso.codigo_norm` esté contenida y sea
  reversible con un `downgrade` completo.
- Que la red de seguridad que verifica la expresión generada sea real, no la que ya
  existe y no alcanza.

**Non-Goals (nivel de diseño, no de alcance):**

- No se modela la columna `denominacion` que el criterio de #2 mencionaba. La comisión se
  identifica por su código derivado y el nombre del curso está a un salto: agregarla sería
  desnormalizar un dato que ya se puede leer.
- No se implementan las ediciones (#3, #4, #11), ni la inscripción (#14), ni las vacantes
  en el listado (#6).
- No se escribe la migración del Excel del cliente. Este change solo deja el modelo
  preparado para ella y anota qué pasa con los códigos cuando llegue.
- No se agrega un endpoint de alta de sede: no hay historia que lo pida, solo el listado.

## Decisions

### D1. El código del curso lo genera la base como columna almacenada, no la aplicación

`curso.codigo` pasa a `GENERATED ALWAYS AS (...) STORED`, declarada en el modelo con
`Computed(..., persisted=True)`:

```
'CUR' || lpad(id::text, greatest(3, length(id::text)), '0')
```

**El `greatest` no es cosmético.** `lpad(text, largo, relleno)` **trunca** cuando el
texto ya es más largo que el largo pedido: `lpad('1000', 3, '0')` devuelve `'100'`. Con
la expresión sin `greatest`, el curso con identificador 1000 recibiría `CUR100`, que ya
pertenece al identificador 100, y su alta fallaría contra `uq_curso_codigo` con un error
que no señala la causa. `greatest(3, length(id::text))` mantiene `CUR001` hasta el 999 y
no trunca del 1000 en adelante.

**Por qué la base y no el servicio.** Si el código lo calculara Python al insertar, habría
dos truths —el `DEFAULT` de la migración y la lógica del servicio— que se desincronizan
sin que nada avise. Con la columna generada, el valor es el de la fila por definición y no
se puede mandar en el `INSERT`: PostgreSQL rechaza el `INSERT` que informa `codigo`.

**Alternativas descartadas.** (a) Calcularlo en el servicio con el id que devuelve el
`INSERT`: es el mismo valor en dos caminos y una refactorización futura puede divergir.
(b) Una secuencia propia `curso_codigo_seq`: agregaría un objeto al esquema para producir
un número que el identificador primario ya produce, y obligaría a desalinear la secuencia
con cada restauración.

**El número sale del identificador de la fila**, que es autoincremental y nunca se
reutiliza: dos cursos no pueden recibir el mismo código.

### D2. `curso.codigo_norm` se elimina y `no_vacio("codigo", ...)` se conserva

Un valor generado no tiene dos representaciones que puedan diferir, así que la columna
normalizada y su índice son ruido: solo agregaban una superficie donde el `INSERT` podría
escribir una forma y dejar la otra desincronizada. El índice único pasa a
`uq_curso_codigo`.

El CHECK `curso_codigo_obligatorio` **se conserva** aunque la expresión no pueda producir
una cadena vacía: forma parte del conjunto de obligatorios que declara M4 y que
`test_migration.py` verifica uno por uno. Sobrar no cuesta nada; faltaría, alguien lo
sacaría de la lista sin darse cuenta de que estaba dejando la regla coja.

### D3. `comision.codigo` desaparece y queda `numero`, con el código como valor derivado

La caída de la columna está contenida: **`ninguna tabla referencia `comision.codigo` por
clave foránea`**. Las tres claves foráneas que apuntan a la comisión apuntan a su
identificador, no a su código: `clase.comision_id`, `inscripcion.comision_id` y
`contrato_corporativo.comision_id`. `asistencia` llega a la comisión por `clase_id`, y
`cobranza` no la referencia en absoluto: se apoya en `alumno_id`, `empresa_id` y
`pagador_id`. Lo affected es el modelo, la factory de pruebas, un test del modelo y el
serializador.

Lo que entra:

- `numero: Integer NOT NULL`, con `CheckConstraint(numero > 0, name="ck_comision_numero_positivo")`.
- `UniqueConstraint("curso_id", "numero", name="uq_comision_curso_numero")`.
- Se elimina `uq_comision_codigo` y `ck_comision_comision_codigo_obligatorio`.

El código derivado `{curso.codigo}-{numero}` (`CUR001-1`) **vive como propiedad en el ORM**
y se arma en el serializador. No es una columna porque no hay nada que el operador escriba
ni nada que pueda quedar viejo: si el curso cambiara de código, el derivado cambiaría solo.

**`numero` es incremental por curso**: el máximo de los números de ese curso más uno.
Lleva por `(curso_id, numero)` y no global, porque el código derivado ya incluye el curso:
dos cursos distintos pueden tener ambos el número 1 sin colisionar.

**Por qué `nombre` de la columna y no un contador en `curso`:** un contador persistido se
desincroniza apenas alguien borre o migre una fila. El máximo por consulta es una
derivación, que es el criterio de D10.

### D4. La carrera entre dos altas simultáneas la corta el índice único, y la API la traduce a 409

Dos altas concurrentes del mismo curso pueden calcular el mismo `numero`. El índice único
`uq_comision_curso_numero` es lo que corta la carrera: una de las dos transacciones falla
con `IntegrityError` y la API responde 409.

**Techo asumido:** a la escala declarada del proyecto (10 comisiones, D10) **no hace falta
una secuencia por curso ni un lock**. Si el volumen de altas simultáneas de comisiones
llegara a importar, el arreglo es un `SELECT ... MAX(numero) ... FOR UPDATE` sobre el
curso —el mismo patrón que D8 usa con la cobranza—, y ese cambio no toca el contrato.
Queda anotado como atajo deliberado, no como arquitectura.

### D5. `docente.cuil` deja de ser obligatorio, y el índice único se queda

`DROP NOT NULL` y se elimina `ck_docente_docente_cuil_obligatorio`. `uq_docente_cuil`
**se conserva**: PostgreSQL admite varios nulos en un índice único, así que el índice no
estorba mientras los docentes no tengan CUIL y sigue sosteniendo la unicidad en cuanto
empiecen a tenerlo.

**Motivo:** en esta fase los docentes no son personas reales, así que **un CUIL inventado
es peor que ningún CUIL**. Un `27-34567890-7` fabricado no identifica a nadie y después
hay que ir a corregirlo. La columna queda para completarla cuando haya docentes reales.

**Alcance del revert de D27, explícito:** se revierte **la obligatoriedad**. No se borra
la columna ni el índice, y la fila de Rita Molina **conserva su CUIL** en `CUENTAS_DEMO`.

**Consecuencia en el seed:** `app/services/seed.py` buscaba al docente por `cuil`, que era
único y obligatorio. Pasa a buscar por `dni_norm`, que sigue siendo único, obligatorio y lo
tiene la fila de ejemplo.

**La spec hadrá que cambiar** el escenario "Docente sin CUIL → el sistema rechaza el alta".
Es la contradicción directa de D27 y por eso este change la modifica.

### D6. Las tres altas crean lo que tienen que crear, y el frontend deja de mentir

- `VITE_API_MODE` pasa a tener `api` por defecto y `docker-compose.yml` lo publica.
- Lo que **todavía no tiene endpoint** —dashboard, alumnos, cobranzas, habilitación— cae
  al datasource de ejemplo **cuando la respuesta es 404**.
- **Los POST nunca caen.** Un alta que no llega a la base falla y lo dice. Es la diferencia
  entre una demo que miente y una demo honesta.

**Por qué solo 404 y no "cualquier error":** un error de red o un 500 disfrazado de dato
válido hace creer que la pantalla funciona. La ausencia de endpoint es el único caso en el
que el ejemplo es una respuesta honesta.

**Por qué los POST no caen:** un POST que cae escribe en un array de memoria. La pantalla
confirmaría un alta que no existe, y el operador se va creyendo que el sistema guarda.

**Techo asumido:** la caída al ejemplo **se borra cuando el shell tenga todos sus
endpoints**. Es un atajo deliberado. `docs/decisions.md` lo registra como D36 modificando
D14.

### D7. El alta de docente crea dos filas en una sola transacción

`POST /docentes` crea el `Docente` y el `Usuario` con `rol = DOCENTE` en la misma
transacción, con `password_hash = hashear_password('Demo2026!')` y
`must_change_password = False`.

**Por qué `must_change_password = False`:** decisión de esta fase, coherente con D18. El
flujo de cambio de contraseña **no existe**, así que marcar la cuenta como pendiente manda
al docente a un cartel que dice exactamente que el flujo todavía no está disponible
(`AvisoCambioContrasena.jsx`). Una cuenta creada por la secretaría con una contraseña que
la secretaría conoce no necesita cambiarla. **Cuando exista el flujo, esto se revierte** y
la cuenta nace con el indicador en `true`, como dice el modelo.

**Por qué una sola transacción:** una cuenta sin docente es un estado que el CHECK
`rol_vinculo_coherente` impide, y un docente sin cuenta no cumple el criterio de #9 ("el
docente se crea con acceso por su mail"). O las dos cosas quedan o no queda ninguna.

**El CUIL no está en el contrato de entrada.** La columna existe, el contrato no la pide.

### D8. El rechazo de duplicados dice cuál de los dos datos se repitió

Los criterios de #1 y #9 piden saber qué colisionó, no solo que algo colisionó. El
`IntegrityError` de PostgreSQL trae el nombre de la restricción, así que el servicio
traduce: `uq_curso_nombre_norm` → nombre repetido; `uq_docente_dni_norm` → DNI repetido;
`uq_docente_email` → email repetido. La unicidad cruzada entre padrones ya existe y ya dice
en qué padrón está (`ensure_email_available` en `app/services/emails.py`).

### D9. `alembic check` NO verifica la expresión generada — y hay que decirlo

`test_la_migracion_escrita_a_mano_cuadra_con_los_modelos` corre `alembic check`, y esa
comparación **ignora las columnas generadas**. Si el `Computed(...)` del modelo y el
`GENERATED ALWAYS AS ... STORED` de la migración se desincronizan —mismo nombre de
columna, distinta expresión—, `alembic check` sigue en verde.

**Por eso el test de `lpad` es obligatorio y es la única red real:** insertar cursos con
identificadores 999, 1000 y 1001 y comprobar que los tres códigos son distintos y son
`CUR999`, `CUR1000`, `CUR1001`. **Nadie debe confiar en `alembic check` para esto**, y el
change lo dice explícitamente para que la próxima persona no lo tome como cobertura.

### D10. El test de `setval` tiene que restaurar la secuencia en un `finally`

En PostgreSQL **las secuencias no son transaccionales**: un `setval` sobrevive al
`rollback()` del fixture `db_session`. Sin restaurar, la secuencia queda corrida y rompe
cualquier otro test que afirme un código exacto, según el orden de ejecución —un fallo que
aparece en otro archivo, en otra corrida, y que parece no tener relación.

El test:

1. Lee **`last_value` y `is_called`** de `curso_id_seq` antes de tocarlo.
2. Hace `setval` para sembrar los identificadores 999, 1000 y 1001.
3. Inserta y comprueba los tres códigos.
4. En un `finally`, restaura con `setval('curso_id_seq', <last_value>, <is_called>)`.

El paso 4 tiene que llevar **los dos** valores. Si se restaura con `is_called = true`
sobre una secuencia que nunca se usó, el contador queda corrido en uno y el próximo
identificador salta un valor. El paso 1 existe por lo mismo: sin leer `is_called` no se
puede saber qué argumento pasar.

### D11. `test_migration.py` se actualiza entero, no se le agrega un caso

El archivo tiene listas fijas: `CHECKS_ESPERADOS`, `INDICES_ESPERADOS` y
`test_la_version_de_alembic_queda_registrada`. Todo eso lo rompe este change, y
`CHECKS_ESPERADOS` es una diferencia de conjuntos contra `pg_constraint`: si se deja una
entrada que ya no existe, el test falla por un nombre que nadie va a buscar. Por eso se
actualiza entero:

- `CHECKS_ESPERADOS`: salen `ck_comision_comision_codigo_obligatorio` y
  `ck_docente_docente_cuil_obligatorio`, entra `ck_comision_numero_positivo`.
  `ck_curso_curso_codigo_obligatorio` **queda** (D2).
- `INDICES_ESPERADOS`: salen `uq_curso_codigo_norm` y `uq_comision_codigo`, entran
  `uq_curso_codigo` y `uq_comision_curso_numero`.
- `test_la_version_de_alembic_queda_registrada` pasa a afirmar `["0002_altas_catalogo"]`.
- Los tests del modelo que el cambio de contrato invalida
  (`test_curso_sin_codigo_es_rechazado`, `test_codigo_duplicado_por_normalizacion`,
  `test_codigo_de_comision_unico`) se reescriben o se borran. El de **nombre** duplicado
  **se mantiene**: `nombre_norm` sigue siendo lo que mata el duplicado de nombres.

**El `downgrade` tiene que funcionar completo**, porque `conftest.py` aplica
`downgrade base` y `upgrade head` al inicio de cada sesión: la migración nueva se exercise
en cada corrida de la suite, y un `downgrade` a medias deja la base de pruebas sucia
entre corridas.

### D12. D32 tiene que decir, textual y explícito, cuatro cosas

Se registra en `docs/decisions.md` antes de aplicar el cambio, con fecha y autor:

1. El código del curso lo genera el sistema, **no el operador**.
2. Los códigos que trae el Excel del cliente (`CUR101`, `CUR-101`, `103`, etc.) **se
   descartan a propósito** y no se intentan preservar.
3. Las variantes sucias del nombre (`"Curso Python"`, `"curso  de  python"`, `"Py 101"`)
   se resuelven con `nombre_norm` durante la migración del Excel, que todavía no está
   escrita.
4. La consecuencia que hay que dejar anotada: **cuando se importe el Excel, los códigos de
   las comisiones también se regeneran**, porque sus `curso_id` se resuelven por
   `nombre_norm` y su número sale del orden de aparición en la planilla.

**El Excel es el problema, no la solución.** Un código que el sistema genera no se preserva
para acomodarse a una planilla que el proyecto quiere reemplazar.

### D13. D33 revierte D27, con el alcance del revert escrito

**Se revierte la obligatoriedad del CUIL. No se borra la columna ni el índice.** Es la
diferencia entre revertir una decisión y borrar su rastro: la columna queda porque el
instituto liquida con ella y va a hacer falta apenas haya docentes reales.

### D14. D35 cierra el pendiente P4 y no toca una línea de código

**Todos los montos quedan en pesos argentinos.** El modelo ya usa `Numeric(14, 2)` y la
spec `domain-schema` ya dice pesos argentinos en "Convenciones transversales del esquema".
No hay cambio de código: lo que cambia es que el pendiente P4 —"hay al menos un cobro en
dólares y el modelo asume pesos argentinos"— **se cierra y queda escrito**, con la
constancia de que se resolvió a favor del modelo y no al revés.

### D15. El resumen del catálogo se deriva de la lista, no de un campo que la API no manda

`obtenerResumenCatalogo()` pide `GET /comisiones?resumen=true`, un parámetro que ningún
endpoint de este change define. Con la fuente real, la respuesta es la lista de
comisiones, así que el chip de la pantalla tiene que **derivar el total de la lista** en
lugar de leer `total_comisiones`. La pantalla que hoy espera ese campo mostraría
`undefined`, y hay que corregirlo en el work unit del frontend.

### D16. Dos escenarios conservan su nombre viejo, y el cuerpo dice qué pasó

`openspec validate --strict` rechaza un bloque `MODIFIED` que **quite** un escenario que
la spec actual tiene: un `MODIFIED` reemplaza el bloque entero, así que al archivar el
escenario se perdería en silencio. La herramienta obliga a pasar uno por uno por cada
escenario existente.

Dos de esos escenarios cambiaron de comportamiento y por eso **conservan su nombre
original con el cuerpo nuevo**:

- `Código o nombre duplicado por normalización` (en `domain-schema`): la mitad que habla
  del código ya no puede ocurrir, porque el código dejó de ser un dato de entrada. El
  cuerpo lo dice con un `AND` explícito en vez de dejar el nombre mintiendo.
- `Solo el login es real` (en `dev-infrastructure`): describe lo que era cierto hasta este
  change. El cuerpo afirma lo nuevo y aclara que el nombre quedó como registro de la
  diferencia.

La alternativa era `REMOVED Requirements` y volver a `ADDED`, que pierde el rastro de qué
escenario cambió y por qué.

## Risks / Trade-offs

- **[El `Computed(...)` del modelo y el `GENERATED ALWAYS AS` de la migración se
  desincronizan y `alembic check` sigue en verde]** → el test de `setval` es la red real
  (D9), y este design lo dice para que no se confíe en la otra.
- **[El `setval` sobrevive al rollback del fixture y rompe tests de otros archivos en
  otra corrida]** → restaurar `last_value` **e** `is_called` en un `finally` (D10).
- **[La migración elimina columnas y no hay vuelta atrás salvo un respaldo]** → aplicar
  **antes** de desplegar el backend nuevo, con el respaldo tomado; ver *Migration Plan*.
- **[La caída al ejemplo en 404 oculta que un endpoint falta de verdad]** → solo 404 cae,
  cualquier otro error se propaga, y los POST nunca caen (D6). Es un atajo con fecha de
  repaso: se borra cuando el shell tenga todos sus endpoints.
- **[Los códigos que el cliente ya conoce cambian]** → es intencional (D12). El Excel es
  el problema, y la convención `CUR001` se lo anuncia al operador.
- **[Dos altas simultáneas de comisión sacan el mismo `numero`]** → `uq_comision_curso_numero`
  y un 409. A la escala declarada no hace falta nada más (D4).
- **[Un docente dado de alta queda con una contraseña conocida por la secretaría y sin
  cambio pendiente]** → coherente con D18; cuando exista el flujo de cambio de contraseña
  se revierte a `must_change_password = true`.
- **[`GET /comisiones?resumen=true` no lo define nadie]** → la pantalla deriva el total de
  la lista (D15).
- **[La suite de pruebas se pone lenta o se rompe por el orden de ejecución]** → se
  verifica la suite completa, en el orden que el runner use, y no solo el archivo tocado.

## Migration Plan

La migración se llama **`0002_altas_catalogo`**, con `down_revision = "0001_initial"`, y es
escrita a mano como la primera (D16): Alembic no emite CHECKs ni índices sobre columnas
normalizadas, y acá además hay una columna generada y una caída de columna.

`upgrade`:

1. `curso.codigo` pasa a generada y almacenada. `curso.codigo_norm` se elimina con su
   índice. Se crea `uq_curso_codigo`.
2. `comision.numero` entra `NOT NULL`; `comision.codigo` y su CHECK se eliminan. Se crea
   `ck_comision_numero_positivo` y `uq_comision_curso_numero`, y se elimina
   `uq_comision_codigo`.
3. `docente.cuil` deja de ser `NOT NULL` y se elimina `ck_docente_docente_cuil_obligatorio`.
   `uq_docente_cuil` **no se toca**.

`downgrade` invierte los tres pasos y **tiene que dejar el esquema como estaba**, porque
`conftest.py` lo corre en cada sesión.

### Orden de despliegue

La migración **elimina columnas** (`curso.codigo_norm`, `comision.codigo`) y relaja una
(`docente.cuil`). El backend nuevo escribe `curso.codigo` como columna generada y lee
`comision.numero`:

1. **Respaldar la base.**
2. **Aplicar `0002_altas_catalogo`.** Antes de desplegar el backend nuevo, **no junto con
   él**: el backend viejo sigue escribiendo `curso.codigo_norm` y `comision.codigo`, y si
   la migración se aplicara después del despliegue, el backend viejo fallaría contra un
   esquema donde esas columnas ya no están.
3. **Desplegar el backend nuevo.**
4. **Desplegar el frontend con el modo real.** Los tres formularios pasan a escribir
   contra la base.

**Rollback:** `downgrade` de la migración y vuelta al backend anterior. El `downgrade`
**sí reconstruye los códigos que la migración elimina**: copia `curso.codigo` a una
columna temporal antes de soltar la generada, y recompone `comision.codigo` como
`{curso.codigo}-{numero}` antes de soltar `numero`. El respaldo sigue siendo el límite
real, pero por dos razones que no son "se perdieron los datos":

- **`docente.cuil` vuelve a `NOT NULL` y la migración falla si hay docentes cargados sin
  CUIL.** Es lo correcto: una restricción que los datos incumplen no se puede restaurar,
  y quien intente volver atrás tiene que resolverlo antes.
- **Lo único que no vuelve es el texto libre que el operador hubiera cargado a mano en
  `comision.codigo`**: en el esquema viejo era un dato libre y queda reemplazado por el
  derivado. Además `numero` **no se deduce del sufijo del código viejo** sino del orden de
  inserción dentro de cada curso, así que el número asignado puede no ser el que tenía la
  fila.

## Open Questions

- **El listado de docentes devuelve "la cantidad de comisiones asignadas"**: es una
  derivación por consulta, consistente con D10, y la pantalla ya muestra ese dato. No
  bloquea: se resuelve con un `COUNT` agrupado en la consulta de lectura, que es
  implementación y no contrato.
- **Cuando exista la historia #13 (alta de alumno), el mismo patrón de "dos filas en una
  transacción" aplica y la contraseña de la cuenta del alumno tiene su propia decisión.**
  No cambia nada de este change: es la historia de alta de alumno la que lo decide.