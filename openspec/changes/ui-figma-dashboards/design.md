# Design

## Context

Ver `proposal.md` para el porqué. Lo que condiciona el approach:

- **El armazón es un solo componente.** `ShellFrame.jsx` dibuja los tres shells con datos
  (secciones del menú, acento, pie) y `shellConsistency.test.jsx` (9.8) afirma que las tres
  secciones dibujan con los mismos componentes. Todo lo visual nuevo entra por ahí y por
  `index.css`; no hay tres copias que tocar.
- **Los specs fijan textos del armazón** que este change mueve o elimina: títulos de panel
  (`MENÚ OPERATIVO`, `ESPACIO DOCENTE`, `ESPACIO ALUMNO`), chips de rol y de sede en la barra
  superior, `Período Lectivo 2026` en la barra, y el bloque de persona del pie. Por eso el
  trabajo es primero OpenSpec y después código: los deltas mandan.
- **Los specs de shell también fijan el acento** (`terracota` para Alumno, `verde azulado` para
  Docente, y el chip de `Sede Constituciones` de Secretaría). La paleta nueva entra como delta,
  no como cambio silencioso.
- **Las fuentes del diseño están versionadas en el repo.** Todo lo que este change dibuja sale
  de `docs/design/figma-dashboards-overhaul/`: `Dashboard · Alumno.json`,
  `Dashboard · Profesor.json` y `Dashboard · Admin _ Secretario.json` (estructura y geometría
  exportadas), `Diseño-Alumno.png`, `Diseño-Profesor.png` y `Diseño-Secretaria.png` (la
  referencia visual por rol, para la comparación pantalla por pantalla) y
  `Figma renovado - TechAcademy BA.pdf` (el prototipo completo, con los textos de cada bloque).
  El set previo `docs/design/screens/` (18 capturas) queda como registro histórico y no es
  fuente de este change.
- **El Figma no aporta datos** (regla de `AGENTS.md`). Los tres JSON y el PDF fijan composición,
  geometría y color; los números del prototipo (`1.248 alumnos`, `68% de progreso`, `2 clases
  para hoy`) contradicen el maquetado y quedan fuera.
- **El change anterior `ui-appearance-improvement` se descartó** (rollback del equipo): su rama
  no se usa ni se borra, y este change no depende de él.

## Goals / Non-Goals

**Goals:**

- Los tres shells se ven como el Figma: fondo degradado por rol con retícula, lateral blanco
  translúcido con íconos, barra superior con breadcrumb/búsqueda/campana/perfil, pie de tres
  textos, tarjetas de radio amplio con sombra suave.
- Un acento por rol, en paleta stock de Tailwind, declarado una sola vez en `index.css` y
  consumido como variable (mismo patrón `data-acento` que ya usa el código: sin variantes por
  rol en los componentes, sin hex suelto en las páginas).
- Los tres índices quedan compuestos como tablero (saludo, indicadores, dos columnas) con datos
  del maquetado.
- La suite frontend queda verde actualizando solo aserciones de clases y de rótulos del
  armazón; `data-ui` intacto.

**Non-Goals:**

- Pantallas, rutas, ítems de menú o funciones nuevas. Búsqueda, campana, chevron del lateral y
  gráficos: inertes o ausentes.
- Overhaul de `LoginPage` (otro spec, confirmado por el equipo), fechas dinámicas, i18n,
  TypeScript, backend.
- Quitar la sede de las pantallas de dominio: solo sale del armazón.

## Decisions

**1. Los índices existentes son el tablero: no se crea ninguna pantalla.**

`/admin`, `/docente` y `/alumno` son las tres pantallas de tablero y quedan con la composición
del Figma encima de su contenido actual. Alternativa descartada: crear un dashboard nuevo por
rol y mover las páginas actuales a rutas propias — agrega rutas e ítems de menú, que el equipo
quiso fuera de alcance, y el Figma ya dibuja el tablero sobre la página que existe.

**2. El menú es la lista de cada spec, sin rótulos de sección y con ícono.**

Se elimina el `<h1>` del panel y el rótulo visible de sección. **`TITULO_MENU` se conserva** en
cada `navegacion.js` —contra lo que decía la task 3.4— porque es el nombre accesible del `<nav>`:
sin él, el panel de navegación se anuncia como "navegación" a secas. Deja de dibujarse como texto
y queda solo como `aria-label`; ver *Desviaciones del tasks*. La línea original decía:
las categorías `ESPACIO DE TRABAJO` / `COMUNIDAD` del Figma son invenciones suyas y no aportan
nada. Cada ítem lleva un ícono lucide: el que el Figma asigna cuando el ítem existe en su menú
(`Mis Cursos` → `book-open`, `Mis Pagos` → `wallet`, `Certificados` → `award`, `Cobranzas` →
`wallet`, `Accesos` → `shield-check`, `Asistencia` → `user-check`, etc.) y un equivalente lucide
cuando no (`Docentes`, `Mi Perfil`, `Dashboard`). Elegir el ícono de un ítem que el Figma no
trae es la única concesión y queda anotada acá.

**3. Los elementos sin función se dibujan inertes, no se omiten.**

Búsqueda `⌘ K`, campana con punto y chevron son composición del Figma y ya tienen precedente
inerte en el tablero de Secretaría (los botones de `Accesos Rápidos`). Inerte = se ve y no hace
nada, con `disabled`/`aria-hidden` donde corresponda; jamás una promesa rota. Lo que sí es real:
el menú de perfil con `Cerrar sesión`, único ítem del desplegable porque las demás opciones del
Figma implican pantallas nuevas.

**4. La barra superior sigue al Figma al pie de la letra, y la información que expulsó baja al
pie.**

Salen los chips de rol, el chip de sede y `Período Lectivo 2026` de la barra; entra breadcrumb
`Mi espacio > [etiqueta del ítem activo]`. El período se conserva porque es requisito de los
tres specs y se muda al pie junto al tagline y a `Última actualización: 09:41`. La sede sale
del armazón entero (decisión del equipo: el chip era contexto decorativo) y **no** se toca en
las pantallas de dominio, donde es dato de la comisión. El nombre y el rol de la cuenta pasan
al bloque de perfil de la barra, que es donde el Figma los pone.

**5. La paleta nueva se declara como tres acentos en `@theme`, en stock de Tailwind.**

| Rol | Acento Figma | Tailwind (aproximación stock) |
| --- | --- | --- |
| Alumno | `#d0a52c` dorado | `yellow-600` / `yellow-700` |
| Docente | `#26836b` verde | `emerald-600` / `emerald-700` |
| Secretaría | `#3975d5` azul | `blue-600` / `blue-700` |

Ningún hex suelto en las páginas: los componentes consumen `--acento-*` vía `data-acento`, el
mismo mecanismo que ya existe en `index.css`. Los tonos de `TONO` que nombran el acento de un
shell se renombran al nuevo vocabulario (el de Alumno pasa de `terracota` a `dorado`), con delta
en `student-shell`; los tonos de estado (verde/rojo/ámbar/gris/violeta/magenta/celeste) no se
tocan. El fondo degradado por rol y la retícula al 3% de opacidad viven como utilidades en
`index.css`, no en cada página.

**6. La fila de indicadores se arma con datos del maquetado, y lo que no tiene dato no se
construye.**

- **Secretaría** (`DashboardPage.jsx`): saludo + línea de fecha placeholder; los cuatro
  indicadores literales que ya fija su spec (`8`, `10`, `3`, `27%`, sin calcular); a la izquierda
  `Alertas de Gestión Pendiente`, a la derecha `Accesos Rápidos del Personal`. Los gráficos de
  `La academia en números` del PDF no existen porque los números del prototipo no son los del
  maquetado.
- **Docente** (`TeacherCommissionsPage.jsx`): saludo + sus cuatro indicadores literales
  (`COMISIONES ACTIVAS` 1, `ALUMNOS HABILITADOS` 1, `BLOQUEADOS` 1, `PRÓXIMA CLASE`
  `Hoy · 19:00`) + `Comisiones asignadas` con su única fila. A la derecha, `Tu agenda` con la
  próxima clase tomada del mismo dato del spec. `Correcciones pendientes`, `Novedades` y
  `Mensajes` no se construyen: no hay entregas ni mensajes en el maquetado.
- **Alumno** (`StudentCoursesPage.jsx`): saludo + indicadores: `CURSOS EN MARCHA` `1` con
  apoyo `CUR-102 · Desarrollo Web Full Stack`, `ACCESO A LA CLASE` con el estado de la
  inscripción (mostrar el campo existente, no un cálculo, y el mismo estado que ya ve en la
  tarjeta), `COMPROBANTES ACREDITADOS` `1` con apoyo `$31.000 · Transferencia` y `PRÓXIMA
  CLASE` con el horario literal `Lun y Miér · 18:30 a 21:30`. A la izquierda, la tarjeta `Mis
  Cursos` con las inscripciones que ya carga; a la derecha, `Tu agenda` con los próximos
  encuentros que ya trae el detalle del curso. `Mis tareas`, `Mis calificaciones`, `Novedades`
  y el `68%` de progreso no se construyen: no existen en el modelo.

Los indicadores son texto fijo o el reflejo de un campo existente; **ninguno se calcula en
tiempo de ejecución** (misma regla que el `27%` de Secretaría). La fecha `Viernes 9 de octubre`
y `Última actualización: 09:41` son literales placeholders; el saludo sí usa el nombre real de
la cuenta, que la barra superior ya muestra.

**7. Las páginas interiores solo cambian de clases.**

Mismo sistema de componentes (`Card` redondeado con sombra suave, `Table` aireada, `Badge`
píldora, foco anillado en el acento). Sin cambios de textos, valores, columnas, orden, estados,
banners con causa, rutas ni permisos. `LoginPage`, landing y estados solo recolorean.

## Estructura del change y fuentes

```
docs/design/figma-dashboards-overhaul/   <- fuente de estructura, estilo y textos de bloque
├── Dashboard · Alumno.json
├── Dashboard · Profesor.json
├── Dashboard · Admin _ Secretario.json
├── Diseño-Alumno.png
├── Diseño-Profesor.png
├── Diseño-Secretaria.png
└── Figma renovado - TechAcademy BA.pdf
```

## Estructura del cambio

```
openspec/changes/ui-figma-dashboards/
├── .openspec.yaml
├── proposal.md
├── design.md
├── tasks.md
└── specs/
    ├── admin-shell/spec.md      (MODIFIED: estructura de navegación + dashboard)
    ├── teacher-shell/spec.md    (MODIFIED: estructura de navegación + listado de comisiones)
    └── student-shell/spec.md    (MODIFIED: estructura de navegación; ADDED: tablero del alumno)
```

## Desviaciones del tasks

Anotadas acá y no silenciadas (tasks 6.1 y 7.1):

- **`TITULO_MENU` no se elimina** (task 3.4). Se conserva como nombre accesible del `<nav>` de los
tres shells y deja de dibujarse; las pruebas de armazón afirman las dos cosas: que el nombre
existe y que no hay texto visible.
- **El `Button` compartido dejó de estar en toda pantalla.** Antes el pie mostraba el botón de
  cerrar sesión en todas las pantallas; ahora vive en el menú de perfil. La entrada del menú usa el
  mismo componente `Button` (con `role="menuitem"`), y la prueba de consistencia se parte en dos:
  tarjetas compartidas por pantalla y cierre de sesión compartido por armazón (6.1).
- **Los `select` nativos del maquetado** no pasan por `Input` —el navegador dibuja su flecha—, así
  que toman la forma del campo desde una regla de elemento en `@layer components` de `index.css`,
  con las utilidades de cada pantalla ganando por encima. Se agrega además la utilidad
  `.texto-acento` para los textos que van en el acento del rol: reemplaza a `text-teal-800` y
  `text-blue-700` sueltos en las páginas (5.1 y 5.3).
- **La barra superior se ubica en las pruebas por `[data-ui="shell-frame"] > header`** y no por el
  rol `banner`: la cabecera de cada tablero —el saludo— también es un `<header>` y jsdom la anuncia
  igual. Es una limitación del entorno de prueba, no del armazón.
- **Los perfiles de alumno y docente conservan sus literales de identidad** (`CR`/`Camila
  Rodríguez`, `PM`/`Profe Martín`) como constantes locales de la pantalla: el armazón ya no exporta
  las suyas porque la identidad que muestra es la cuenta de la sesión (5.1).
- **La comparación visual (6.3) queda pendiente**: mirar los tres índices contra
  `Diseño-*.png` exige el stack corriendo (Compose + backend), que no está disponible en esta
  máquina. Está verificado por estructura y por pruebas, no por ojo.

## Riesgos

- **Los tests de shell capturan rótulos que desaparecen** (`MENÚ OPERATIVO`, chips, pie de
  persona). Se actualizan solo esas aserciones y se deja constancia en cada archivo tocado.
- **Contraste**: amarillo sobre blanco es el par más flojo de la paleta nueva; los textos sobre
  acento usan la variante oscura (`yellow-700`/`emerald-700`/`blue-700`) y el barrido de foco y
  contraste del tasks es obligatorio, no opcional.
- **La barra superior nueva empuja contenido en pantallas angostas**: el comportamiento
  responsive actual (el lateral pasa a tope de ancho bajo `lg`) se conserva; el breadcrumb y la
  búsqueda se ocultan antes que romper el layout.
