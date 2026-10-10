# Proposal

## Why

La pantalla `Cursos y Comisiones` muestra una sola tabla de comisiones. Desde el change
`altas-catalogo-docentes` el catálogo tiene endpoints propios y la pantalla lee datos reales (D36):
un curso puede existir en el catálogo sin tener ninguna comisión, y esa tabla no tiene dónde
mostrarlo —el curso recién creado no aparece hasta que le abren su primera comisión—. Además el
operador no ve el catálogo como lo piensa la secretaría, que es por curso, y tiene que recorrer la
tabla para saber qué comisiones cuelgan de qué curso ni cuántas son.

## What Changes

- La pantalla `Cursos y Comisiones` pasa a tener dos vistas encadenadas:
  - **Vista cursos** (`/admin/cursos`): grid con una tarjeta por curso del catálogo. Cada tarjeta
    muestra nombre, código, descripción y la cantidad de comisiones que tiene. Al pulsar la tarjeta
    o el botón `Abrir comisiones` se entra a la vista del curso.
  - **Vista comisiones del curso** (`/admin/cursos/:codigo`): la misma tabla de `Comisiones
    Activas` que existe hoy —mismas columnas, mismo orden, mismo chip `LLENO`—, pero filtrada por
    el curso de la ruta, con el nombre y el código del curso a la vista y un `Volver a cursos`.
- La acción `+ Nueva Comisión` se offerca **solo** dentro de un curso. Al pulsarla, el modal
  `Crear Nueva Comisión` abre con `Curso / Programa` ya elegido y bloqueado al curso de la ruta.
  En la vista de cursos quedan `+ Nuevo Curso` y `+ Nueva Comisión`; `+ Nuevo Curso` no se ofrece
  dentro de un curso.
- Ambas vistas dejan ver el buscador con el campo deshabilitado y su leyenda, sin filtrar: el
  hueco queda a la vista y la funcionalidad se implementa en otro change.
- El conteo de comisiones por curso se arma en el cliente con `GET /cursos` y `GET /comisiones`,
  igual que hoy hace `obtenerResumenCatalogo`. **No se agrega ningún endpoint.**
- La tabla plana con todas las comisiones **BREAKING**: sale de `/admin/cursos`. Sigue existiendo
  dentro de cada curso, que es donde la secretaría la consulta.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `admin-shell`: cambia el requisito `Comisiones activas y alta de comisión`. La pantalla deja de
  ser un listado único y pasa a ser navegación por curso; la tabla pasa a ser por curso; las
  acciones de alta se reparten entre las dos vistas y la de comisión queda con el curso
  preseleccionado; los dos buscadores quedan visibles pero sin función.

## Impact

- `frontend/src/admin/CoursesPage.jsx`: la pantalla se parte en dos vistas y agrega el estado de
  la ruta.
- `frontend/src/App.jsx`: la ruta `/admin/cursos` deja de ser una hoja y pasa a ser el índice de
  cursos, con `/admin/cursos/:codigo` debajo. `navegacion.js` no se toca: el ítem del menú sigue
  apuntando a `/admin/cursos` y sigue quedando marcado en la ruta con parámetro.
- `frontend/src/admin/CoursesPage.test.jsx`: los tests actuales abren `/admin/cursos` esperando la
  tabla de comisiones y hay que reapuntarlos. `shellConsistency.test.jsx` no necesita cambios: la
  vista de cursos sigue dibujando `Card`, `Badge` y `Button`.
- **Sin cambios de API ni de la fuente de datos.** El conteo por curso sale de `GET /cursos` y
  `GET /comisiones`, que ya existen; el ejemplo deja de armar el catálogo a partir de las comisiones.
- `frontend/src/components/ui/`: no se agrega ningún componente. El grid se arma con `Card` y clases
  de Tailwind.
- La pantalla `Docentes` no se toca: el pedido la mencionaba, pero no define ningún cambio sobre
  ella y ya tiene buscador y alta funcionando.