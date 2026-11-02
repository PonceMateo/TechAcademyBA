# Tasks

## 1. Decisión e importes en el backend

- [x] 1.1 Registrar en `docs/decisions.md` la decisión de calcular estado y saldo con una sola función de derivación y de mostrar el saldo contra el arancel actual, con fecha y autor, antes de tocar el código
- [x] 1.2 Extraer `derivar_montos` en `backend/app/services/habilitacion.py` —requerido, acreditado, observado— cuantizando el requerido a centavos con `ROUND_HALF_UP`, y hacer que `derivar_estado` decida contra ese mismo valor; verificar que `test_imputaciones_api.py` y los tests de habilitación siguen en verde y agregar el caso de arancel 12345.67 con beca 33.33%
- [x] 1.3 Sumar al detalle del alumno `arancel`, `monto_requerido`, `total_pagado`, `total_observado` y `saldo_pendiente` por inscripción, con beca total en cero y corporativo en nulo; verificar con tests de particular con pago parcial, beca parcial, beca total, corporativo, cobro observado, sobrepago y cambio de arancel
- [x] 1.4 Verificar que dos inscripciones del mismo alumno informan importes separados, y correr `docker compose run --rm backend pytest app/tests/test_alumnos_api.py app/tests/test_imputaciones_api.py -q` más `docker compose run --rm backend ruff check .`

## 2. Servicios y datos de ejemplo del frontend

- [x] 2.1 Ajustar `obtenerAlumno(id)` y los mapeos de `src/services/` para recibir los importes, y verificar la forma de la respuesta en `apiDataSource.test.js`
- [x] 2.2 Agregar a los mocks imputaciones de ejemplo que cubran una inscripción particular con saldo, una beca parcial, una beca total y una corporativa, y verificar que `mocks.test.js` valida los importes
- [x] 2.3 Verificar que `dataService.test.jsx` refleja el detalle con importes y correr `docker compose run --rm frontend npm run test -- src/services`

## 3. Ficha del alumno en modal

- [ ] 3.1 Agregar a `src/components/ui/Table.jsx` el soporte opcional de fila clickeable y enfocable con Enter y espacio, sin cambiar las tablas que no lo usan; verificar con un test del componente en `componentes.test.jsx`
- [ ] 3.2 Abrir la ficha al pulsar una fila o presionar Enter, con DNI, nombre, email y teléfono en modo lectura y el menú ⋮; verificar en `StudentsPage.test.jsx` que ambos caminos abren el mismo modal y que Escape lo cierra devolviendo el foco a la fila
- [ ] 3.3 Mostrar el estado de carga y el motivo cuando la consulta del detalle falla, sin inventar inscripciones ni importes; verificar con un test de fallo de la fuente
- [ ] 3.4 Correr `docker compose run --rm frontend npm run test -- src/admin/StudentsPage.test.jsx src/components/ui/componentes.test.jsx` y `docker compose run --rm frontend npm run lint`

## 4. Pestañas, estado e importes de cada inscripción

- [ ] 4.1 Renderizar una pestaña por inscripción con comisión, categoría —y porcentaje si es beca parcial—, empresa si es corporativa, estado de habilitación con su causa en las `ACTIVA` y el estado de la inscripción en las demás; verificar con un alumno de dos inscripciones, una habilitada y otra bloqueada, y con una inscripción `COMPLETADA`
- [ ] 4.2 Mostrar en cada pestaña total pagado, pendiente de acreditación y saldo pendiente; para corporativo, «A cargo de la empresa», y para beca total, exento; verificar los cuatro casos en `StudentsPage.test.jsx`
- [ ] 4.3 Mostrar el mensaje informativo cuando el alumno no tiene inscripciones y no renderizar pestañas; verificar con un test de alumno sin inscripciones
- [ ] 4.4 Permitir cambiar la categoría desde la pestaña abierta con el formulario y el `PATCH` de la HU 64, refrescando el detalle; verificar que la otra pestaña conserva su categoría
- [ ] 4.5 Correr `docker compose run --rm frontend npm run test -- src/admin/StudentsPage.test.jsx` y `docker compose run --rm frontend npm run lint`

## 5. Acciones desde el menú y padrón sin columna de acciones

- [ ] 5.1 Quitar la columna `ACCIONES` de la tabla del padrón y verificar en `StudentsPage.test.jsx` que ya no se renderiza ni queda una acción de categoría en la fila
- [ ] 5.2 Conectar **Editar**, **Restablecer contraseña** y **Eliminar** del menú ⋮ con los modales existentes, refrescando la ficha y la fila al terminar y cerrando la ficha al confirmar la baja; verificar cada recorrido, incluido un rechazo por dato duplicado
- [ ] 5.3 Verificar que una confirmación abierta desde la ficha se apila encima y que Escape cierra solo la de arriba, y correr `docker compose run --rm frontend npm run test -- src/admin/StudentsPage.test.jsx`

## 6. Verificación integrada

- [ ] 6.1 Correr la suite completa y el build: `docker compose run --rm backend pytest`, `docker compose run --rm backend ruff check .`, `docker compose run --rm frontend npm run lint`, `docker compose run --rm frontend npm run test` y `docker compose run --rm frontend npm run build`
- [ ] 6.2 Recorrer con los datos de ejemplo: abrir la ficha con mouse y con teclado, ver las pestañas de un alumno con dos categorías, comprobar el saldo contra la imputación del historial, cambiar la categoría de una pestaña y confirmar que el padrón no tiene columna de acciones

## Workflow follow-up

- Archivar el change cuando el equipo apruebe el resultado, después de archivar la HU 64, con `openspec archive hu-61-ficha-alumno-modal`, para sincronizar los deltas con `openspec/specs/`.
