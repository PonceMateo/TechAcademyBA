# Figma renovado: shell y tableros por rol

Este directorio es la **fuente de estructura, estilo y textos de bloque** del change
[`ui-figma-dashboards`](../../../openspec/changes/ui-figma-dashboards/proposal.md). Figma es la
autoridad de estilo del proyecto (`AGENTS.md`), y por eso el material vive versionado acá y no en
el escritorio de nadie.

**Figma aporta cero datos.** Los números del prototipo (`1.248 alumnos activos`,
`68 % de progreso`, `32 comisiones en curso`, `$ 8,4 M cobrados`) no coinciden con el maquetado y
no se implementan: los valores de los tableros salen de la fuente de verdad del proyecto (el CSV
de historias, los specs de shell y `frontend/src/mocks/`).

## Contenido

| Archivo | Qué es | Para qué se usa |
| --- | --- | --- |
| `Dashboard · Alumno.json` | Export estructural del tablero de Alumno | Geometría, jerarquía, color y textos de bloque del shell de Alumno |
| `Dashboard · Profesor.json` | Export estructural del tablero de Docente | Ídem para el shell de Docente |
| `Dashboard · Admin _ Secretario.json` | Export estructural del tablero de Secretaría | Ídem para el shell de Administración y Secretaría |
| `Diseño-Alumno.png` | Captura del tablero de Alumno | Referencia visual para la comparación pantalla por pantalla |
| `Diseño-Profesor.png` | Captura del tablero de Docente | Ídem |
| `Diseño-Secretaria.png` | Captura del tablero de Secretaría | Ídem |
| `Figma renovado - TechAcademy BA.pdf` | Prototipo completo (todos los bloques y sus textos) | Contraste de textos de bloque y detalle que el JSON resume |

Los tres JSON son exports del plugin *Figma Raw*: describen capas, medidas y estilos, y traen un
arreglo `textContent` con los textos literales. No describen datos de negocio.

## Relación con el material anterior

- `docs/design/screens/` (18 capturas) y `docs/design/Prototipo TechAcademy BA (FIGMA).pdf` son el
  **set previo**, registrado cuando se trabajó la primera alineación de apariencia. Quedan como
  registro histórico y **no** son fuente de este change.
- Este directorio reemplaza ese set para lo que respecta al shell y a los tres tableros.

## Alcance en una línea

Los tres tableros son las pantallas índice que ya existen (`/admin`, `/docente`, `/alumno`),
recompuestas con la composición del diseño; no agrega pantallas, rutas, ítems de menú ni
funciones. El detalle de las decisiones está en
[`design.md`](../../../openspec/changes/ui-figma-dashboards/design.md) y las tareas de aplicación
en [`tasks.md`](../../../openspec/changes/ui-figma-dashboards/tasks.md).

## Actualización 2026-11-04 — rediseño con datos reales

El change [`rediseno-dashboards-figma`](../../../openspec/changes/rediseno-dashboards-figma/proposal.md)
volvió a leer la página vigente del Figma y reemplazó los bloques que no tenían fuente por los datos
reales de las H/U 55, 56 y 57.

- **Archivo:** `Prototipo TechAcademy BA` (`QVNyPLVubV4A1szyQadoUe`).
- **Página:** `Techacademy - UI Overhaul` (`53:2`).
- **Tableros:** Admin / Secretario `53:716`, Profesor `53:355`, Alumno `53:3`.
- **Superficies:** tarjetas `#f0f5fc` (Secretaría), `#eff7f3` (Docente) y `#fcf8e9` (Alumno);
  fondos de shell `#eaf1fb`, `#eaf4ee` y `#f8f4e6`.
- **Sombra del Figma:** `0 4px 18px rgba(54, 84, 107, 0.03)`, prácticamente plana. El contenido va
  sin sombra; modal, menú, selector y tooltip la conservan.

Las capturas y los JSON de este directorio siguen siendo referencia visual. El Figma es la
autoridad de estilo y la fuente de la composición; los valores de negocio salen de la base.

## Ajustes 2026-11-05 — campana y tarjetas docentes

La revisión del rediseño agregó estos ajustes, registrados en `docs/decisions.md` (D85–D87):

- La campana del armazón abre los avisos de la sesión; el bloque `Requiere tu atención` ya no se
  renderiza en los tableros. El punto solo aparece cuando hay avisos.
- En Docente, `Tus comisiones, a un vistazo` usa tarjetas de dos por fila, con fondo blanco y
  `#EBF7F2`, borde `#E3F2E9` y hover `#E7F2ED`. La tarjeta entera abre la comisión y el carrusel no
  muestra scrollbar.
- Las comisiones finalizadas no se listan; las activas se ordenan por su próxima clase.
- La agenda muestra hasta cinco encuentros y los accesos rápidos de Administración van arriba de
  ella.
