# Design

## Context

Ver `proposal.md` — Why. Lo que condiciona el approach:

- **La fuente visual es la página *Techacademy - UI Overhaul* del archivo `Prototipo TechAcademy BA`**
  (`file_key` `QVNyPLVubV4A1szyQadoUe`, página `53:2`). Los tres tableros son `53:716`
  (Admin / Secretario), `53:355` (Profesor) y `53:3` (Alumno). Las capturas de
  `docs/design/figma-dashboards-overhaul/` son del pase anterior; el Figma es la autoridad y esta
  change toma de ahí geometría, textos de bloque y color.
- **El Figma no aporta datos.** Los valores del prototipo (`1.248`, `32`, `$ 8,4 M`, `12`, `18`,
  `92 %`, `68 %`) no se reproducen: los valores salen de la base.
- **No hay fecha de inscripción.** `inscripcion` no tiene `created_at`, así que ni el gráfico ni el
  bloque de novedades pueden ser “inscripciones por mes”. Las dos fuentes con fecha son
  `cobranza.fecha` y `comprobante_alumno.enviado_at`.
- **El agregado del tablero no puede vivir en la pantalla.** El spec de `admin-shell` prohíbe que la
  pantalla calcule agregados; con cuatro indicadores, una serie, ocupación, comprobantes y agenda,
  hacerlo en el navegador serían cinco lecturas y números que pueden no coincidir entre sí.
- **La agenda ya existe dos veces.** `services/alumno.py` deriva encuentros de `comision_horario` y
  `services/docente.py` deriva una próxima clase. El tablero del admin necesita la misma regla sobre
  todas las comisiones: conviene una sola implementación.
- **Los tres shells comparten `ShellFrame` y `Card`.** El cambio de superficie y la quita de sombras
  se hacen una vez en los componentes compartidos y en `index.css`, no pantalla por pantalla.

## Goals / Non-Goals

**Goals:**

- Un contrato único por tablero: el admin pide un agregado; el docente recibe sus encuentros en la
  misma respuesta que sus comisiones; el alumno sigue usando sus endpoints actuales.
- Una agenda idéntica en reglas para los tres roles: hoy, próximos siete días, ordenada, sin
  inventar feriados.
- Superficies por rol y tarjetas planas, con los colores exactos del Figma.
- Gráfico de cobros acreditados con una librería mantenida y compatible con React 19.

**Non-Goals:**

- Agregar `inscripcion.created_at` ni una migración de datos históricos.
- Modelar entregas, notas, progreso, asistencia promedio, mensajes o novedades.
- Crear una pantalla de agenda, rutas o ítems de menú nuevos.
- Rediseñar las pantallas interiores: solo heredan superficie, tarjeta y tabla.
- Enviar correos, notificaciones o recordatorios de cuota.

## Decisions

**1. Un solo `GET /admin/dashboard`.**

Devuelve `indicadores`, `cobros_por_mes`, `ocupacion_por_comision`, `comprobantes_recientes` y
`agenda` en una respuesta. Alternativa descartada: que la pantalla llame a `/alumnos`, `/comisiones`,
`/cobranzas`, `/comprobantes` y derive la agenda con una llamada por comisión. Serían cinco lecturas
en momentos distintos, números que no cierran entre sí y agregados calculados en el navegador, que el
spec prohíbe.

**2. La agenda se extrae a `services/agenda.py`.**

`ENCUENTROS_VISIBLES`, `_proximos_encuentros`, `_rangos_del_dia` y `_dias_de_cursada` se mueven desde
`services/alumno.py` a un módulo compartido, con una función que recibe comisiones, fecha de inicio,
ventana y límite. La usan el alumno (4 por cursada), el docente (4 por comisión, dentro de
`/docentes/mis-comisiones`) y el admin (8 en total, todas las comisiones). Alternativa descartada:
duplicar la regla en los tres servicios; tres implementaciones de “próxima clase” terminan mostrando
fechas distintas para el mismo horario.

**3. El gráfico y los comprobantes recientes salen de pagos, no de inscripciones.**

`cobros_por_mes` suma solo `cobranza` en estado `ACREDITADO`, agrupada por `fecha`, con seis meses
calendario completos y ceros reales en los meses sin cobros. `cobrado_mes_actual` es la misma suma
para el mes corriente. Alternativa descartada: agregar `created_at` a `inscripcion`; no hay fecha
histórica que completar, así que el gráfico arrancaría vacío y mentiría sobre el pasado. Queda como
historia futura si el cliente quiere reportería de inscripciones.

**4. Chart.js 4 + `react-chartjs-2` 5.3.1.**

`react-chartjs-2` declara `react` `^19.0.0` en sus peer dependencies y `chart.js` `^4.1.1`; las
versiones actuales son 5.3.1 y 4.6.1. Se registran solo los controladores de línea, escalas, puntos,
relleno y tooltip. Alternativas descartadas: **Recharts**, que tiene issues abiertos de gráficos en
blanco con React 19.2/19.3 (el proyecto usa `react ^19.3.0`), y **SVG propio**, que evita la
dependencia pero obliga a mantener ejes, tooltips y accesibilidad sin ser la librería que se pidió.

**5. Superficies por rol y sin sombra en el contenido.**

Tokens en `index.css`, resueltos por `data-acento`:

| Rol | Fondo del shell | Tarjeta | Superficie interna | Borde | Etiqueta | Valor | Apoyo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Secretaría | gradiente `#f0f7ff → #d4e2f6 → #c7daf7` | `#f0f5fc` | `rgba(245, 247, 250, 0.50)` / `#e8f0ff` | `#e8edf0` | `#6e7c8c` | `#253347` | `#2d5da9` |
| Docente | gradiente `#e8fff3 → #d1e7db → #c7e5d4` | `#eff7f3` | `#e5f2eb` | `#e8edf0` | `#6e7c8c` | `#253347` | `#226b58` |
| Alumno | gradiente `#fcf9f0 → #f8edc3 → #f2e5ad` | `#fcf8e9` | `#fbf2ce` | `#e8edf0` | `#6e7c8c` | `#253347` | `#806217` |

`Card` deja de usar `shadow-sm`; las tarjetas de curso de `CoursesPage` pierden `shadow-sm` y
`hover:shadow`. La barra, el pie y el lateral tampoco llevan sombra. **Los flotantes conservan su
elevación** —modal, menú de perfil, selector, tooltip— porque se separan del contenido y el Figma no
muestra esos estados. La sombra del Figma es `0 4px 18px rgba(54, 84, 107, 0.03)`, un 3 % que a ojo
es plano: el resultado visual es el mismo sin declararla.

**6. Las etiquetas de los indicadores las fija la historia, no el prototipo.**

| Historia | Figma | Tablero |
| --- | --- | --- |
| H/U 55 | Alumnos activos | `ALUMNOS INSCRIPTOS` |
| H/U 55 | Comisiones en curso | `COMISIONES` |
| H/U 55 | Cobrado este mes | valor destacado de `Panorama de cobros` |
| H/U 55 | Solicitudes pendientes | `COBROS PENDIENTES DE COBRO` |
| H/U 56 | Mis comisiones / Alumnos a cargo | `COMISIONES ACTIVAS` / `ALUMNOS HABILITADOS` |
| H/U 56 | Entregas por corregir / Asistencia promedio | `BLOQUEADOS` / `PRÓXIMA CLASE` |
| H/U 57 | Progreso general / Tareas pendientes / Mi asistencia | `COMPROBANTES ACREDITADOS` + situación de pagos |

La disposición —cuatro tarjetas con ícono y contexto— es la del Figma. Las etiquetas son las de las
historias porque son el contrato aceptado; cambiar el rótulo cambiaría el criterio de aceptación.

**7. `Últimas inscripciones` pasa a `Comprobantes recientes`.**

Cinco comprobantes de cualquier estado, ordenados por `enviado_at` descendente, con la misma forma y
las mismas etiquetas que `GET /comprobantes` y el bloque `Comprobantes de alumnos` de
`/admin/cobranzas`. Alternativa descartada: mantener el título y mostrar inscripciones; sin fecha de
inscripción, “recientes” no tendría definición y el bloque no podría coincidir con Cobranzas.

**8. Accesos rápidos reales, sin el reporte del día.**

`Registrar Cobranza` va a `/admin/cobranzas` y `Verificar Habilitaciones` a `/admin/alumnos`, donde la
ficha del alumno contiene la habilitación por inscripción (D78). `Descargar Reporte del Día`
desaparece: no hay historia, endpoint ni pantalla de reportería. Alternativa descartada: dejarlos
inertes; la H/U 55 pide que naveguen.

**9. `Alertas de Gestión Pendiente` se convierte en `Requiere tu atención`.**

Solo alertas con conteo mayor a cero y con enlace: comprobantes pendientes y cobranzas observadas a
Cobranzas, comisiones sin vacantes a Cursos. En el docente: alumnos bloqueados y comisiones
finalizadas. En el alumno: acceso bloqueado y comprobante observado, ambos a Mis Pagos. Sin alertas,
mensaje informativo. Alternativa descartada: conservar el bloque con `—`; ya hay fuente real para las
tres pantallas.

**10. Composición por tablero.**

- **Admin:** cuatro tarjetas; a la izquierda `Panorama de cobros` (línea de seis meses + ocupación por
  comisión) y `Comprobantes recientes`; a la derecha `Tu agenda` y `Requiere tu atención`; debajo,
  `Accesos Rápidos del Personal` con dos acciones. La ocupación se muestra por comisión y no por curso
  —el prototipo dice “por curso”— porque el indicador de cupo promedio también es por comisión y dos
  promedios distintos en la misma pantalla se leen como un error.
- **Docente:** cuatro tarjetas; a la izquierda, `Comisiones asignadas` como tarjetas accionables —en
  lugar de la tabla—; a la derecha, `Tu agenda` y `Requiere tu atención`. No hay bloque de
  correcciones ni tabla de entregas: no existen.
- **Alumno:** cuatro tarjetas; a la izquierda, `Tu situación de pagos` y `Comprobantes recientes`; a
  la derecha, `Tu agenda` y `Requiere tu atención`. No se repiten las tarjetas de cursadas: viven en
  `Mis Cursos`, y el bloque del prototipo que mostraba progreso se reemplaza por pagos.

**11. Honestidad del dato.**

`null` en `cupo_promedio_ocupado` cuando no hay comisiones vigentes (la pantalla muestra `—`); listas
vacías cuando no hay filas; `0` real en cantidades y en los meses sin cobros. La UI no distingue
“falló” de “no hay” en un mismo mensaje: cada bloque muestra el error de lectura cuando la promesa
rechaza.

**12. La agenda es por fecha, no por hora.**

Se incluye el día corriente completo, aunque la clase de la mañana ya haya terminado. Es la misma
regla que ya usan el detalle del alumno y la próxima clase del docente; cambiarla a “desde ahora”
obligaría a comparar horas en zona horaria y a tocar tres pruebas existentes. Queda anotado como
límite conocido y no como comportamiento deseado a futuro.

**13. Ajustes de revisión posteriores al primer corte (2026-11-05).**

La primera implementación dejó los avisos dentro de cada tablero y una agenda de ocho encuentros.
La revisión los reemplaza sin cambiar el contrato del backend: los avisos se calculan una vez por
sesión en la campana del shell (D85), la agenda de presentación recorta a cinco (D87) y el admin
prioriza los accesos rápidos antes de la agenda. En Docente, el listado deja de ser una tabla: usa
un carrusel de tarjetas activas, ordenadas por próxima clase, con la tarjeta entera como enlace y
sin finalizadas. Las tarjetas alternan blanco y `#EBF7F2`, con borde `#E3F2E9` y hover `#E7F2ED`; la
barra de acceso reemplaza a la asistencia promedio que el modelo no registra (D86). El bloque
`Requiere tu atención` de la propuesta original queda reemplazado por la campana; su contenido y sus
enlaces no cambian.

## Risks / Trade-offs

- **[Pocos pagos reales]** La serie de seis meses puede verse casi plana o vacía → el bloque tiene
  estado de vacío explícito y `Cobrado este mes` conserva el valor real; no se rellena con datos de
  ejemplo.
- **[Sin fecha de inscripción]** El tablero no puede reportar inscripciones por mes → se documenta en
  la spec y en la UI; una historia futura puede agregar `inscripcion.created_at` con expand/contract.
- **[Comisiones heredadas sin fechas]** No generan agenda → la agenda cae a vacío y no inventa un
  período; el catálogo muestra esas comisiones igual.
- **[Chart.js en jsdom]** El canvas no dibuja en la prueba → el componente se prueba por su resumen
  textual accesible y por la configuración de datos, no por píxeles.
- **[Quitar sombras]** Las tarjetas quedan más planas y el contenido puede perder separación → se
  compensa con borde, fondo por rol y espaciado, como en el Figma; los flotantes conservan sombra.
- **[Agenda por fecha]** Una clase de hoy ya dictada sigue en la agenda hasta mañana → límite conocido;
  la regla es la vigente y no se cambia en este change.
- **[Costo del agregado]** El endpoint hace varias consultas → todas son acotadas (conteos, seis
  meses, tres comisiones, cinco comprobantes, ocho encuentros) y no hay N+1 por comisión.
- **[Dependencia nueva]** `chart.js` y `react-chartjs-2` suman peso al bundle → se registran solo los
  módulos usados y se verifica el build de producción.

## Migration Plan

No hay migración de base de datos ni cambio de contrato existente: `GET /admin/dashboard` es aditivo y
`/docentes/mis-comisiones` agrega un campo opcional. Orden de despliegue: backend primero —el frontend
nuevo necesita el agregado—, después frontend. Rollback: revertir el frontend y, si hace falta, el
backend; no se borra ni se transforma ningún dato.

## Open Questions

- Ninguna que cambie el alcance. La reportería de inscripciones por mes queda como historia futura si
  el cliente la pide; requeriría registrar la fecha de alta desde ese momento.
