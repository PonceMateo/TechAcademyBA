# Proposal

## Why

Los dos buscadores de `Cursos y Comisiones` se ven hoy deshabilitados y no filtran (D39): obligan a recorrer todo el catálogo para encontrar un curso o una comisión. Esta entrega los habilita, siguiendo el criterio de la H/U 10 (D48): coincidencia por prefijo de palabra, normalizada, sin distinguir mayúsculas ni acentos.

## What Changes

- **Vista de cursos:** el campo de búsqueda filtra el grid por nombre, código o descripción, por prefijo de palabra. La coincidencia ignora mayúsculas y acentos. Sin coincidencias se muestra `No se encontraron cursos`; al vaciar el campo vuelve el catálogo completo. Los resultados se reordenan por relevancia de la coincidencia.
- **Vista de comisiones:** el campo filtra la tabla por código, docente o horario, y solo dentro del curso abierto. Sin coincidencias se muestra `No se encontraron comisiones`; al vaciar vuelve la tabla del curso.
- Se reemplaza el control deshabilitado (`BuscadorPendiente`) por un `Input` habilitado en ambas vistas y se actualizan las pruebas que verificaban el estado deshabilitado.
- La búsqueda se resuelve en el cliente sobre los datos ya cargados (catálogo acotado), sin cambios de backend ni migración. La normalización reutiliza `normalizeWords` del frontend.
- Se registra la decisión en `docs/decisions.md`.

## Capabilities

### New Capabilities

- (ninguna)

### Modified Capabilities

- `admin-shell`: las dos vistas de `Cursos y Comisiones` pasan de mostrar el buscador deshabilitado (D39) a filtrar el contenido por prefijo de palabra, con mensaje de sin resultados y restauración al vaciar.

## Impact

- **Frontend:** `frontend/src/admin/CoursesPage.jsx` y `frontend/src/admin/CoursesPage.test.jsx`.
- **Backend:** sin cambios.
- **Documentación:** nueva entrada en `docs/decisions.md`.
- **Backlog:** al cumplir los criterios de las H/U 67 y 68, el pull request puede usar `Closes #92` y `Closes #93`.