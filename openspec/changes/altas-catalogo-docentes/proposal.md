# Proposal

## Why

Las tres altas del catálogo —curso, comisión y docente— **no se pueden hacer hoy**: no
tienen endpoint, el frontend corre con `VITE_API_MODE=mock` y los tres formularios
muestran un aviso de que el maquetado no guarda nada. Además, el esquema obliga al
operador a **cargar a mano los códigos** que el cliente ya pidió que los genere el
sistema, y le exige el CUIL del docente, un dato que el CSV de historias nunca pidió y que
en esta fase nadie tiene.

Son las historias #1, #2 y #9, con los criterios de #5 (cupo) y #8 (modalidad y sede)
dentro del mismo formulario de #2, porque son campos de la misma pantalla.

## What Changes

Es un **BREAKING** sobre el esquema y **BREAKING** sobre la spec `domain-schema`.

1. **`curso.codigo` pasa a ser generado por la base (BREAKING).** La columna pasa a
   `GENERATED ALWAYS AS ('CUR' || lpad(id::text, greatest(3, length(id::text)), '0')) STORED`
   y el modelo la declara con `Computed(..., persisted=True)`. Se elimina `codigo_norm`: un
   valor generado no tiene dos formas que puedan diferir. El índice único pasa de
   `uq_curso_codigo_norm` a `uq_curso_codigo`. El operador deja de escribir el código.
2. **`comision.codigo` pasa a ser derivado (BREAKING).** Se elimina la columna, su índice
   único `uq_comision_codigo` y su CHECK de obligatorio. Entra `numero: Integer NOT NULL`
   con `ck_comision_numero_positivo` y `uq_comision_curso_numero`, incremental **por
   curso**. El código derivado (`{curso.codigo}-{numero}`, por ejemplo `CUR001-1`) vive
   como propiedad en el ORM y se arma en el serializador. Ninguna tabla referencia
   `comision.codigo`: las tres claves foráneas que llegan a la comisión —`clase`,
   `inscripcion` y `contrato_corporativo`— apuntan a su identificador, así que la caída de
   la columna está contenida en el modelo.
3. **`docente.cuil` pasa a ser opcional (BREAKING).** `DROP NOT NULL` y se elimina el
   CHECK `docente_cuil_obligatorio`. `uq_docente_cuil` se conserva. La fila de Rita Molina
   conserva su CUIL en `CUENTAS_DEMO`; el seed pasa a buscar al docente por `dni_norm`.
   Esto **revierte D27** y es **D33**.
4. **Las altas pasan a pegarle a la base.** `api` pasa a ser el valor por defecto de
   `VITE_API_MODE` y `docker-compose.yml` lo publica. Lo que todavía no tiene endpoint cae
   al datasource de ejemplo **solo** cuando la respuesta es 404; **los POST nunca caen**.
   Es **D36** y modifica **D14**.
5. **Cuatro endpoints.** `GET`/`POST /cursos`, `GET`/`POST /comisiones`,
   `GET`/`POST /docentes` y `GET /sedes`. El alta de docente crea **dos filas en una sola
   transacción**: el `Docente` y el `Usuario` con `rol = DOCENTE`. Ningún contrato lleva
   CUIL.
6. **Se cierra el pendiente P4 (moneda).** Todos los montos quedan en pesos argentinos. No
   hay cambio de código: el modelo ya usa `Numeric(14, 2)` y la spec ya lo dice. Es
   **D35**.
7. **Registro de decisiones.** **D32** (código de curso generado), **D33** (CUIL opcional),
   **D34** (código de comisión derivado), **D35** (moneda) y **D36** (API real por omisión)
   quedan escritas en `docs/decisions.md` con fecha y autor, porque el CSV de historias y
   los issues del backlog ya las citan.

**Sobre D32, textual:** el código del curso lo genera el sistema, no el operador. Los
códigos que trae el Excel del cliente (`CUR101`, `CUR-101`, `103`) **se descartan a
propósito** y no se intentan preservar. Las variantes sucias del nombre (`"Curso
Python"`, `"curso  de  python"`, `"Py 101"`) se resuelven con `nombre_norm` durante la
migración del Excel, que todavía no está escrita. Consecuencia anotada: **cuando se importe
el Excel, los códigos de las comisiones también se regeneran**, porque sus `curso_id` se
resuelven por `nombre_norm` y su número sale del orden de aparición en la planilla.

### No-objetivos

Queda escrito para que nadie lo lea después como un olvido:

- **#6 Visualizar cupos disponibles** — su segundo criterio necesita inscripciones
  reales, que son **#14**, y #14 no está en el tablero.
- **#14** inscripción de alumnos.
- **#3 Editar curso**, **#4 Editar comisión**, **#11 Editar docente** — por eso este
  change **nunca** usa `Closes`: las historias #1, #2, #5 y #8 no se cierran hasta que
  existan las de edición.
- **La columna `denominacion`.** El criterio de #2 la mencionaba y **no existe en el
  modelo**: la comisión se identifica por su código y el nombre del curso está a un
  salto. No se agrega.

## Capabilities

### New Capabilities

- `altas-catalogo`: el comportamiento de los cuatro endpoints y de las tres pantallas de
  alta. Es una capability nueva porque `domain-schema` declara explícitamente que **no**
  define endpoints CRUD de dominio, así que no hay dónde colgar este comportamiento.

### Modified Capabilities

- `domain-schema`: los tres cambios de esquema (código de curso generado, código de
  comisión derivado, CUIL opcional) con sus escenarios.
- `dev-infrastructure`: el valor por defecto de `VITE_API_MODE` y la caída al datasource de
  ejemplo para lo que todavía no tiene endpoint.

## Impact

**Backend — esquema.** Migración `0002` sobre `0001_initial`: `curso` pierde `codigo_norm`
y su `codigo` pasa a generada; `comision` pierde `codigo` y su CHECK, y gana `numero` con
dos restricciones nuevas; `docente.cuil` deja de ser `NOT NULL` y pierde su CHECK. El
`downgrade` tiene que funcionar completo, porque `conftest.py` corre `downgrade base` y
`upgrade head` al inicio de cada sesión de pruebas.

**Backend — código.** `app/models/catalogo.py`, `app/models/padron.py`,
`app/services/seed.py`, las factories de `app/tests/factories.py`, tres routers nuevos en
`app/api/` con sus esquemas en `app/schemas/` y sus servicios en `app/services/`.

**Backend — tests.** `app/tests/test_migration.py` entero: `CHECKS_ESPERADOS` pierde
`ck_comision_comision_codigo_obligatorio` y `ck_docente_docente_cuil_obligatorio` y gana
`ck_comision_numero_positivo`; `INDICES_ESPERADOS` pierde `uq_curso_codigo_norm` y
`uq_comision_codigo` y gana `uq_curso_codigo` y `uq_comision_curso_numero`;
`test_la_version_de_alembic_queda_registrada` pasa a afirmar el identificador de la
migración nueva. Los tests del modelo que el cambio invalida se reescriben o se borran.

**Frontend.** `src/services/dataSourceFactory.js` (valor por defecto), la caída al
ejemplo en la fuente real, `src/services/dataService.js`, `src/admin/CoursesPage.jsx` y
`src/admin/TeachersPage.jsx`. `docker-compose.yml` publica `VITE_API_MODE=api`.

Dos huecos que aparecieron al planificar y que este change tiene que cerrar, porque los dos
son invisibles mientras los datos son de ejemplo:

- **No existe `listarCursos()`** en `dataService.js` ni en ninguna de las dos
  implementaciones de la frontera. El selector de curso del formulario de comisión se arma
  hoy con `comisiones.map((c) => c.curso)`, o sea que **solo ofrece cursos que ya tienen una
  comisión**. Con datos reales eso significa que un curso recién creado no puede abrirle su
  primera comisión, que es justo el flujo que este change habilita.
- **`obtenerResumenCatalogo()`** pide `GET /comisiones?resumen=true`, que ningún endpoint
  define. El chip de la pantalla mostraría `undefined` en vez de la cantidad de comisiones.

**Documentación.** `docs/decisions.md`: D32 a D36 y el cierre de P4.

**Producción.** La migración **elimina columnas** (`curso.codigo_norm`,
`comision.codigo`) y relaja una (`docente.cuil`). Tiene que aplicarse **antes** de
desplegar el backend nuevo, no junto con él.

**Trazabilidad.** `Refs #1, #2, #9` en el pull request. **Nunca `Closes`**: las historias
#1, #2, #5 y #8 no cumplen todos sus criterios de aceptación hasta que existan #3, #4 y
#11.