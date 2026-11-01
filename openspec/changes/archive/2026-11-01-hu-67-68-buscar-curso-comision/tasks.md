# Tasks

## 1. Registrar la decisión

- [x] 1.1 Agregar en `docs/decisions.md` la entrada de la búsqueda del catálogo (cliente, prefijo de palabra, normalización con `normalizeWords`, reordenamiento por relevancia, mensajes) y verificar que la entrada queda referenciada desde el change.

## 2. Implementar el filtrado en `CoursesPage.jsx`

- [x] 2.1 Agregar `useMemo` a los imports de React y `normalizeWords` al import de `../domain/normalize`, y verificar que el módulo compila sin errores de importación.
- [x] 2.2 Agregar el estado `busquedaCursos` y `busquedaComisiones` en `CoursesPage`, y verificar que la vista se renderiza sin cambios visibles con los campos vacíos.
- [x] 2.3 Implementar las funciones de coincidencia por prefijo de palabra y la clave de orden para cursos y comisiones, y verificar con un caso manual que `python` coincide con `Python Inicial` pero no con `Aprendizaje`.
- [x] 2.4 Calcular `cursosFiltrados` y `comisionesFiltradas` con `useMemo` sobre `busquedaCursos`/`busquedaComisiones`, y verificar que con texto vacío devuelven la lista completa en orden original.
- [x] 2.5 Reemplazar `BuscadorPendiente` por un `Input` controlado en `VistaCursos` y `VistaComisiones`, pasando `busqueda` y `onBusquedaChange`, y eliminar `BuscadorPendiente` y `LEYENDA_BUSCADOR` si quedan sin uso; verificar que no haya referencias colgantes.
- [x] 2.6 Ajustar el mensaje de vacío: `No se encontraron cursos` / `No se encontraron comisiones` cuando hay texto y cero resultados, y conservar el mensaje original cuando el curso no tiene comisiones; verificar ambos casos en la UI.

## 3. Pruebas de `CoursesPage`

- [x] 3.1 Actualizar `CoursesPage.test.jsx`: reemplazar las pruebas que esperan el buscador deshabilitado por pruebas del buscador habilitado, y verificar que `npm test -- CoursesPage` pasa.
- [x] 3.2 Agregar pruebas de filtrado por prefijo de palabra, sin resultados, restauración al vaciar y alcance por curso, y verificar que todas pasan.
- [x] 3.3 Agregar prueba de reordenamiento por relevancia, y verificar que pasa.

## 4. Verificación final

- [x] 4.1 Ejecutar `npm test` en `frontend/` y verificar que no hay regresiones.
- [x] 4.2 Ejecutar `openspec validate hu-67-68-buscar-curso-comision` y verificar que pasa.