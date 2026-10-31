# Proposal

## Why

La comisión sabe qué días y a qué hora se cursa, pero no cuándo empieza ni cuándo termina:
`comision.fecha_inicio` existe en la tabla y no se puede escribir por la API, y `fecha_fin` no
existe (D60). Sin calendario el sistema no puede saber cuántas clases tiene un curso terminado ni,
por lo tanto, prorratear el arancel de un alta tardía, que es lo que pide la H/U 50. El panel del
alumno tampoco puede informar el cierre de su cursada y sigue mostrando «Todavía no está definida»
para siempre.

## What Changes

- `comision` suma `fecha_fin` (nula, expand/contract por D56). `fecha_inicio` deja de ser una columna
  muda: las dos fechas se editan y se leen por la API.
- El período es **obligatorio en el alta y en la edición** de una comisión. Las comisiones creadas
  antes de este cambio quedan sin período hasta que alguien las guarde; para esas, el sistema se
  comporta como hoy.
- Las fechas se validan juntas: el fin no puede ser anterior al inicio y el período tiene que
  contener al menos una clase según los días de cursada. Los dos rechazos responden `422` con el
  mensaje del campo.
- La cantidad total de clases es **derivada**: se cuentan los días del período, con sus dos extremos
  incluidos, que caen en un día de cursada de la comisión. Viaja como `cantidad_clases` en la
  respuesta de comisiones, es nula sin período y no se persiste. La H/U 50 la va a reutilizar para
  prorratear.
- `GET /alumno/inscripciones/{codigo}` informa la fecha de fin cuando está cargada, y los próximos
  encuentros **no pasan la fecha de fin**: una cursada terminada no sigue mostrando clases futuras.
- Frontend: el alta y la edición de comisión suman los dos campos de fecha, la tabla de comisiones
  suma la columna `PERÍODO` con el rango o «Sin definir», y la edición muestra la cantidad de clases
  que informa la API.

**Fuera de alcance:** el prorrateo del arancel y el aviso de «no se pudo prorratear» en la
inscripción (H/U 50 y 51), la modificación de inscripciones o de importes ya calculados, y el
calendario de feriados y suspensiones. La edición del período **no recalcula ningún arancel**: hoy
no existe un importe prorrateado que recalcular, y la regla queda escrita para que la H/U 50 no lo
haga al editar.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `altas-catalogo`: el alta de comisión exige el período de cursada, valida su coherencia y devuelve
  el período y la cantidad de clases derivada.
- `edicion-catalogo`: la edición de comisión acepta las fechas del período entre sus campos
  editables, sin tocar inscripciones ni aranceles.
- `alumno-api`: el detalle de la cursada propia informa la fecha de fin cuando está cargada y
  recorta los próximos encuentros al período.

## Impact

- **Modelo y migración:** `backend/app/models/catalogo.py` y una migración nueva `0006` sobre
  `comision` (columna nula y CHECK). Sin tablas nuevas, sin borrar ni renombrar columnas.
- **Contrato:** `POST /comisiones`, `PUT /comisiones/{id}` y `GET /comisiones` en
  `backend/app/schemas/catalogo.py` y `backend/app/api/catalogo.py`;
  `GET /alumno/inscripciones/{codigo}` en `backend/app/services/alumno.py`.
- **Frontend:** `frontend/src/admin/CoursesPage.jsx`, `frontend/src/mocks/comisiones.js`,
  `frontend/src/services/mockDataSource.js` y el comentario de
  `frontend/src/alumno/CourseDetailPage.jsx`. Sin dependencias nuevas: las fechas usan el
  `<input type="date">` que ya existe.
- **Datos:** las comisiones existentes conservan `fecha_inicio` (si la tenían) y quedan con
  `fecha_fin` nula. No hay backfill.
- **Documentación:** `docs/decisions.md` (decisión nueva) y `docs/glossary.md` (período de cursada).
