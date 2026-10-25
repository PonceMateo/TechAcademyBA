# Proposal

Refs #65 (H/U 48 · Selector de horarios de comisión)

## Why

El alta y la edición de comisiones guardan los días y horarios como texto libre
("Mar y Jue 19 a 21 hs"): cada operador lo escribe distinto, no se puede comparar entre
comisiones y es imposible detectar que un docente tiene dos comisiones en el mismo horario.
La historia H/U 48 pide reemplazar ese campo por horarios estructurados.

## What Changes

- **Modelo**: nueva entidad de horarios de cursada por comisión (`comision_horario` con día de
  la semana, inicio y fin). `comision.dias_horarios` **se conserva** como texto de lectura que
  el backend deriva desde los horarios guardados.
- **Migración reversible** (`0005`) que crea la tabla e incluye un parser defensivo que convierte
  los strings existentes en filas estructuradas. En producción no hay ninguna comisión creada, así
  que hoy convierte cero filas; el Excel del cliente queda fuera del alcance por decisión del
  equipo.
- **BREAKING — contrato de API**: `POST /comisiones` y `PUT /comisiones/{id}` dejan de aceptar
  `dias_horarios` como texto libre y reciben `horarios: [{ dia, inicio, fin }]`. `GET /comisiones`
  devuelve `horarios` y conserva `dias_horarios` ya derivado.
- **Validaciones nuevas**: `422` por minutos fuera de `{0,15,30,45}`, horas fuera de 6:00 a 22:00,
  `fin <= inicio` o dos rangos que se pisen dentro de la misma comisión; `409` cuando el horario
  choca con el de otra comisión vigente del mismo docente, en cualquier curso, con comparación
  estricta de intervalos y excluyendo la propia comisión al editar.
- **UI de comisión**: el campo `Días y Horarios` de los modales de alta y de edición pasa a fila de
  ancho completo con chips de solo lectura y el botón `Agregar horarios` / `Modificar horarios`; el
  selector se abre en un modal superpuesto con el switch `Mismo horario todos los días`, chips de
  día accesibles y un rango por día, usando `react-datepicker` en modo solo hora.
- **Tabla de Administración**: la columna `HORARIO` pasa al renderer compacto con una línea con
  ellipsis, tooltip con el texto completo y badge `+N` que abre el popover con la lista completa.

## Capabilities

### New Capabilities

Ninguna: el trabajo modifica comportamiento de capacidades ya declaradas.

### Modified Capabilities

- `domain-schema`: el modelo de comisiones incorpora la entidad de horarios estructurados y define
  `dias_horarios` como texto derivado de ellos, con la conversión reversible de lo existente.
- `altas-catalogo`: `POST /comisiones` recibe horarios estructurados y valida rango, minutos,
  rangos repetidos y solapamiento por docente.
- `edicion-catalogo`: `PUT /comisiones/{id}` recibe horarios estructurados, aplica las mismas
  validaciones y excluye a la propia comisión del chequeo de solapamiento.
- `admin-shell`: formulario de comisión con la fila de horarios a ancho completo, chips y selector
  superpuesto, más el renderer compacto del horario en la tabla.

## Impact

- **Backend**: `backend/app/models/catalogo.py`, `backend/app/schemas/catalogo.py`,
  `backend/app/services/catalogo.py`, `backend/app/api/catalogo.py` y una migración nueva
  `backend/alembic/versions/0005_*`. La rama tocará `backend/alembic/`: hay que avisarlo antes de
  pushear a `main`, porque el deploy de Vercel no corre `alembic upgrade head`.
- **Frontend**: `frontend/src/admin/CoursesPage.jsx`, `frontend/src/components/ui/Modal.jsx`
  (focus trap y pila de modales para que Escape cierre solo el modal superior), el módulo nuevo de
  dominio `frontend/src/domain/horarios.js`, `frontend/src/services/mockDataSource.js` y los tests
  de esas piezas.
- **Dependencias**: `react-datepicker` en el frontend, como única dependencia nueva.
- **Contratos**: cualquier consumidor que envíe `dias_horarios` como texto recibe `422`; el
  mock de test se adapta al payload nuevo.
- **Fuera de alcance**: choques de aula/sala, datos del Excel del cliente, las pantallas de
  docente y alumno (leen otro campo de endpoints todavía no conectados) y el filtro de búsqueda por
  horario estructurado.
