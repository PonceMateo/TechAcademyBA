# Tasks

## 1. Decisiones, fuentes y dependencias

- [x] 1.1 Registrar en `docs/decisions.md`, antes de escribir código, las decisiones D79–D84: agregado único del tablero, agenda compartida, gráfico con fechas de pago, Chart.js + `react-chartjs-2`, superficies por rol sin sombra en el contenido y comprobantes recientes. Registrar además D85–D87 para la campana, las tarjetas docentes y el recorte de agenda. Verificar que cada sección tiene fecha, autor, decisión, por qué y dónde.
- [x] 1.2 Actualizar `docs/design/figma-dashboards-overhaul/README.md` con el archivo `QVNyPLVubV4A1szyQadoUe`, la página `53:2` y los nodos `53:716`, `53:355` y `53:3`, y con la regla de que los colores de tarjeta son `#f0f5fc`, `#eff7f3` y `#fcf8e9`. Verificar que el README no presente el set anterior como fuente vigente.
- [x] 1.3 Agregar `chart.js@^4.6.1` y `react-chartjs-2@^5.3.1` a `frontend/package.json`, actualizar el lockfile y verificar que `npm run build` termina sin errores de peer dependencies.

## 2. Agenda compartida en el backend

- [x] 2.1 Extraer `ENCUENTROS_VISIBLES`, `_proximos_encuentros`, `_rangos_del_dia` y `_dias_de_cursada` de `services/alumno.py` a `services/agenda.py`, con una función que reciba comisiones, fecha de inicio, ventana y límite. Verificar que la suite existente de `test_alumno.py` y `test_alumno_api.py` sigue en verde sin cambiar sus aserciones.
- [x] 2.2 Agregar `proximos_encuentros` a `ComisionAsignadaDocenteOut` y a `services/docente.py` usando la función compartida, con hasta cuatro encuentros por comisión. Verificar con pruebas de comisión vigente, finalizada, sin horarios y aislamiento entre docentes.
- [x] 2.3 Implementar la agenda conjunta de varias comisiones —ventana de hoy a siete días, orden por fecha y hora, límite ocho, sin fechas anteriores y sin encuentros de comisiones finalizadas—. Verificar con pruebas de dos días en la misma semana, más de ocho encuentros, sin horarios, sin período y período heredado sin fechas.

## 3. Agregado del tablero de Administración

- [x] 3.1 Crear `schemas/dashboard.py` con los indicadores, la serie mensual, la ocupación, los comprobantes recientes y los encuentros de agenda; reutilizar `ComprobantePendienteOut` y `EncuentroOut` cuando corresponda. Verificar con una prueba de serialización de importes decimales y fechas.
- [x] 3.2 Implementar `services/dashboard.py`: alumnos distintos con inscripción activa, inscripciones activas, cupo promedio de vigentes, total y vigentes del catálogo, comprobantes pendientes más cobranzas observadas, cobrado del mes, serie de seis meses con ceros reales, top tres de ocupación y cinco comprobantes por `enviado_at`. Verificar con pruebas de base vacía, dos inscripciones del mismo alumno, sobrecupo, meses sin cobros y solo cobranzas `ACREDITADO`.
- [x] 3.3 Exponer `GET /admin/dashboard` con `require_roles(Rol.ADMIN)`, incluirlo en `api/router.py` y documentar el contrato. Verificar con pruebas de 200 para admin, 403 para docente y alumno, 401 sin sesión y presencia de la ruta en el esquema OpenAPI.
- [x] 3.4 Cubrir la agenda del agregado con pruebas de todas las comisiones, orden por fecha y hora, máximo ocho y exclusión de comisiones finalizadas. Verificar que el servicio no hace una consulta por comisión.

## 4. Base visual y componentes compartidos

- [x] 4.1 Declarar en `index.css` los tokens por rol de superficie, superficie interna, borde, etiqueta, valor y apoyo, con los valores de la tabla de `design.md`. Verificar que un tablero de cada rol resuelve los tokens correctos y que el fondo degradado y la retícula no cambian.
- [x] 4.2 Hacer que `Card` y `Table` consuman los tokens, quitar `shadow-sm` de `Card` y de las tarjetas de `CoursesPage`, y conservar la sombra de modal, menú, selector y tooltip. Verificar con `npm run test` que las pruebas de componentes y de los tres shells siguen en verde, y revisar que ninguna superficie del contenido declare `shadow`.
- [x] 4.3 Crear `components/dashboard/Indicador.jsx` —ícono, rótulo, valor y contexto— y usarlo en los tres tableros. Verificar con pruebas de valor `—`, cero real y texto de contexto.
- [x] 4.4 Crear `components/dashboard/CobrosPorMes.jsx` con Chart.js y `react-chartjs-2`, registrando solo línea, puntos, escalas, relleno y tooltip, con el acento leído de `--acento` y un resumen textual accesible. Verificar con pruebas de serie con datos, serie de ceros y estado de error, y con `npm run build`.
- [x] 4.5 Crear `components/dashboard/AgendaSemanal.jsx` con la semana corriente, el día de hoy destacado, los encuentros agrupados por fecha y el rango horario. Verificar con pruebas de orden, agrupación, tema ausente, vacío y fecha real.
- [x] 4.6 Crear `components/dashboard/AvisosAtencion.jsx` para las alertas con cantidad y enlace, con mensaje informativo cuando no hay ninguna. Verificar con pruebas de lista con avisos, lista vacía y navegación por enlace.
- [x] 4.7 Mover los avisos al `ShellFrame`: crear `useAvisosSesion`, abrir la campana con click, cerrarla con click afuera o `Escape`, mostrar el punto solo con avisos y quitar el bloque de página de los tres tableros. Verificar con pruebas de campana con y sin avisos, cierre por teclado y por click afuera.

## 5. Tablero de Administración

- [x] 5.1 Agregar `obtenerDashboardAdmin()` a `services/dataService.js`, `apiDataSource.js` y `mockDataSource.js`, con la forma del contrato y sin cálculos de agregados en la pantalla. Verificar con pruebas de la frontera de datos y con el modo de ejemplo.
- [x] 5.2 Recomponer `admin/DashboardPage.jsx`: cuatro indicadores reales, `Panorama de cobros` con `Cobrado este mes` y ocupación, `Comprobantes recientes` con las mismas etiquetas de Cobranzas, `Accesos Rápidos del Personal` arriba de `Tu agenda` y la agenda recortada a cinco con su contador. Los avisos se leen en la campana del armazón, no en un bloque del tablero. Verificar con pruebas de valores, `—` durante la carga, error de lectura, tablero sin cobros, sin comprobantes, sin clases y sin alertas.
- [x] 5.3 Actualizar `admin/DashboardPage.test.jsx`: quitar las aserciones de los accesos inertes y del bloque con `—`, y agregar comparación de `Comprobantes recientes` con `listarComprobantes`, navegación de los accesos y de las alertas, y ausencia de los números del prototipo. Verificar con `npm run test -- DashboardPage`.

## 6. Tablero del Docente

- [x] 6.1 Normalizar en `apiDataSource.js` los `proximos_encuentros` que ahora trae `GET /docentes/mis-comisiones`, sin cambiar la forma de las comisiones existentes. Verificar con pruebas de la frontera con y sin encuentros.
- [x] 6.2 Recomponer `docente/TeacherCommissionsPage.jsx`: cuatro indicadores sobre comisiones activas, `Tus comisiones, a un vistazo` con tarjetas de dos por fila, tarjeta entera como enlace, fondos blanco/`#EBF7F2`, borde `#E3F2E9`, hover `#E7F2ED`, barra de acceso y sin scrollbar; solo activas ordenadas por próxima clase, sin finalizadas ni enlace suelto `Ir a mis alumnos`; `Tu agenda` de hasta cinco encuentros y avisos en la campana. Verificar con pruebas de docente con comisiones, sin comisiones, finalizada oculta, orden, agenda recortada, alertas y navegación al padrón.
- [x] 6.3 Actualizar `docente/TeacherCommissionsPage.test.jsx` para la nueva composición y eliminar las aserciones de la tabla y de los bloques de entregas. Verificar con `npm run test -- TeacherCommissionsPage`.

## 7. Tablero del Alumno

- [x] 7.1 Incorporar `listarPagosAlumno()` y `listarComprobantesAlumno()` al flujo del tablero, con la cuenta de acreditados, el total imputado, los pendientes y los observados. Verificar con pruebas de la frontera de datos para los dos modos.
- [x] 7.2 Recomponer `alumno/StudentDashboardPage.jsx`: cuatro indicadores con `COMPROBANTES ACREDITADOS` real, `Tu situación de pagos`, `Comprobantes recientes` y `Tu agenda` agrupada de hasta cinco encuentros. Los avisos de acceso bloqueado y comprobante observado viven en la campana. Verificar con pruebas de alumna con pagos, sin pagos, con pendientes, con observados, sin avisos, con agenda recortada, con agenda vacía y con error de lectura.
- [x] 7.3 Actualizar `alumno/StudentDashboardPage.test.jsx` para los valores reales y los bloques nuevos, conservando las pruebas de `CURSOS EN MARCHA`, `ACCESO A LA CLASE` y `PRÓXIMA CLASE`. Verificar con `npm run test -- StudentDashboardPage`.

## 8. Verificación de integración

- [x] 8.1 Ejecutar `docker compose exec -T backend ruff check app` y `docker compose exec -T backend pytest -q`; verificar que la suite completa queda en verde y que las pruebas nuevas cubren el agregado, la agenda y los permisos.
- [x] 8.2 Ejecutar `npm run lint`, `npm test` y `npm run build` en `frontend`; verificar que los tres terminan sin errores y que el bundle incluye el gráfico sin advertencias de peer dependencies.
- [ ] 8.3 Verificar los tres tableros con las tres cuentas de demostración: los valores reales coinciden con las pantallas de origen, `Comprobantes recientes` coincide con Cobranzas, la agenda muestra hasta cinco encuentros, la campana refleja los avisos del rol y ninguna superficie del contenido tiene sombra. Registrar el resultado en `docs/verificacion-definition-of-done.md`; si no hay navegador o cuentas disponibles, dejar explícita esa limitación.

## Workflow follow-up

- Revisar los artefactos con el equipo y, si se aprueban, ejecutar `/opsx-apply`.
- Al terminar la aplicación y la verificación, preguntar si se archiva el change con `openspec archive rediseno-dashboards-figma` para sincronizar los deltas con `openspec/specs/`.
- Actualizar el estado de las historias 55, 56 y 57 en el tablero solo después de que la verificación quede registrada.
