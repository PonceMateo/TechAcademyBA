# Tasks

> **Estado:** los pasos 1 a 6 están implementados en la rama. La verificación de la sección 7
> quedó pendiente porque el entorno no tenía Docker levantado: no se corrió ninguna suite.

## 1. Decisión y glosario, antes de tocar código

- [x] 1.1 Registrar la decisión **D62** en `docs/decisions.md` con fecha 2026-10-31, autor `PonceMateo` y el nombre del change: columna `fecha_fin` nula con CHECK de coherencia (expand, D56), período obligatorio en el contrato y opcional en la base, conteo derivado con `clases_del_periodo`, validación cruzada en el servicio con mensaje de texto, tope de encuentros en el panel del alumno, y fuera de alcance del prorrateo y los feriados. Verificar que la entrada exista, cite el change y esté escrita antes de cualquier cambio en `backend/`.
- [x] 1.2 Actualizar `docs/glossary.md`: la entrada **Comisión** suma `fecha_inicio` y `fecha_fin` al equivalente técnico, y se agregan los términos **Período de cursada** y **Cantidad de clases** (derivada, no persistida, sin feriados). Verificar que el glosario ya no diga que la comisión no tiene fecha de fin y que nombre las dos columnas.

## 2. Modelo y migración

- [x] 2.1 Agregar en `backend/app/models/catalogo.py` la columna `fecha_fin` (nula), la constante `EXPRESION_PERIODO` con su `CheckConstraint(..., name="periodo_coherente")`, la función pura `clases_del_periodo(inicio, fin, horarios)` y la property `cantidad_clases` que devuelve `None` sin período. Verificar que `docker compose run --rm backend pytest app/tests/test_migration.py -q` quede en verde y que el `alembic check` del punto 2.3 no reporte diferencias con el metadata.
- [x] 2.2 Escribir `backend/alembic/versions/0006_comision_periodo.py` (`down_revision = "0005_comision_horario"`) con `add_column` de `fecha_fin` nula, `create_check_constraint` con la misma cadena de `EXPRESION_PERIODO` y `downgrade` que borre la restricción y la columna. Verificar con `docker compose exec backend alembic upgrade head` seguido de `downgrade -1` y otro `upgrade head`, sin errores y sin pérdida de datos.
- [x] 2.3 Actualizar `backend/app/tests/test_migration.py`: versión esperada `0006_comision_periodo` y `ck_comision_periodo_coherente` en `CHECKS_ESPERADOS`. Verificar con `docker compose run --rm backend pytest app/tests/test_migration.py app/tests/test_migracion_horarios.py -q` y con `docker compose exec backend alembic check`.

## 3. Alta de comisión

- [x] 3.1 Exigir `fecha_inicio` y `fecha_fin` en `ComisionCreate`, sumar las dos fechas y `cantidad_clases` a `ComisionOut`, agregar `PeriodoInvalido` y `_validar_periodo` en `backend/app/services/catalogo.py`, asignar las fechas en `crear_comision` y traducir la excepción a `422` en la ruta con los mensajes `La fecha de fin no puede ser anterior a la de inicio.` y `El período no contiene ninguna clase: revisá las fechas o los días de cursada.`. En el mismo paso, darle fechas por defecto coherentes con los horarios a `factories.crear_comision` y agregar las fechas a los payloads de `test_altas_api.py` y `test_horarios_comision.py`. Verificar con `docker compose run --rm backend pytest app/tests/test_catalogo.py app/tests/test_altas_api.py app/tests/test_horarios_comision.py -q`.
- [x] 3.2 Cubrir los escenarios nuevos del alta en `backend/app/tests/test_catalogo.py`: alta con período válido que devuelve `201` y `cantidad_clases`, sin fechas `422`, fin anterior al inicio `422` con el mensaje del campo, período sin ninguna clase `422`, y los dos extremos del rango contados cuando caen en un día de cursada. Verificar que los casos nuevos pasen con `docker compose run --rm backend pytest app/tests/test_catalogo.py -q`.

## 4. Edición de comisión

- [x] 4.1 Sumar las fechas a `ComisionUpdate`, validarlas y asignarlas en `editar_comision`, y actualizar el docstring de la ruta y el del servicio. En el mismo paso, agregar las fechas a `_datos` y `_datos_nuevo` de `test_edicion_comision.py` y cubrir: edición del período con valores válidos, período inválido que responde `422` y conserva las fechas anteriores, edición que no modifica los aranceles ni las inscripciones, y comisión heredada que no se puede guardar sin período. Verificar con `docker compose run --rm backend pytest app/tests/test_edicion_comision.py -q`.

## 5. Panel del alumno

- [x] 5.1 Informar `fin=comision.fecha_fin` en el cronograma y cortar `_dias_de_cursada` en la fecha de fin, devolviendo vacío cuando el período ya terminó; actualizar el docstring de `CronogramaOut`. Cubrir con tests en `test_alumno.py` y `test_alumno_api.py`: fin informada, heredada con las dos fechas nulas, encuentros que no pasan el fin y cursada terminada sin encuentros. Verificar con `docker compose run --rm backend pytest app/tests/test_alumno.py app/tests/test_alumno_api.py -q`.
- [x] 5.2 Actualizar el comentario de cabecera de `frontend/src/alumno/CourseDetailPage.jsx`, que hoy explica que la comisión no tiene `fecha_fin`, y ajustar el caso de la fecha de fin en `CourseDetailPage.test.jsx` si el test fija el texto anterior. Verificar con `docker compose run --rm frontend npm run test` que la pantalla sigue mostrando «Todavía no está definida» solo para la comisión heredada.

## 6. Pantalla de comisiones

- [x] 6.1 Sumar los dos campos de fecha al alta y a la edición en `frontend/src/admin/CoursesPage.jsx` con `Input type="date"`, precargarlos al abrir la edición, validarlos en el formulario (obligatorias y fin mayor o igual al inicio, con el error en el campo) y enviarlos en los dos payloads. Verificar con `docker compose run --rm frontend npm run test` que el formulario no deja guardar sin fechas ni con el fin anterior al inicio.
- [x] 6.2 Agregar la columna `PERÍODO` a la tabla de comisiones con el rango formateado o «Sin definir», y mostrar «N clases en el período» en la edición con la `cantidad_clases` que devuelve la API, sin recalcularla en el navegador. Verificar con `docker compose run --rm frontend npm run test` y comprobando en la pantalla que una comisión sin período se ve como «Sin definir».
- [x] 6.3 Completar los datos del ejemplo: fechas y `cantidad_clases` en las diez comisiones de `frontend/src/mocks/comisiones.js`, y el cálculo del conteo al crear y editar en `frontend/src/services/mockDataSource.js`, en un único helper documentado como propio de la demo. Verificar que con la fuente de datos de ejemplo la tabla muestre el período y que el conteo coincida con el que devuelve el backend para una comisión equivalente.

## 7. Integración

- [ ] 7.1 Correr la suite completa con `docker compose run --rm backend pytest` y `docker compose run --rm frontend npm run test`; si el CI corre lint y build, correr también `docker compose run --rm frontend npm run lint` y `npm run build`. Verificar que todo quede en verde antes de abrir el PR.
- [ ] 7.2 Verificar el change con `openspec validate hu-49-periodo-cursada-comision --type change` y revisar con `git diff --stat main` que la rama solo traiga los archivos de este change y de la H/U 49, sin migraciones ajenas ni archivos del entorno.
- [ ] 7.3 Avisar al equipo que la rama toca `backend/alembic/` y que el CI aplica `alembic upgrade head` sobre Supabase después de las suites (D56), antes de pushear. Verificar que el aviso quede en el issue o en el PR con la referencia `Refs #74`.
