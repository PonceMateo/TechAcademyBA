# Proposal

## Why

Después de la HU 64 el padrón de alumnos muestra solo datos personales y la categoría de cada
inscripción ya no está en la tabla. No queda un lugar único donde ver al alumno completo —datos,
inscripciones, categoría, estado de acceso— ni desde donde operar sin volver a la fila. Tampoco se
puede saber cuánto falta pagar para cubrir una cursada: la habilitación deriva el estado, pero el
monto requerido y lo acreditado no se exponen en ninguna respuesta.

## What Changes

- Al pulsar una fila del padrón, o con Enter sobre la fila enfocada, se abre un modal de ficha del
  alumno en modo lectura con DNI, nombre, email y teléfono.
- El modal tiene un menú ⋮ con **Editar**, **Eliminar** y **Restablecer contraseña**, reutilizando
  el comportamiento y los modales que ya existen.
- Una pestaña por cada inscripción del alumno —activas y no activas— con comisión, categoría
  arancelaria (con el porcentaje cuando es beca parcial), empresa cuando es corporativa y estado de
  habilitación con su causa. Las no activas muestran su estado de inscripción, sin derivar un
  bloqueo por una cursada terminada.
- Cada pestaña muestra el total pagado, lo pendiente de acreditación y el saldo pendiente para
  cubrir la inscripción, en centavos redondeados, para que un saldo de `$0,00` nunca conviva con un
  acceso bloqueado. El saldo se deriva con el arancel actual de la comisión y el mismo criterio
  de la habilitación: lo observado no descuenta. Una inscripción corporativa se muestra a cargo de
  la empresa y una becada total, exenta.
- La pestaña permite cambiar la categoría de esa inscripción; el padrón deja de ofrecer la acción
  **Categoría**.
- El padrón deja de mostrar la columna `ACCIONES`: editar, eliminar y restablecer contraseña se
  hacen desde el menú de la ficha.
- El contrato de `GET /alumnos/{id}` suma por inscripción arancel, monto requerido, total pagado,
  total observado y saldo pendiente. Es aditivo: no quita ningún campo existente.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `padron-alumnos`: el detalle del alumno incorpora los importes por inscripción.
- `admin-shell`: ficha del alumno en modal, pestañas por inscripción, acciones desde el menú y
  padrón sin columna de acciones.

## Impact

- Backend: `app/api/alumnos.py`, `app/services/alumnos.py`, `app/schemas/alumnos.py`,
  `app/services/habilitacion.py` —la derivación de montos se extrae para que el estado y el saldo
  no tengan dos reglas— y sus tests.
- Frontend: `src/admin/StudentsPage.jsx`, `src/services/dataService.js`,
  `src/services/apiDataSource.js`, `src/services/mockDataSource.js`, `src/mocks/alumnos.js` y los
  tests del padrón.
- Depende de la HU 64: usa el `GET /alumnos/{id}` y el formulario de categoría que deja ese cambio.
  Se aplica después, en la misma rama.
- Datos: sin migración.
