# Design

## Context

Ver `proposal.md` — Why. El esquema ya soporta la categoría por inscripción (HU 15) y la derivación
de habilitación ya trabaja contra una inscripción (`app/services/habilitacion.py`). El problema es
de contrato y de pantalla: `GET /alumnos` arma un resumen por alumno tomando **la primera**
inscripción (`services/alumnos.py`), y tres pantallas consumen ese resumen como si fuera el estado
completo del alumno. El alta de inscripción (`admin/CoursesPage.jsx`) manda `categoria:
'PARTICULAR'` fija y el backend no acepta porcentaje ni empresa en ese `POST`.

Restricciones del proyecto: frontend en JavaScript sin TypeScript, todo pasa por
`src/services/`, tests de backend con pytest contra PostgreSQL real y componentes que no llaman al
backend directamente.

## Goals / Non-Goals

**Goals:**

- Que cada inscripción tenga y muestre su propia categoría, beca, empresa y habilitación.
- Que el padrón deje de afirmar una categoría única por alumno.
- Un único contrato de detalle del alumno reutilizable por el padrón, Accesos y, después, la HU 61.
- Que no se pueda crear una inscripción corporativa sin empresa ni una beca parcial sin porcentaje.

**Non-Goals:**

- La ficha modal del alumno, sus pestañas y el saldo pendiente: son la HU 61.
- Guardar el arancel dentro de la inscripción: el saldo se derivará con el arancel actual (HU 61).
- Cambiar el modelo, las migraciones o las reglas de cupo, duplicado y nómina corporativa.
- Cambiar la regla de habilitación: se sigue derivando, no se persiste (D9).
- El forzado manual de habilitación por inscripción: sigue como está y su endpoint es la H/U 30.

## Decisions

### El padrón queda con una fila por alumno y sin datos de inscripción

`GET /alumnos` deja de devolver `comision`, `categoria`, `porcentaje_beca`, `inscripcion_id` y
`acceso`, y `StudentsPage` elimina las columnas `COMISIÓN ASIGNADA`, `CATEGORÍA ARANCELARIA` y
`ACCESO PLATAFORMA`. Alternativa considerada: una fila por inscripción. Se descartó porque duplica
al alumno, rompe la baja y la edición por fila y convierte el padrón en una tabla de inscripciones.
El criterio de aceptación de la historia se lee en la acción **Categoría**, en Accesos y en la ficha
de la HU 61; la desviación queda registrada en el proposal.

**Efecto colateral buscado:** hoy `listar_alumnos` llama a `derivar_estado` por cada alumno con
inscripción, lo que dispara consultas de override y de imputaciones. Al quitar los datos de
inscripción del padrón, esa derivación desaparece del listado y el costo pasa al detalle de un solo
alumno.

### Un único `GET /alumnos/{id}` con todas las inscripciones

El detalle devuelve el alumno y `inscripciones[]`, cada una con comisión, categoría,
`porcentaje_beca`, empresa y acceso derivado. Lo consumen la acción **Categoría**, la consulta de
habilitación y, en la HU 61, la ficha. Alternativas: un endpoint aparte de habilitación (deja dos
contratos parecidos) o ampliar la lista del padrón (vuelve a cargar datos de inscripción en la
tabla). Se elige un solo detalle para que la HU 61 lo extienda con saldo y total en lugar de
duplicarlo.

El servicio reusa la composición de la fila y carga las relaciones con `selectinload` (comisión y
curso, empresa) para no caer en N+1. La derivación de acceso se hace por inscripción con
`habilitacion.derivar_estado`, que ya es la fuente única de estado.

### El alta de inscripción comparte la validación con la edición de categoría

Se extrae una función de servicio —validar categoría, porcentaje y empresa— que usan `POST` y
`PATCH`. El esquema de alta agrega `porcentaje_beca: int | None` (1–99) y `empresa_id: int | None`,
ambos opcionales, y mantiene `categoria` con `PARTICULAR` por omisión para no romper a quien ya
inscribe sin categoría. El `PATCH` no cambia de forma. Alternativa: reusar solo el `PATCH` después
de crear la inscripción; se descartó porque deja una ventana con corporativas sin empresa y obliga a
dos llamadas desde la pantalla.

### La pantalla elige la categoría al inscribir y resuelve la empresa en el lugar

El modal de inscripción de Comisiones suma categoría, porcentaje y empresa. La empresa se elige del
padrón y `+ Nueva Empresa` abre el alta existente sin cerrar el formulario de inscripción; al
volver, la empresa nueva queda seleccionada. Se reusa el servicio de alta de empresa que ya usa el
bloque de cuentas corporativas.

### La acción Categoría opera sobre una inscripción

Con una sola inscripción abre directo el formulario actual; con varias muestra un selector con
comisión, categoría y estado (incluidas las no activas) y aplica el `PATCH` a la elegida. Sin
inscripciones informa que primero hay que inscribir. Así el padrón no necesita mostrar la categoría
para poder editarla.

### Accesos muestra una sección por inscripción activa

`AccessPage` cambia la ficha única por una sección por inscripción `ACTIVA` del detalle y deja de
depender de `buscarHabilitacion`, que apunta a `/habilitaciones/consulta`, una ruta que el backend
nunca expuso: la búsqueda se resuelve con `GET /alumnos?q=`, que ya busca por DNI, email y nombre, y
con `listarEmpresas` filtrado por CUIT o razón social cuando no hay alumno. Las inscripciones no
activas no aparecen: una cursada terminada bloqueada sería ruido. La ficha de la HU 61 es la que va
a mostrar todas con su estado.

El campo `Último Pago Imputado` sale de la ficha resumen: hoy se arma buscando el primer pago
acreditado cuya imputación lleva el nombre del alumno, así que con dos inscripciones muestra plata
de la otra cursada. El pago se informa por inscripción desde la HU 61, que expone total pagado y
saldo.

El forzado de bloqueo no cambia en este cambio. `POST /habilitaciones/override` tampoco existe hoy
—la pantalla funciona con datos de ejemplo— y su aplicación por inscripción, con endpoint, es la
H/U 30, que está en `Ready`. Se deja anotado en `docs/decisions.md` para no dar por implementado lo
que no lo está.

### Cobranzas identifica la inscripción con categoría y estado

`InscripcionDisponibleOut` suma `categoria` y la pantalla la muestra junto al estado. No cambia la
regla de imputación: sigue siendo una inscripción `ACTIVA` y el pago no se reparte entre
inscripciones.

## Risks / Trade-offs

- **`GET /alumnos` es un contrato en uso** → backend y frontend se despliegan juntos; se actualizan
  `AccessPage`, `StudentsPage`, mocks y tests en el mismo cambio, y se busca cualquier otro
  consumidor con `code_search` antes de cerrar.
- **El detalle deriva la habilitación por inscripción** (varias consultas pequeñas) → el volumen es
  un alumno con pocas inscripciones; se cargan comisión, curso y empresa con `selectinload` y se
  evita hacerlo en el listado.
- **Datos de ejemplo desactualizados**: el camino con mocks podría no mostrar el caso de dos
  categorías → se agrega a los mocks un alumno con una inscripción corporativa y otra particular,
  con su empresa, para que la demo y los tests de pantalla cubran el caso.
- **La nómina corporativa crea inscripciones por servicio, no por el `POST`** → queda igual; la
  validación nueva no la afecta porque ya asigna empresa y categoría `CORPORATIVO`.
- **Regresión de la regla de beca**: el porcentaje se valida en el esquema (entero 1–99) y en el
  servicio, y el CHECK de base sigue siendo la última barrera.
- **Orden de rutas en el padrón**: `GET /alumnos/{id}` se declara después de `/reactivable`; si va
  antes, `reactivable` cae en el path param y responde `422`, y la reactivación de la H/U 17 deja de
  funcionar sin que su test lo note.
- **Escenarios stale en el spec del padrón**: `El buscador está deshabilitado` y `La búsqueda no
  arroja resultados` siguen en `openspec/specs/admin-shell` aunque la búsqueda funciona desde la
  H/U 16. El validador no deja renombrarlos desde un requisito MODIFIED, así que este change los
  conserva y la corrección queda para un change de limpieza que use REMOVED + ADDED.

## Migration Plan

Sin migración de base. El orden es: backend (contrato nuevo y detalle), servicios del frontend,
pantallas y datos de ejemplo, y recién entonces se considera cerrado el cambio. El rollback es
revertir el commit completo: al ser un contrato breaking, no se puede desplegar solo una de las dos
mitades.
