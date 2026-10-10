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
