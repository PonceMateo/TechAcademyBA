# Design

## Context

Hoy `CoursesPage` carga todo el catálogo (`listarCursos`, `listarComisiones`) en un solo efecto y arma `cursos` y `comisionesDelCurso` en memoria. Los dos `BuscadorPendiente` son controles deshabilitados sin estado (D39). El patrón de referencia es la H/U 10 (D48): coincidencia por prefijo de palabra, normalizada, sin `unaccent`, con reordenamiento por relevancia. La normalización del frontend ya existe en `normalizeWords` (`frontend/src/domain/normalize.js`).

## Goals / Non-Goals

**Goals:**
- Habilitar los dos buscadores con filtrado instantáneo por prefijo de palabra.
- Mantener el contrato de datos y la identidad visual (componentes existentes).
- Reutilizar `normalizeWords` y no agregar dependencias.

**Non-Goals:**
- No cambios de backend ni migración (volumen acotado, datos ya cargados).
- No debounce ni descarte de respuestas (filtrado sincrónico).
- No búsqueda global entre cursos (H/U 68 la deja para otra historia).
- No extracción de strings ni i18n.

## Decisions

### D-A — Filtrado en el cliente

El catálogo es acotado (≈10 comisiones, pocos cursos) y `CoursesPage` ya tiene todos los datos. Filtrar en el cliente evita endpoints, migración y debounce, y mantiene el mismo criterio para `mock` y `api`. Si el volumen crece, se puede mover la búsqueda al servidor (`?q=`) sin cambiar la UI.

### D-B — Coincidencia por prefijo de palabra, por campo

Se reutiliza `normalizeWords` para partir texto en palabras normalizadas (sin tildes, en mayúscula). Una consulta coincide con un registro si todas sus palabras son prefijo de palabras consecutivas del campo, en orden (como D48). Se evalúan los campos en prioridad: cursos `nombre` > `codigo` > `descripcion`; comisiones `codigo` > `docente_nombre` > `dias_horarios`. El primer campo que coincide define la inclusión y la clave de orden `(prioridadCampo, posiciónPrimeraCoincidencia, id)`.

### D-C — Reordenamiento por relevancia

Cuando la consulta no está vacía, los resultados se ordenan por la clave anterior. Con consulta vacía se conserva el orden original (por `id`). El desempate final es el `id`.

### D-D — Estado y componentes

Se reemplaza `BuscadorPendiente` por un `Input` controlado. `CoursesPage` mantiene `busquedaCursos` y `busquedaComisiones`, calcula listas filtradas con `useMemo` y las pasa a `VistaCursos`/`VistaComisiones`. El mensaje de vacío se decide en la vista según si la lista filtrada está vacía y hay texto de búsqueda.

### D-E — Mensajes

- Sin coincidencias en cursos: `No se encontraron cursos`.
- Sin coincidencias en comisiones: `No se encontraron comisiones`.
- Curso sin comisiones (sin búsqueda): mensaje original `Este curso todavía no tiene comisiones.`.

## Risks / Trade-offs

- [Filtrado en memoria recorre todo el catálogo] → Aceptable para el volumen actual; si crece, mover a `?q=` sin cambiar contrato UI.
- [Tests existentes verifican el control deshabilitado] → Se actualizan para reflejar el buscador habilitado.
- [Horario se busca sobre `dias_horarios`] → Es el texto derivado que ya muestra la tabla; consistente con lo visible.

## Migration Plan

Sin migración. El cambio es solo frontend y documentación.

## Open Questions

Ninguna.