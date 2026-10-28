# Tasks

## 1. Decisiones y contratos

- [x] 1.1 Registrar en `docs/decisions.md` las decisiones del change (recurso `/alumno` sin identificador de alumno, reutilización de `derivar_estado`, cronograma derivado de `comision_horario`, sincronización de email entre cuenta y padrón) con fecha y autor; verificar que la entrada existe y cita el change.
- [x] 1.2 Crear `backend/app/schemas/alumno.py` con los contratos de salida (`InscripcionAlumnoOut`, `DetalleCursadaOut`, `PerfilAlumnoOut`) y el de entrada `PerfilAlumnoUpdate` con solo `email` y `telefono` y `extra="forbid"`, reutilizando `EmailConForma` y `TelefonoE164`; verificar con un test que el esquema rechaza `documento`, `nombre` e `id` con `ValidationError`.

## 2. Servicio del alumno (backend)

- [x] 2.1 Implementar en `backend/app/services/alumno.py` la resolución del alumno desde la cuenta autenticada y el listado de inscripciones propias con `habilitacion.derivar_estado`, horarios y categoría; verificar con tests de servicio sobre PostgreSQL real que trae solo las inscripciones del alumno y que la causa coincide con la administrativa.
- [x] 2.2 Implementar el detalle por código de comisión que devuelve los datos de la comisión y responde como no encontrado cuando la comisión no es una inscripción del alumno; verificar con tests que un alumno distinto recibe el mismo resultado que un código inexistente.
- [x] 2.3 Implementar el cálculo de próximos encuentros desde `ComisionHorario` (cuatro encuentros desde el día corriente) con el tema de `Clase` cuando exista, dejando el comentario `ponytail:` sobre feriados y suspensiones; verificar con tests de fechas fijas que el orden es cronológico y que un encuentro sin clase cargada viene sin tema.
- [x] 2.4 Implementar lectura del perfil y actualización de email y teléfono en una sola transacción (padrón y cuenta), con `ensure_email_available` excluyendo la propia cuenta y teléfono vacío guardado como `None`; verificar con tests que el email duplicado lanza el conflicto, que el email viejo deja de servir para login y que un teléfono inválido no se persiste.

## 3. API `/alumno` (backend)

- [ ] 3.1 Crear `backend/app/api/alumno.py` con `GET /alumno/inscripciones`, `GET /alumno/inscripciones/{codigo}`, `GET /alumno/mi-perfil` y `PUT /alumno/mi-perfil`, todas con `require_roles(Rol.ALUMNO)`, y registrarlo en `app/api/router.py`; verificar que las cuatro rutas aparecen en `/docs` y que el import de la app no rompe.
- [ ] 3.2 Mapear los errores del servicio a `404` (comisión ajena o inexistente), `409` (email duplicado) y `422` (forma inválida o campos no editables); verificar con tests de API que cada código y su mensaje en es-AR son los esperados.
- [ ] 3.3 Cubrir el aislamiento y la autorización en `app/tests/test_alumno_api.py`: `403` para `ADMIN` y `DOCENTE`, `403` de contraseña pendiente para una cuenta de alumno con `must_change_password` y datos de otro alumno inaccesibles en cualquier respuesta; verificar corriendo `docker compose run --rm backend pytest app/tests/test_alumno_api.py`.

## 4. Frontera de datos (frontend)

- [ ] 4.1 Agregar `actualizarPerfilAlumno` a `frontend/src/services/dataService.js` y a `apiDataSource.js` (`PUT` a `/alumno/mi-perfil`) y ajustar el detalle al contrato nuevo (`horarios`, `cronograma.fin` nulo, sin `link`); verificar con el test de `dataService` que el servicio devuelve lo que entrega la fuente.
- [ ] 4.2 Alinear `frontend/src/services/mockDataSource.js` a la misma forma y agregar el guardado del perfil con conflicto de email simulado; verificar que los tests de pantalla que usan el mock pasan sin cambiar sus expectativas de forma.

## 5. Pantallas del alumno

- [ ] 5.1 Recomponer `frontend/src/alumno/StudentCoursesPage.jsx` con los datos reales, el banner de acceso con causa y el estado de carga que no muestra "sin cursos" antes de resolver; verificar con tests de pantalla que un alumno sin inscripciones ve el mensaje y que uno bloqueado ve la causa.
- [ ] 5.2 Recomponer `frontend/src/alumno/CourseDetailPage.jsx` con período y próximos encuentros reales, tema pendiente cuando falta y estado de "no encontré esa cursada" para una comisión ajena; verificar con tests de pantalla que no se renderiza ningún link ni botón de ingreso.
- [ ] 5.3 Implementar en `frontend/src/alumno/StudentProfilePage.jsx` el guardado real de email y teléfono (con botón deshabilitado mientras guarda), el mensaje de conflicto de email y la tarjeta de seguridad que usa `SessionContext.changePassword`; verificar con tests de pantalla el guardado exitoso, el `409` y el cambio de contraseña exitoso y fallido.
- [ ] 5.4 Actualizar los tests existentes que esperan los literales del maquetado (`CUR-102`, `Lic. Laura Benítez`, `$31.000`) y el aviso de datos de referencia; verificar con `docker compose run --rm frontend npm run test` en verde.

## 6. Cierre

- [ ] 6.1 Correr la suite completa y el lint de los dos servicios (`docker compose run --rm backend pytest`, `docker compose run --rm backend ruff check .`, `docker compose run --rm frontend npm run test`, `docker compose run --rm frontend npm run lint`) y verificar que terminan sin errores.
- [ ] 6.2 Verificar que `Mis Pagos`, el link de la clase y los certificados siguen sin cambios funcionales y que no se agregaron rutas ni ítems de menú; comprobar con `git diff --stat` y una revisión de `App.jsx` y `navegacion.js`.
- [ ] 6.3 Probar el flujo completo en el navegador contra la API real: alumno bloqueado ve causa, alumno habilitado ve cursada y cronograma, cambio de teléfono persiste y el cambio de contraseña deja la anterior inválida.
