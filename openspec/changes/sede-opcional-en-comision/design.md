# Design

## Context

Ver `proposal.md` para el porqué. Lo que condiciona el approach:

- **La regla de la sede ya es un CHECK de la base, y está escrito por qué.** El docstring de
  `crear_comision` (`backend/app/services/catalogo.py`, ~136-150) dice que las reglas de la comisión
  *no se validan acá porque son CHECK de la base, y una regla que se sostiene en dos lugares es una
  regla que se desincroniza*. Ese es el precedente y este change lo sigue en vez de abrirle excepción.
- **El 422 de un CHECK de `comision` ya existe como camino.** `_regla_de_alta_rota`
  (`backend/app/api/catalogo.py`, ~138-144) traduce cualquier `IntegrityError` de un CHECK a 422 con
  el texto crudo de PostgreSQL. Cupo y arancel pasan por ahí; la sede pasa por el mismo lado.
- `ComisionCreate.sede_id` ya es `int | None`, y el CHECK de la sede es
  `modalidad_presencial_requiere_sede`, uno de los seis de `Comision.__table_args__`
  (`backend/app/models/catalogo.py`, ~127-143). El contrato no cambia; cambia la regla.
- `backend/app/tests/test_migration.py` fija a mano la versión de alembic (~145) y el conjunto de
  CHECK (`CHECKS_ESPERADOS`, ~46-98), y corre `alembic check` contra el metadata (~148).

## Goals / Non-Goals

**Goals:**

- La regla de la sede se sostiene en un solo lugar: el CHECK. Ni Pydantic ni el frontend la duplican.
- El 422 de virtual con sede sale por el mismo camino que el de cupo y el de arancel.
- El frontend no puede mandar una sede en una comisión virtual, ni cuando el `select` se desmontó.
- La migración aplica sobre cualquier base, poblada o vacía.

**Non-Goals:**

- La entidad `sede`, `GET /sedes` y el selector: cambian la obligatoriedad y el renderizado.
- Traducir a es-AR el mensaje crudo de PostgreSQL: queda para el change de los mensajes de rechazo.
- La edición de comisión (#3, #4): `sede` sigue sin control fuera del alta.

## Decisions

**1. La regla vive invertida en el CHECK, no en Pydantic ni en el frontend.**

`modalidad <> 'VIRTUAL' OR sede_id IS NULL`, con nombre `modalidad_virtual_sin_sede`, va en
`Comision.__table_args__` y en la migración nueva. No hay validador en ninguna de las dos capas.

Alternativa considerada: un `model_validator` sobre `ComisionCreate`. Se descartó por dos motivos:
pone la regla en dos lugares, que es justo lo que el docstring de `crear_comision` dice que no se
hace, y deja el rechazo en un camino distinto del que recorren cupo y arancel, así que el mismo
`IntegrityError` tendría dos formas de traducirse. Validar solo en el frontend se descartó porque la
API es una frontera de confianza.

**2. El CHECK invierte la dirección, no desaparece.**

No es "dejar de exigir": es cambiar qué combinación se prohíbe. De las cuatro combinaciones de
`modalidad` × `sede_id`, el viejo rechazaba `(PRESENCIAL, NULL)` y el nuevo rechaza `(VIRTUAL, con
sede)`: no son la negación el uno del otro, y por eso la migración no puede ser un `drop` y nada más.
Se eligió en vez de dejar virtual con la sede permitida porque esa combinación es el dato incoherente
que el modal ya esconde.

**3. La migración normaliza las filas antes de agregar el CHECK.**

`0003_sede_opcional_comision` baja el CHECK viejo, corre
`UPDATE comision SET sede_id = NULL WHERE modalidad = 'VIRTUAL'` y agrega el nuevo. El `UPDATE` va
entre el `drop` y el `create` porque el CHECK anterior **permitía** virtual con sede: sobre cualquier
base con una sola comisión virtual asignada a una sede, el `create_check_constraint` a secas falla.

Alternativa considerada: dejar que la migración falle y que alguien limpie las filas a mano. Es más
honesta sobre el dato, pero hace la migración inaplicable en cualquier base con datos sin decir por
qué. Lo que se pierde con el `UPDATE` es la sede de una comisión virtual, que es exactamente el dato
que el CHECK nuevo prohíbe: no se destruye nada con significado. Hoy la base no tiene datos reales,
pero el `UPDATE` tiene que estar escrito igual.

**4. El `downgrade` restaura el CHECK viejo y falla si quedan presenciales sin sede.**

Mismo criterio que el `downgrade` del CUIL en `0002_altas_catalogo`: no repara los datos, falla con el
error de la base. Una restricción que los datos incumplen no se puede restaurar, y un `downgrade` que
rellenara sedes inventadas mentiría sobre el estado del esquema.

**5. En el frontend `mostrarSede`, y el `sede_id` se deriva de él.**

`exigeSede` (~172 de `frontend/src/admin/CoursesPage.jsx`) pasa a `mostrarSede` con la misma prueba
de dos ramas, porque "hace falta mostrarlo" y "es presencial o híbrido" son hoy la misma condición.
La rama de validación de `sede` (~231) se borra entera —la sede no es obligatoria en ninguna
modalidad— y el payload (~265) arma el `sede_id` como
`mostrarSede && campos.sede !== '' ? Number(campos.sede) : null`.

Alternativa considerada: limpiar `campos.sede` en el `onChange` del `select` de modalidad. Se
descartó porque necesita un segundo handler y un efecto lateral para mantener un estado que no se
muestra, mientras que la expresión derivada es total y no puede quedar vieja. El bug que evita es
concreto: el `<select>` se desmonta al cambiar a Virtual pero `campos.sede` conserva el valor
anterior, así que el payload mandaría una sede en una comisión virtual — que el CHECK nuevo rechaza
con 422. No es cosmético: es el 422 del punto 1 por el camino del frontend.

## Risks / Trade-offs

- **Modelo y migración tienen que caer en el mismo commit.** `alembic check` corre en
  `test_la_migracion_escrita_a_mano_cuadra_con_los_modelos`, así que si entran separados la prueba
  falla por una diferencia que no nombra el archivo culpable: el único fallo de este change que no se
  ve útil en local. Por lo mismo los dos assert de `test_migration.py` son obligatorios —la versión
  exacta pasa a `0003_sede_opcional_comision` y `CHECKS_ESPERADOS` cambia el nombre del CHECK—, y esa
  suite existe porque un `autogenerate` en verde no dice que una restricción escrita a mano exista.
- **La migración pierde la sede de las comisiones `VIRTUAL` que tengan una.** → Es el dato que el
  CHECK nuevo prohíbe, así que no se pierde información con significado. Si esas filas llegaran a
  existir, el `UPDATE` queda registrado en la migración y la decisión en `docs/decisions.md`.
- **El `downgrade` falla si quedan comisiones presenciales sin sede.** → Un rollback sobre datos que
  ya no bancan la restricción vieja es trabajo manual, no un paso de migración.
- **El 422 sale con el texto crudo de PostgreSQL, que nombra la tabla y la columna en inglés.** →
  Queda para el change de mensajes de rechazo; hoy el cupo y el arancel enseñan lo mismo.
- **Quedan falsos los asserts de "presencial sin sede es rechazado"** en `test_altas_api.py` (~245) y
  `test_catalogo.py` (~145), y este último compara el nombre viejo del CHECK dentro del motivo. → Se
  invierten a "guarda sin sede" y el nombre cambia. Ningún test ni fixture crea hoy una comisión
  virtual con sede, así que no hay datos de prueba que limpiar.
- **El CSV es la fuente de verdad y hoy afirma lo contrario.** → El escenario de la #8 se corrige en
  el mismo work unit; si queda para después, la fuente #1 y la spec se pelean en el mismo review.

## Migration Plan

Una migración, `0003_sede_opcional_comision`, con `down_revision = "0002_altas_catalogo"`. Baja el
CHECK viejo, pone en `NULL` la sede de las comisiones virtuales y agrega `modalidad_virtual_sin_sede`.
**Reescribe filas** (decisión 3), así que se aplica antes de desplegar el backend nuevo; hoy no hay
datos reales y el `UPDATE` no toca nada.

Un work unit y un commit, con el modelo y la migración adentro. Trailer `Refs #8`, y **no**
`Closes #8`: la historia sigue abierta porque este change no le cierra los criterios de edición.

Al terminar, `docs/decisions.md` necesita dos cosas: la decisión nueva como **M35** —`M33` y `M34` ya
existen y el archivo no está ordenado por número—, y **corregir `M33` en el sitio**, que hoy afirma
que hay 422 *"si la modalidad exige sede y no vino"*: frase que este change vuelve falsa.

## Open Questions

Ninguna que afecte specs, approach o tareas. Las tres preguntas de alcance —sede siempre opcional, el
campo oculto hasta elegir modalidad, virtual con sede es 422— ya las respondió el equipo.
