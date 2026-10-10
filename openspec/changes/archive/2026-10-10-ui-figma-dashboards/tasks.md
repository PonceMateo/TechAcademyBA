# Tasks: ui-figma-dashboards

> Visual-only. JS, es-AR, sin i18n. Sin pantallas, rutas, ítems de menú ni funciones nuevas;
> sin cambios de modelo, API, permisos ni textos de negocio. **La fuente del diseño es
> `docs/design/figma-dashboards-overhaul/`** —`Dashboard · Alumno.json`,
> `Dashboard · Profesor.json`, `Dashboard · Admin _ Secretario.json`, las tres capturas
> `Diseño-*.png` y `Figma renovado - TechAcademy BA.pdf`— y es autoridad de estructura, estilo y
> textos de bloque, con cero datos: los números del prototipo no son datos del maquetado. Rama
> `feat/ui-figma-dashboards`, derivada de `feat/altas-catalogo-docentes`. Documentación OpenSpec
> completa antes de aplicar.

## 1. Setup

- [x] 1.1 Derivar la rama desde la rama actual (`git status` limpio, `git branch --show-current`
  anotado) y no desde `main`; la rama `feat/ui-appearance-improvement` queda intacta y sin usar.
- [x] 1.2 Correr la suite frontend en verde como línea base y anotar qué aserciones capturan
  rótulos del armazón (`MENÚ OPERATIVO`, chips, pie de persona) y clases concretas que el cambio
  va a tocar.
- [x] 1.3 Registrar la decisión en `docs/decisions.md` (fecha y autor) **antes** de aplicar,
  según `AGENTS.md`.
- [x] 1.4 Validar la documentación OpenSpec (`openspec validate ui-figma-dashboards`) antes de
  escribir la primera clase.

## 2. Identidad y sistema visual

- [x] 2.1 Cargar Inter en `frontend/index.html` con `<link>` (`preconnect` + `display=swap`);
  verificar `lang="es-AR"` y `<title>` intactos.
- [x] 2.2 Declarar la identidad en `frontend/src/index.css` con `@theme` (Tailwind v4):
  `--font-sans` Inter, fondo de contenido claro y los tres acentos por rol en paleta stock
  (`yellow` alumno / `emerald` docente / `blue` secretaría) mapeados a `--acento-*` bajo
  `data-acento`; utilidades de fondo degradado por rol y retícula al 3%; sin `tailwind.config.js`
  y sin hex suelto en las páginas.
- [x] 2.3 `paleta.js`: renombrar el tono del acento de Alumno (`terracota` → `dorado`) y
  actualizar `CLASES_BADGE`; no tocar los tonos de estado; conservar `MARCA_UI`.
- [x] 2.4 Acabado de `Button`, `Card`, `Input`, `Modal`, `Table`, `Badge`, `Avatar`,
  `StatusIndicator` (solo clases): radio amplio y sombra suave en tarjetas, píldora suave en
  insignias, tablas aireadas, foco anillado en el acento; conservar contratos y `data-ui`.

## 3. Armazón de los tres shells

- [x] 3.1 `ShellFrame.jsx`: fondo degradado con retícula; lateral blanco translúcido **sin**
  rótulo de título y con ícono por ítem; barra superior con breadcrumb `Mi espacio > [ítem
  activo]`, búsqueda `Buscar en la plataforma` `⌘ K` inerte, campana con punto inerte y bloque
  de perfil (avatar, nombre de la sesión, rol) con menú desplegable de una sola entrada
  `Cerrar sesión`; sin chips de rol, sin chip de sede y sin `Período Lectivo 2026` en la barra.
- [x] 3.2 Pie nuevo en los tres shells: tagline + `Período Lectivo 2026` +
  `Última actualización: 09:41`; quitar el bloque de persona/terminal del pie.
- [x] 3.3 Acentos: alumno dorado, docente verde, Secretaría azul en `ACENTOS`/`data-acento`;
  mantener la validación de acento desconocido.
- [x] 3.4 `navegacion.js` de `admin/`, `docente/` y `alumno/`: quitar `TITULO_MENU`
  (ver Desviaciones: se conserva solo como `aria-label`), `CHIP_ROL`, `CHIP_SEDE` y las constantes de pie que dejan de existir; agregar el ícono de cada
  ítem (los del Figma cuando el ítem existe en su menú, un equivalente lucide cuando no).
- [x] 3.5 Quitar del `ShellFrame` el uso de esas constantes y verificar que ninguna pantalla
  las importa más.

## 4. Composición de los tres tableros

- [x] 4.1 `admin/DashboardPage.jsx`: saludo `Buen día, {nombre de la sesión}` + línea de fecha
  placeholder; los cuatro indicadores literales intactos; dos columnas con
  `Alertas de Gestión Pendiente` a la izquierda y `Accesos Rápidos del Personal` a la derecha;
  sin gráficos.
- [x] 4.2 `docente/TeacherCommissionsPage.jsx`: saludo + línea de fecha placeholder; los cuatro
  indicadores literales y `Comisiones asignadas` intactos en la columna izquierda; `Tu agenda`
  a la derecha con el horario y la próxima clase de la comisión; sin bloque de correcciones ni
  novedades.
- [x] 4.3 `alumno/StudentCoursesPage.jsx`: saludo + línea de fecha placeholder; fila de
  indicadores (`CURSOS EN MARCHA` `1`, `ACCESO A LA CLASE` con el estado de la inscripción,
  `COMPROBANTES ACREDITADOS` `1`, `PRÓXIMA CLASE` `Lun y Miér · 18:30 a 21:30`); inscripciones
  a la izquierda; `Tu agenda` con los próximos encuentros a la derecha; sin tareas, sin
  calificaciones, sin porcentajes calculados; conservar el mensaje de alumno sin cursos.
- [x] 4.4 Fechas y hora: los literales `Viernes 9 de octubre` y `Última actualización: 09:41`
  como placeholders; nada calculado con `Date`.

## 5. Páginas interiores y fuera de los shells

- [x] 5.1 Pasada de clases por `admin/`, `docente/` y `alumno/`: títulos, tarjetas, tablas y
  acciones en el sistema nuevo y en el acento del rol; textos, valores, columnas, estados,
  banners con causa, rutas y permisos intactos.
- [x] 5.2 `LoginPage.jsx`, `LandingPage.jsx`, `LoadingPage`, `ForbiddenPage`, `NotFoundPage`:
  solo recoloreo a la paleta nueva; sin cambios de composición ni de textos.
- [x] 5.3 Barrido de foco y contraste: todo interactivo con `focus-visible` en el acento del
  rol; texto cuerpo ≥ 4.5:1 sobre su superficie; verificar especialmente el acento dorado sobre
  blanco (usar la variante oscura `yellow-700` para texto).

## 6. Tests

- [x] 6.1 Suite frontend completa en verde; si una aserción cae, tocar **solo** aserciones de
  clases o de rótulos del armazón que este change cambia, nunca aserciones de comportamiento;
  `data-ui` intacto en los ocho componentes.
- [x] 6.2 Navegación por teclado en los tres shells: anillo de foco visible en enlaces del
  lateral, botones, campos y el menú de perfil; `Cerrar sesión` sigue siendo alcanzable.
- [x] 6.3 Comparación visual de los tres índices y de una página interior por rol contra
  `docs/design/figma-dashboards-overhaul/`: las capturas `Diseño-*.png` a la vista y los JSON
  como estructura de referencia, misma tipografía, degradado, lateral, barra superior y pie;
  desviaciones anotadas en `design.md`, no silenciadas. **Hecho con el stack arriba**: los tres
  índices se abrieron con las cuentas de demostración y se verificaron en pantalla el lateral con
  íconos, la barra superior con breadcrumb y perfil, los cuatro indicadores, el pie de tres textos,
  el acento de cada rol (`data-acento` con su color computado), la tipografía Inter y el fondo
  degradado. **Queda para el ojo humano** el cotejo lado a lado contra `Diseño-*.png`: las capturas
  no son legibles por el agente. Sin desviaciones nuevas: el diseño está aplicado.

## 7. Docs

- [x] 7.1 Anotar desviaciones abiertas en el change (íconos de ítems que el Figma no trae,
  adaptación de los textos de saludo) y su resolución o aplazamiento.
- [x] 7.2 Confirmar trazabilidad: sin issue (`ninguno, cambio menor`), `Refs` a
  `docs/design/figma-dashboards-overhaul/`, sin `Closes`; commits convencionales sin
  `Co-Authored-By` ni firmas de IA.
