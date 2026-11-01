# Tasks

## 1. Alcance y documentación

- [x] 1.1 Confirmar con el equipo el alcance de la HU 10: prefijo por palabra, solo docentes activos y comisiones reales en la respuesta.
- [x] 1.2 Registrar en `docs/decisions.md` la búsqueda en el servidor, la normalización en Python y la forma de `comisiones` (D48).

## 2. Backend

- [x] 2.1 Agregar `ComisionDeDocenteOut` y el campo `comisiones` a `DocenteOut`, conservando `cantidad_comisiones`.
- [x] 2.2 Implementar en `app/services/padron.py` el filtro por `q`, el filtro `activo = true`, la normalización sin tildes y la coincidencia por prefijo de palabra en orden para nombre y apellido; prefijo del DNI normalizado y prefijo del email, sin mínimo de caracteres.
- [x] 2.3 Ordenar los resultados por campo (nombre, DNI, email) y, dentro del nombre, por la posición de la primera palabra que coincide; `id` como desempate estable.
- [x] 2.4 Cargar las comisiones de los docentes filtrados en una sola consulta con `selectinload(Comision.curso)` y armar `{id, codigo, nombre}` por docente.
- [x] 2.5 Exponer `q` como parámetro opcional de `GET /docentes` en `app/api/padron.py`, manteniendo `require_roles(Rol.ADMIN)`.
- [x] 2.6 Ajustar la respuesta del alta para devolver `comisiones: []` sin cambiar su comportamiento.
- [x] 2.7 Tests contra PostgreSQL real: prefijo de palabra, orden de las palabras, una sola letra que no coincide por estar en el medio, prioridad de `Alfonso` sobre `Rita Alonso` con `al`, tildes y mayúsculas, DNI con y sin separadores, email, consulta vacía, sin resultados, docentes inactivos, comisiones reales, docente sin comisiones y autorización `401`/`403`.

## 3. Frontend

- [x] 3.1 Actualizar `apiDataSource.buscarDocentes` para llamar a `GET /docentes?q=` y mapear `comisiones`.
- [x] 3.2 Actualizar `mockDataSource.buscarDocentes` para aplicar el mismo criterio de búsqueda y orden, filtrar activos y derivar las comisiones del catálogo de comisiones del ejemplo.
- [x] 3.3 Incorporar en `TeachersPage` el debounce de 300 ms, la cancelación del temporizador, la consulta desde una sola letra, el descarte de respuestas antiguas y la recarga inmediata al vaciar el campo.
- [x] 3.4 Renderizar `COMISIONES ASIGNADAS` con el código y el nombre de cada comisión, `Sin comisión` cuando la lista está vacía y `No se encontraron docentes` cuando no hay coincidencias.
- [x] 3.5 Mantener sin cambios el modal de alta, las columnas, los colores, las tipografías y los componentes visuales.
- [x] 3.6 Tests de Vitest: prefijo por nombre y apellido, orden de las palabras, una sola letra que dispara la búsqueda y no coincide por estar en el medio, prioridad de `Alfonso Pérez` sobre `Rita Alonso` con `al`, DNI con separadores, tildes y mayúsculas; debounce; respuesta vieja que no pisa la nueva; vaciado que restaura el listado; comisiones y `Sin comisión`; mensaje sin resultados; alta sin cambios.

## 4. Verificación

- [x] 4.1 Ejecutar `pytest` contra PostgreSQL real.
- [x] 4.2 Ejecutar `vitest run`.
- [x] 4.3 Comprobar que el alta de docentes (HU 9) y la navegación de Administración siguen funcionando.
- [ ] 4.4 Abrir el pull request con `Closes #10` solo después de cumplir todos los criterios de aceptación.
