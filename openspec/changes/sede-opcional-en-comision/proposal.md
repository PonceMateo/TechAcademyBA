# Proposal

## Why

Hoy `comision.sede_id` es obligatoria para `PRESENCIAL` y `HIBRIDO` y lo sostiene un CHECK de
la base. La obligatoriedad no sirve para el caso que el CSV menciona —cursos que *requieren*
presencialidad por contenido (refrigeración, electricidad)—: a esos no les falta una sede, les
falta la de ese tipo de aula. El resultado real es que la secretaría no puede guardar la
comisión, y el criterio de aceptación de la historia #8 —«el sistema rechaza el guardado y
solicita seleccionar una sede»— es exactamente lo que estorba.

La fuente de verdad #1 dice hoy lo contrario de lo que se pide. Por eso este change actualiza
también el CSV.

Tres decisiones del equipo, ya tomadas y que no se vuelven a abrir:

- `sede` **opcional en toda modalidad**.
- El campo `Sede` **no se renderiza** cuando la modalidad es `Virtual`, ni mientras no se haya
  elegido modalidad (el modal arranca en `Seleccionar…`).
- `VIRTUAL` **con** `sede_id` se rechaza con `422`: es dato incoherente, no dato opcional.

## What Changes

Es **BREAKING** sobre el esquema y **BREAKING** sobre las tres specs que hoy afirman lo
contrario. No hay endpoint nuevo ni campo nuevo en el contrato.

1. **El CHECK de la base invierte su dirección.** `modalidad_presencial_requiere_sede`
   (`modalidad = 'VIRTUAL' OR sede_id IS NOT NULL`) se reemplaza por `modalidad_virtual_sin_sede`
   (`modalidad <> 'VIRTUAL' OR sede_id IS NULL`). Deja de exigir sede y pasa a **prohibirla** en
   virtual. Vive en el modelo (`backend/app/models/catalogo.py`, `Comision.__table_args__`) y en
   `alembic/versions/0001_initial_schema.py`, que lo crea con el nombre `ck_` de la migración.
2. **Migración `0003_sede_opcional_comision`**, sobre `0002_altas_catalogo`: baja el CHECK viejo,
   pone `sede_id = NULL` en las comisiones `VIRTUAL` que tengan sede y agrega el nuevo. El
   `UPDATE` es necesario porque el CHECK anterior **permitía** virtual con sede, así que cualquier
   base poblada fallaría al agregar el nuevo. El `downgrade` devuelve el CHECK viejo y falla si
   quedan comisiones presenciales sin sede, mismo criterio que el `downgrade` del CUIL en `0002`.
3. **El 422 de virtual con sede no necesita Python.** Sale del `IntegrityError` que ya traduce
   `_regla_de_alta_rota` en `backend/app/api/catalogo.py`, igual que el cupo y el arancel.
4. **El frontend deja de exigir la sede.** `exigeSede` pasa a `mostrarSede` (verdadera solo para
   `PRESENCIAL` y `HIBRIDO`, que es justo cuando el campo se muestra), se borra la rama de
   validación que la usaba, el `Campo` de `Sede` se envuelve en `{mostrarSede && …}` y pierde el
   `obligatorio`, y el `sede_id` del payload se deriva de `mostrarSede`: el `select` se desmonta
   al cambiar a `Virtual`, pero `campos.sede` conservaría el valor viejo y mandaría una sede de una
   comisión virtual.
5. **Se actualizan las docstrings** que nombran la regla vieja en `api/catalogo.py`,
   `services/catalogo.py` y `schemas/catalogo.py`.
6. **El CSV de historias se corrige**: el escenario «Modalidad presencial o híbrida» de la #8 pasa
   de rechazar el guardado sin sede a registrar la comisión sin sede.
7. **Se registra la decisión** en `docs/decisions.md` con fecha y autor.

### Fuera de alcance

Queda escrito para que no se lea después como un olvido:

- La entidad `sede`, `GET /sedes` y el selector de sedes **no se tocan**: cambian la obligatoriedad
  y el renderizado, nada más.
- `ComisionOut` **sigue devolviendo** `sede_id` y `sede_nombre`.
- No se agrega ninguna regla de sede sobre otras capabilities.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `domain-schema`: `sede` anulable en toda modalidad, y el CHECK del esquema invirtiéndose.
- `altas-catalogo`: el `422` de virtual con sede.
- `admin-shell`: el campo `Sede` condicional y no obligatorio.

## Impact

**Capacidades afectadas:** `domain-schema`, `altas-catalogo`, `admin-shell` (las tres, solo
`MODIFIED`).

**Backend — esquema.** `backend/app/models/catalogo.py` (CHECK y comentario de la historia #8) y
la migración nueva. `alembic check` corre en `test_migration.py`, así que modelo y migración tienen
que quedar sincronizados el mismo día.

**Backend — código.** Solo docstrings: `app/api/catalogo.py`, `app/services/catalogo.py`,
`app/schemas/catalogo.py`.

**Backend — tests.** `test_migration.py` (`CHECKS_ESPERADOS` cambia de nombre y la versión de
alembic pasa a `0003_sede_opcional_comision`), `test_altas_api.py` y `test_catalogo.py` (los
asserts de 422 sin sede se invierten), `factories.py` (docstring de `con_sede=False`).

**Frontend.** `src/admin/CoursesPage.jsx`, `src/admin/CoursesPage.test.jsx` (el test de orden de
campos saca `Sede`, los dos tests de rechazo pasan a guardar) y `src/mocks/mocks.test.js` (el
título que invoca el CHECK viejo).

**Documentación.** `docs/requirements/Historias_de_Usuario_TechAcademy_BA.csv` (historia #8),
`docs/glossary.md` (la fila de **Sede** dice «Es obligatoria para toda comisión que no sea
virtual») y `docs/decisions.md`.

**Producción.** La migración **reescribe filas**: pone en `NULL` la sede de las comisiones
virtuales que tengan una. Se aplica antes de desplegar el backend nuevo. Hoy la base está vacía de
datos reales, así que el `UPDATE` no toca nada, pero la migración tiene que decirlo igual.

**Trazabilidad.** `Refs #8`. **No `Closes`**: la #8 sigue sin cierre porque este change no le
cierra los criterios de edición.

### Una corrección sobre el número de decisión

La decisión nueva es **M35**, no M33: `M33` y `M34` ya existen en `docs/decisions.md` (líneas 399
y 437). El `M32` que figura al final del archivo es el de la sección anterior, no el último número
usado. Además, `M33` dice hoy que un `422` ocurre «si la modalidad exige sede y no vino», frase que
este change vuelve falsa y que hay que corregir en el mismo passage.

## Notes

- **Sin datos que limpiar.** Ningún test ni fixture crea hoy una comisión `VIRTUAL` con sede, así
  que el CHECK nuevo no rompe nada existente. Verificado.
- **El mensaje del 422 sigue siendo el crudo de PostgreSQL.** La traducción a es-AR de este
  rechazo sigue pendiente del change que escriba los mensajes de rechazo, como los de cupo y
  arancel.
