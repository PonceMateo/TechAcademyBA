# Tasks

## 1. Decisión y contrato de inscripciones en el backend

- [x] 1.1 Registrar en `docs/decisions.md` la decisión de contrato de este cambio —`GET /alumnos` sin datos de inscripción, `GET /alumnos/{id}` como único detalle, alta de inscripción con categoría, y el forzado por inscripción pendiente en la H/U 30— con fecha y autor, y verificar que la entrada queda antes de tocar el código
- [x] 1.2 Extraer en `backend/app/services/inscripciones.py` una validación compartida de categoría, porcentaje de beca y empresa, y usarla en el alta y en `PATCH`; verificar que `test_inscripciones.py` y `test_inscripciones_api.py` siguen en verde
- [x] 1.3 Extender `backend/app/schemas/inscripciones.py` con `porcentaje_beca` y `empresa_id` en el alta y guardarlos en la inscripción; verificar con tests nuevos de alta particular, beca parcial válida, porcentaje fuera de rango, corporativo con empresa, corporativo sin empresa y empresa inexistente
- [x] 1.4 Sumar `categoria` a `InscripcionDisponibleOut` y verificar que `GET /alumnos/{id}/inscripciones` la devuelve en `test_inscripciones_api.py`
- [x] 1.5 Correr `docker compose run --rm backend pytest app/tests/test_inscripciones.py app/tests/test_inscripciones_api.py -q` y confirmar que pasa

## 2. Padrón y detalle del alumno en el backend

- [x] 2.1 Quitar `inscripcion_id`, `comision`, `categoria`, `porcentaje_beca` y `acceso` de `AlumnoOut` y simplificar `listar_alumnos` para no derivar habilitación; verificar con `test_alumnos_api.py` y `test_alumnos_gestion.py` actualizados al contrato nuevo
- [x] 2.2 Implementar `GET /alumnos/{id}` con todas sus inscripciones —comisión, categoría, porcentaje, empresa y acceso derivado— cargando comisión, curso y empresa sin N+1 y **declarándola después de `GET /alumnos/reactivable`**, para que el path param no se coma esa ruta; verificar con tests de alumno con dos categorías, alumno sin inscripciones, corporativa con empresa, inscripción no activa sin acceso, `GET /alumnos/reactivable` con `200`, `404`, `403` y `401`
- [x] 2.3 Correr `docker compose run --rm backend pytest app/tests/test_alumnos_api.py app/tests/test_alumnos_gestion.py app/tests/test_cobranzas_api.py -q` y `docker compose run --rm backend ruff check .`

## 3. Servicios y datos de ejemplo del frontend

- [ ] 3.1 Agregar `obtenerAlumno(id)` en `src/services/dataService.js`, `apiDataSource.js` y `mockDataSource.js`, apuntando a `GET /alumnos/{id}`; verificar la ruta en `apiDataSource.test.js`
- [ ] 3.2 Agregar a los mocks un alumno con una inscripción corporativa y otra particular, con su empresa, y ajustar `mocks.test.js`; verificar que el caso de dos categorías existe en los datos de ejemplo
- [ ] 3.3 Actualizar los fixtures de tests que hoy esperan `comision`, `categoria`, `porcentaje_beca` o `acceso` en la respuesta del padrón, y verificar que `dataService.test.jsx` pasa

## 4. Padrón de alumnos sin datos de inscripción

- [x] 4.1 Dejar la tabla con las columnas `DNI`, `NOMBRE`, `EMAIL`, `TELÉFONO` y `ACCIONES`, quitando comisión, categoría y acceso; verificar en `StudentsPage.test.jsx` que la fila no los renderiza
- [x] 4.2 Hacer que la acción **Categoría** abra directo con una inscripción, pida elegir con varias y avise cuando no hay ninguna, aplicando el cambio solo a la elegida; verificar con un test de alumno con dos inscripciones donde la otra queda intacta
- [x] 4.3 Correr `docker compose run --rm frontend npm run test -- src/admin/StudentsPage.test.jsx` y `docker compose run --rm frontend npm run lint`

## 5. Alta de inscripción con categoría en Comisiones

- [x] 5.1 Agregar al modal de inscripción los campos de categoría, porcentaje de beca y empresa, con la validación local antes de enviar; verificar en `CoursesPage.test.jsx` los casos particular, beca parcial con y sin porcentaje y corporativo con y sin empresa
- [x] 5.2 Conectar `+ Nueva Empresa` con el alta de empresa existente, conservando alumno, comisión y categoría y dejando seleccionada la empresa creada; verificar con un test de ese recorrido
- [x] 5.3 Verificar que un `409` de cupo completo o inscripción duplicada deja el modal abierto con el motivo, y correr `docker compose run --rm frontend npm run test -- src/admin/CoursesPage.test.jsx`

## 6. Accesos con una sección por inscripción

- [ ] 6.1 Cambiar `src/admin/AccessPage.jsx` para resolver la búsqueda contra el padrón por DNI, email o nombre y, sin resultado, contra las empresas por CUIT o razón social, pedir `GET /alumnos/{id}` y mostrar una sección por inscripción `ACTIVA` con curso, categoría, estado y causa; quitar `buscarHabilitacion`, `ultimoPagoAcreditado` y `PATHS.habilitacion` de `src/services/` con sus tests; verificar en `AccessPage.test.jsx` el alumno con dos inscripciones, el alumno sin inscripciones activas y la búsqueda de una empresa
- [ ] 6.2 Dejar el forzado de bloqueo como está —motivo obligatorio, usuario y fecha, contra el alumno— sin extenderlo a una sección: el forzado por inscripción es la H/U 30, que agrega su endpoint; verificar que los tests del forzado y de la copia de correos siguen igual
- [ ] 6.3 Correr `docker compose run --rm frontend npm run test -- src/admin/AccessPage.test.jsx` y `docker compose run --rm frontend npm run lint`

## 7. Inscripción identificada en Cobranzas

- [ ] 7.1 Mostrar la categoría y el estado en el selector de inscripción de `src/admin/PaymentsPage.jsx`; verificar en `PaymentsPage.test.jsx` que un alumno con dos inscripciones ve las dos con su categoría y que el pago se imputa solo a la elegida
- [ ] 7.2 Correr `docker compose run --rm frontend npm run test -- src/admin/PaymentsPage.test.jsx`

## 8. Verificación integrada

- [ ] 8.1 Correr la suite completa del backend y del frontend más el build: `docker compose run --rm backend pytest`, `docker compose run --rm backend ruff check .`, `docker compose run --rm frontend npm run lint`, `docker compose run --rm frontend npm run test` y `docker compose run --rm frontend npm run build`
- [ ] 8.2 Recorrer con los datos de ejemplo: inscribir al alumno de dos categorías en otra comisión, ver las dos secciones en Accesos, cambiar la categoría de una sola y confirmar que el padrón no muestra comisión, categoría ni acceso

## Workflow follow-up

- Archivar el change cuando el equipo apruebe el resultado, con `openspec archive hu-64-categoria-por-inscripcion`, para sincronizar los deltas con `openspec/specs/`.
