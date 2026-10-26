# Tasks

## 1. Base compartida del frontend

- [ ] 1.1 Agregar `react-phone-number-input` a `frontend/package.json`, instalarlo en el contenedor y verificar que `npm run build` resuelve el import y actualiza el lockfile
- [ ] 1.2 Crear `frontend/src/domain/validacion.js` con `emailConForma`, `dniConForma`, `dniDigitos`, `componerCuil` y `partirCuil`, y cubrir válidos, inválidos y bordes en `validacion.test.js`
- [ ] 1.3 Crear `frontend/src/components/ui/CampoTelefono.jsx` con `defaultCountry="AR"`, selector de todos los países, entrega E.164, modo legacy para valores no parseables y el estilo de error del `Input` existente; cubrirlo en `CampoTelefono.test.jsx` con válido, vacío, legacy y país inicial

## 2. Validadores y contrato del backend

- [x] 2.1 Agregar `DniConForma`, `TelefonoE164` y `validar_cuil` a `backend/app/schemas/validators.py`, y cubrir 7/8 dígitos, separadores, letras, E.164, prefijo de CUIL, DNI coincidente y DNI de 7 dígitos en `backend/app/tests/test_validators.py`
- [x] 2.2 Usar `DniConForma` en `AlumnoCreate.documento` y `DocenteCreate.dni`, retirar el validador local de `alumnos.py` y verificar con `pytest` que el alta y la edición de ambos padrones aceptan y rechazan los mismos DNI
- [x] 2.3 Usar `TelefonoE164` en `DocenteCreate.telefono` y `AlumnoCreate.telefono` (y sus `Update`), y verificar con `pytest` que E.164 y `null` se aceptan y un texto libre da `422`
- [x] 2.4 Agregar `cuil` opcional a `DocenteCreate`/`DocenteUpdate` con un validador que lea el DNI, y verificar con `pytest` alta sin CUIL, alta con CUIL válido, CUIL parcial, prefijo inválido, DNI que no coincide, DNI de 7 dígitos y verificador incorrecto aceptado
- [x] 2.5 Actualizar `crear_docente` para guardar `datos.cuil` y `editar_docente` para tocar el CUIL solo si `"cuil" in datos.model_fields_set`; verificar con `pytest` que omitirlo conserva, `null` borra y un valor nuevo reemplaza
- [x] 2.6 Corregir el CUIL de Rita en `backend/app/services/seed.py` a `27301112225` y hacer que `_upsert_docente` asigne `cuil` también en la fila existente; verificar corriendo el seed dos veces y comprobando que el CUIL no cambia en la segunda
- [x] 2.7 Actualizar los docstrings de `backend/app/api/padron.py`, `backend/app/schemas/padron.py` y `backend/app/models/padron.py` que todavía dicen que el CUIL está fuera del contrato o usan el CUIL viejo como ejemplo, y verificar con una búsqueda de “CUIL fuera del contrato”, “sin CUIL” y `27345678907` que no queden referencias falsas

## 3. Formularios del frontend

- [ ] 3.1 En `TeachersPage.jsx`, reemplazar la validación local de email y DNI por las funciones compartidas y el `Input` de teléfono por `CampoTelefono`; verificar con `TeachersPage.test.jsx` email inválido, DNI inválido, teléfono inválido y teléfono válido en alta y edición
- [ ] 3.2 En `TeachersPage.jsx`, agregar los controles de CUIL, la composición prefijo + DNI + verificador, el envío de 11 dígitos o `null`, el limpiado del verificador al cambiar DNI o prefijo, la recomposición al editar y el formato `XX-XXXXXXXX-X` en la tabla; verificar con `TeachersPage.test.jsx` CUIL completo, parcial, sin CUIL, edición con CUIL y cambio de DNI
- [ ] 3.3 En `StudentsPage.jsx`, quitar `emailConForma` local, usar las funciones compartidas de email y DNI y reemplazar el `Input` de teléfono por `CampoTelefono` en alta y edición; verificar con `StudentsPage.test.jsx` los mismos casos de email, DNI y teléfono
- [ ] 3.4 En `CoursesPage.jsx`, agregar `Number.isInteger(Number(campos.cupo))` a la validación del alta y verificar con `CoursesPage.test.jsx` que `1.1`, `5.3`, cero, negativo y vacío muestran «El cupo debe ser un entero positivo» y que un entero válido se envía
- [ ] 3.5 Actualizar los comentarios de `frontend/src/services/dataService.js` y de `TeachersPage.jsx` que dicen que el contrato no lleva CUIL, y verificar con una búsqueda de “sin CUIL” y “D33” que no queden referencias falsas

## 4. Decisiones

- [x] 4.1 Registrar en `docs/decisions.md` el teléfono E.164, los validadores compartidos, el CUIL opcional con verificador manual sin módulo 11, la corrección del seed y el change aparte `errores-422-por-campo`; verificar que la entrada tenga fecha, autor y las alternativas descartadas

## 5. Integración

- [ ] 5.1 Ejecutar `docker compose run --rm backend pytest` y `docker compose run --rm backend ruff check .`; verificar que pasan sin errores
- [ ] 5.2 Ejecutar `docker compose run --rm frontend npm run test`, `npm run lint` y `npm run build`; verificar que pasan sin errores
- [ ] 5.3 Correr `docker compose run --rm backend python -m app.services.seed` dos veces y verificar en la base que Rita queda con `27301112225` y que la segunda corrida no cambia nada
- [ ] 5.4 Consultar en la base las filas de `docente` con `cuil` no nulo y comparar los 8 dígitos del medio con `dni_norm`; documentar las diferencias antes de desplegar
- [ ] 5.5 Probar en el navegador el alta y la edición de un docente con teléfono y CUIL, el alta de un alumno con teléfono y el alta de una comisión con cupo `1.1`; verificar los mensajes y que el formulario no cierre ante el rechazo
- [ ] 5.6 Ejecutar `openspec validate "validaciones-formularios"` y `openspec status --change "validaciones-formularios"`; verificar que el change queda válido y con todos los artefactos listos
