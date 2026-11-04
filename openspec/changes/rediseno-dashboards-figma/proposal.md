# Proposal

## Why

Los tres tableros ya muestran datos reales parciales (H/U 55, 56 y 57), pero su composición sigue
siendo la del maquetado anterior: indicadores sin contexto, `—` en comprobantes acreditados,
alertas sin fuente y una agenda que solo existe para el alumno y el docente. El cliente congeló en
Figma (*Prototipo TechAcademy BA* → página *Techacademy - UI Overhaul*) una composición nueva: cuatro
indicadores con ícono y contexto, un panorama de cobros, comprobantes recientes y una agenda común a
los tres roles. Lo que el prototipo muestra sin datos detrás se reemplaza por funcionalidad real.

El modelo no guarda la fecha de inscripción, así que el gráfico y el bloque de novedades no pueden
salir de inscripciones: se construyen con las fechas de pago de las cobranzas y con los comprobantes
que envían los alumnos, que sí las registran.

## What Changes

- Agregar `GET /admin/dashboard`, un único agregado con los cuatro indicadores, la serie mensual de
  cobros acreditados, la ocupación por comisión, los cinco comprobantes más recientes y la agenda de
  las próximas clases de todas las comisiones.
- Extraer la agenda de `services/alumno.py` a un servicio compartido y reutilizarla en el tablero del
  administrador, en el del docente y en el del alumno.
- Ampliar `GET /docentes/mis-comisiones` con los próximos encuentros de cada comisión asignada.
- Completar `COMPROBANTES ACREDITADOS` del alumno con `GET /alumno/pagos` y sumar el aviso de
  comprobantes observados y el conteo de los que están en revisión (H/U 57).
- Rehacer los tres tableros con la composición del Figma: tarjetas de indicador con ícono y contexto,
  panorama de cobros con Chart.js, comprobantes recientes, agenda semanal y bloque de atención.
- **BREAKING (interfaz):** el bloque `Alertas de Gestión Pendiente` se reemplaza por `Requiere tu
  atención` con alertas reales y enlaces; los accesos rápidos dejan de ser inertes y navegan a la
  pantalla donde se resuelve cada acción. `Descargar Reporte del Día` desaparece porque no tiene
  historia ni endpoint detrás.
- Dar a las superficies del contenido un fondo por rol —azul, verde o crema— y quitar las sombras de
  las tarjetas, la barra y el pie, como en el Figma. Los modales, menús y tooltips conservan su
  elevación porque flotan sobre el contenido.

## Capabilities

### New Capabilities

- `dashboard-agregados`: contrato de los agregados de los tres tableros —indicadores, serie mensual
  de cobros, ocupación por comisión, comprobantes recientes y agenda— y sus reglas de permisos,
  ventana de fechas y ausencia de datos inventados.

### Modified Capabilities

- `admin-shell`: el tablero operativo deja de mostrar valores pendientes y pasa a mostrar
  indicadores, cobros, comprobantes recientes, agenda de todas las comisiones y alertas reales.
- `teacher-shell`: el tablero pasa de una tabla de comisiones a tarjetas con indicadores reales,
  agenda de las próximas clases y alertas de acceso, sin bloques de entregas ni asistencia promedio.
- `student-shell`: el tablero suma la situación de pagos, los comprobantes recientes y el aviso
  accionable de la H/U 57, con la agenda agrupada por día.

## Impact

- Backend: `api/dashboard.py` (nuevo), `schemas/dashboard.py` (nuevo), `services/dashboard.py`
  (nuevo), `services/agenda.py` (nuevo), `services/alumno.py`, `services/docente.py`,
  `schemas/docente.py`, `api/router.py`, pruebas.
- Frontend: `admin/DashboardPage.jsx`, `docente/TeacherCommissionsPage.jsx`,
  `alumno/StudentDashboardPage.jsx`, componentes nuevos de tablero y gráfico, `components/ui/Card.jsx`,
  `components/ui/Table.jsx`, `components/shell/ShellFrame.jsx`, `index.css`, `services/*`,
  `package.json` (`chart.js`, `react-chartjs-2`), pruebas.
- Datos: sin migraciones. La agenda usa `comision_horario` y el período de cursada; el gráfico y los
  comprobantes usan `cobranza.fecha` y `comprobante_alumno.enviado_at`.
- Documentación: `docs/decisions.md` (D79–D84) y `docs/design/figma-dashboards-overhaul/README.md`
  con los nodos de la página *Techacademy - UI Overhaul*.
