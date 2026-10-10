# Proposal

## Why

La interfaz sigue genérica: laterales `*-900` a toda altura, contenido sobre `bg-slate-100`,
todo el color slate por defecto y ninguna identidad que distinga los tres roles de un vistazo.
El cambio previo `ui-appearance-improvement` era un experimento que no convenció y se descartó
como rollback: no se aplica, su rama queda como registro y este change arranca de cero desde
`feat/altas-catalogo-docentes`.

Figma rediseñó el shell completo y los tres tableros: fondo degradado por rol con retícula
sutil, lateral blanco translúcido con íconos, barra superior con breadcrumb, búsqueda, campana y
perfil, tarjetas de radio amplio con sombra suave, y un acento distinto por rol (dorado para
Alumno, verde para Docente, azul para Secretaría). Por convención del equipo (`AGENTS.md`),
Figma es autoridad de estructura y estilo, y hoy la distancia con ese diseño se ve en cada demo.

Los tres JSON exportados (`Dashboard · Alumno`, `Dashboard · Profesor`,
`Dashboard · Admin / Secretario`), las tres capturas de los tableros
(`Diseño-Alumno.png`, `Diseño-Profesor.png`, `Diseño-Secretaria.png`) y el PDF del prototipo
viven en **`docs/design/figma-dashboards-overhaul/`** y son la fuente de este change. Figma
aporta estructura y estilo, **cero datos**: los números que trae el prototipo (`1.248 alumnos`,
`68% de progreso`) contradicen el maquetado y no entran. Las capturas del set anterior
(`docs/design/screens/`, 18 páginas) siguen siendo el registro del maquetado previo y no se
tocan.

## What Changes

Alineación visual de los tres shells y de sus pantallas existentes, con la composición de
tablero que Figma define para los índices de cada rol. Cambio **no rompiente**: sin pantallas
nuevas, sin rutas nuevas, sin ítems de menú nuevos, sin funciones nuevas, sin cambios de
contrato, modelo, API ni reglas de negocio.

1. **Identidad.** Inter como sans (`@theme` en `index.css`, cargada desde `index.html`), y los
   tres acentos por rol sobre paleta stock de Tailwind: Alumno dorado (`yellow`), Docente verde
   (`emerald`), Secretaría azul (`blue`). Los acentos actuales —terracota, teal, índigo— quedan
   reemplazados, con delta en los tres specs de shell.
2. **Armazón de los tres shells** (`ShellFrame` + `navegacion.js` de cada rol). Fondo degradado
   por rol con retícula sutil; lateral blanco translúcido **sin rótulo de título** (`MENÚ
   OPERATIVO`, `ESPACIO DOCENTE`, `ESPACIO ALUMNO` salen), marca arriba, menú plano con un ícono
   lucide por ítem; barra superior con breadcrumb `Mi espacio > [pantalla activa]`, campo
   `Buscar en la plataforma` con `⌘ K` **inerte**, campana con punto **inerte**, y perfil con
   avatar, nombre de la cuenta, rol y menú desplegable de una sola entrada `Cerrar sesión`. Los
   chips de rol, el chip de sede y el texto `Período Lectivo 2026` **salen de la barra
   superior**: la sede desaparece del armazón (en las pantallas de dominio sigue siendo un dato
   de la comisión y no se toca). El pie queda con `TechAcademy BA · Aprendemos, crecemos,
   conectamos.`, `Período Lectivo 2026` y `Última actualización: 09:41` (literal placeholder);
   el bloque de persona del maquetado del pie (`CR` / `Camila Rodríguez` / `ALUMNO`, `Secretaria
   BA` / `Terminal Interna 04`) deja de renderizarse ahí.
3. **Composición de los tres índices como tablero** (sobre las pantallas que ya existen: no se
   agrega ninguna). Saludo `Buen día, {nombre de la cuenta}` con línea de fecha placeholder
   literal, fila de indicadores y dos columnas (principal + agenda). El contenido sale del
   maquetado: Secretaría conserva los cuatro indicadores y los bloques de alertas y accesos
   rápidos que ya fija su spec; Docente conserva sus cuatro indicadores y `Comisiones asignadas`;
   Alumno arma su fila de indicadores con su inscripción `CUR-102`, su acceso y su comprobante.
   Los bloques del Figma sin datos detrás —agenda de eventos de Alumno que no existe,
   `Correcciones pendientes`, `Novedades`, los gráficos de `La academia en números`— **no se
   construyen**: Figma aporta cero datos. Las fechas y la hora (`Viernes 9 de octubre`,
   `Última actualización: 09:41`) son literales placeholders, no se calculan.
4. **Páginas interiores de los tres shells**: pasan al mismo sistema —tarjetas de radio amplio,
   tablas aireadas, botones e íconos en el acento del rol— solo con clases. Textos, valores,
   columnas, estados, banners con causa, rutas y permisos intactos.
5. **Fuera de los shells**: `LoginPage`, landing y páginas de estado solo se recolorean a la
   paleta nueva. El overhaul del login está contemplado en otro spec y no entra acá.

### Fuera de alcance

- Pantallas, rutas o ítems de menú nuevos (el menú sigue siendo el que fija cada spec, en su
  orden, con sus ítems `Próximamente`; ninguna página ni ítem que el Figma inventa se agrega).
- Funciones nuevas: búsqueda, campana, chevron y gráficos se dibujan inertes o no se dibujan.
- Fechas u hora reales del navegador: los literales del maquetado son placeholders hasta que
  otro change los haga dinámicos.
- Backend, `src/services/`, `src/mocks/`, permisos, textos de negocio, TypeScript, i18n.
- La sede en las pantallas de dominio (el alta y la vista de comisiones la siguen mostrando
  cuando corresponde).

## Impact

**Specs afectadas (deltas de apariencia y composición, sin cambio de reglas):**
`admin-shell` (estructura de navegación + dashboard), `teacher-shell` (estructura de navegación
+ listado de comisiones) y `student-shell` (estructura de navegación + tablero del alumno).
`auth-and-roles` no se toca: el spec de acceso no fija apariencia. Ninguna capability nueva;
ningún spec de dominio (`domain-schema`, `altas-catalogo`) ni `dev-infrastructure` se toca.

**Código afectado:** `frontend/index.html` (fuente), `frontend/src/index.css` (tokens y
acento por rol), `frontend/src/components/ui/` (paleta, botón, tarjeta, tabla, insignias,
avatar), `frontend/src/components/shell/ShellFrame.jsx`, `frontend/src/*/navegacion.js` (solo
las constantes del armazón que dejan de existir), `frontend/src/admin/DashboardPage.jsx`,
`frontend/src/docente/TeacherCommissionsPage.jsx`, `frontend/src/alumno/StudentCoursesPage.jsx`
y clases en las demás páginas de `admin/`, `docente/` y `alumno/`. Backend sin impacto.

**Tests y riesgos:** los tests existentes deben seguir pasando; las aserciones que capturen
clases o rótulos que este change cambia (títulos de panel, chips, pie) se actualizan **solo en
esa aserción**, nunca en aserciones de comportamiento; `MARCA_UI` (`data-ui`) se conserva en los
ocho componentes. Riesgo principal: que "parecerse al Figma" se convierta en rediseño libre — se
mitiga con la regla Figma-manda y con que toda desviación queda escrita en `design.md` como
desviación, no como mejora silenciosa.

**Trazabilidad:** sin issue asociado (`ninguno, cambio menor` visual). `Refs` a
`docs/design/figma-dashboards-overhaul/` (tres JSON, tres capturas y el PDF del prototipo). Sin
`Closes`.
