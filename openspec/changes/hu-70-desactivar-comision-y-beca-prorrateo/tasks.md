# Tasks

## 1. Decisiones y dominio compartido

- [x] 1.1 Registrar en `docs/decisions.md` las tres decisiones: estado de comisión derivado por consulta, reactivación por edición de `fecha_fin` y semántica de `importe_arancel` como base sin descuento. Verificar que el archivo quede con fecha, autor y la referencia a la H/U 70 y al issue #111.
- [x] 1.2 Mover `ZONA_HORARIA_DOMINIO` a un módulo de dominio compartido y agregar el helper de estado de comisión (`Vigente`/`Finalizada`, con fecha inyectable) junto a `cantidad_clases`. Verificar con tests unitarios de los bordes: `fecha_fin` hoy, ayer y mañana, y comisión sin fechas.

## 2. Estado de comisión en la API

- [x] 2.1 Exponer `estado` en `ComisionOut` y cubrir alta, consulta y edición con tests de API que comparen `Vigente`/`Finalizada` contra la fecha de fin. Verificar con `pytest backend/app/tests/test_altas_api.py backend/app/tests/test_edicion_comision.py`.
- [x] 2.2 Reemplazar `Activa`/`Inactiva` por `Vigente`/`Finalizada` en el perfil del docente. Verificar con un test de perfil que una comisión finalizada sigue listada y con estado `Finalizada`.

## 3. Solapamiento del docente por período

- [x] 3.1 Hacer que el chequeo de solapamiento reciba las fechas del alta o de la edición y descarte comisiones con períodos que no se cruzan, con comparación estricta de los extremos y trato conservador para comisiones sin fechas. Verificar con tests de alta: períodos disjuntos aceptados, períodos cruzados con `409` y borde `fin_a == inicio_b` aceptado.
- [x] 3.2 Pasar el período nuevo en la edición y cubrir la reactivación: `fecha_fin` futura sin cruce devuelve `Vigente`; con cruce devuelve `409` y conserva el período anterior. Verificar con `pytest backend/app/tests/test_edicion_comision.py`.

## 4. Rechazos en comisiones finalizadas

- [x] 4.1 Rechazar el alta de inscripción con `422` y mensaje «La comisión ya finalizó.» antes del chequeo de cupo. Verificar con tests de alta sobre comisión finalizada (no crea fila) y sobre comisión vigente (sigue creando).
- [x] 4.2 Rechazar la carga de nómina corporativa con `422` sobre una comisión finalizada, sin crear inscripciones ni contrato. Verificar con `pytest backend/app/tests/test_nomina_api.py` o el archivo equivalente de nómina.
- [x] 4.3 Cubrir que registrar o imputar un pago en una inscripción de comisión finalizada sigue permitido y no cambia su estado de habilitación. Verificar con un test de cobranzas sobre comisión finalizada.

## 5. Corrección del descuento de beca (#111)

- [x] 5.1 Quitar el descuento de `calcular_importe_arancel` y aplicarlo siempre en la derivación de montos sobre el importe base guardado; ajustar el redondeo a centavos. Verificar con tests de: alta tardía particular, alta tardía becada y monto requerido igual a base con descuento.
- [x] 5.2 Cubrir el `PATCH` de categoría: cambio a beca parcial sobre inscripción prorrateada aplica el descuento, y cambio a particular lo quita, sin re-prorratear ni modificar el importe base. Verificar con `pytest backend/app/tests/test_inscripciones_api.py backend/app/tests/test_alumnos_api.py`.
- [x] 5.3 Agregar la migración `0010` (down_revision `0009_inscripcion_arancel_merge`) que des-aplica el descuento de las filas `BECADO_PARCIAL` con `importe_arancel` no nulo, y su `downgrade` equivalente. Verificar con `docker compose exec backend alembic upgrade head` y después con una fila becada de prueba: el monto requerido conserva el mismo valor que antes de la migración.
- [x] 5.4 Actualizar el mock de datos y `montosDeInscripcion` para que apliquen el descuento sobre el importe base y no lo tomen como importe final, incluidos los datos de ejemplo con beca. Verificar con los tests de `frontend/src/services/dataService.test.jsx` y de la ficha del alumno.

## 6. Administración: estado y selector

- [ ] 6.1 Agregar la columna `ESTADO` después de `PERÍODO` en la tabla de comisiones, con chip verde `Vigente` y chip gris `Finalizada`, y mostrar `—` en `VACANTES` de las finalizadas sin chip `LLENO`. Verificar con tests de `CoursesPage` que cubran las dos filas y el chip.
- [ ] 6.2 Hacer que `InscripcionModal` ofrezca solo las comisiones vigentes y, cuando se abra desde `/admin/cursos/:codigo`, solo las de ese curso (`CoursesPage` le pasa `comisionesDelCurso` en lugar del catálogo); mostrar el motivo cuando la fuente responde `422` por comisión finalizada. Verificar con tests de `CoursesPage` y de `InscripcionModal` que cubran el selector acotado por curso y el del catálogo completo.
- [ ] 6.3 Agregar el estado de cada comisión al mock de catálogo (derivado de `fecha_fin`), quitar la etiqueta `Cerrada por cupo` de la vista del docente y mantener el contador `COMISIONES` del Dashboard contando todas. Verificar con los tests de `mockDataSource`, `CoursesPage` y el tablero.

## 7. Vista del docente

- [ ] 7.1 Mostrar el estado `Vigente`/`Finalizada` en cada fila de `Comisiones asignadas`, manteniendo la comisión finalizada en la lista. Verificar con un test de la vista del docente con una comisión finalizada.

## 8. Verificación de integración

- [ ] 8.1 Correr las suites completas en contenedores (`pytest` backend contra PostgreSQL real y `npm test` frontend) y corregir lo que falle. Verificar que no queden tests con el importe anterior ni con `Activa`/`Inactiva`.
- [ ] 8.2 Recorrer los escenarios de la H/U 70 de punta a punta: consulta de estado, alta y nómina rechazadas, reactivación, vacantes y tabla de Administración, pago permitido y vista del docente. Verificar que cada uno coincida con los deltas de specs.

## Workflow follow-up

- Archivar el change cuando la revisión esté aprobada, para sincronizar los deltas a `openspec/specs/`.
- Antes de archivar este change, resolver el estado de los changes abiertos `hu-50-prorrateo-arancel`, `hu-52-enviar-comprobante-alumno`, `hu-54-revision-comprobantes` y `hu-60-gestionar-inscriptos-comision`: sus deltas siguen sin archivarse.
