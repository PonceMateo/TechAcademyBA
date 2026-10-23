# AGENTS.md

Flujo de trabajo del equipo de TechAcademy BA. Leerlo antes de tocar nada.

OpenSpec administra `openspec/` y `.opencode/`. Si aparecen bloques
`<!-- OPENSPEC:START -->` / `<!-- OPENSPEC:END -->`, OpenSpec reescribe solo lo
que está entre ellos.

## Idioma

- El agente le habla al usuario en español. Los commits van en español.
- La UI es es-AR y no hay i18n: los strings no se extraen.
- Los nombres en el código no tienen idioma fijo: seguí la convención de la capa
  que tocás (frontend mayormente en español, backend mayormente en inglés), sin
  mezclar idiomas dentro de un módulo ni renombrar solo por idioma.
- Sin tildes en identificadores, nombres de archivos y ramas, salvo en el texto
  que se le muestra al usuario.
- `docs/glossary.md` traduce la terminología del cliente: consultalo antes de
  nombrar un concepto del dominio.

## Comandos y estructura

Todo corre en contenedores con `docker compose`, no con Python ni Node locales.
Comandos de build, test, lint y migraciones: sección "Comandos" del `README.md`.
Mapa de carpetas: sección "Estructura".

## Fuentes de verdad

1. **GitHub Projects** (`TechAcademyBA`, project #1, owner `PonceMateo`): única
   fuente viva del backlog (texto, prioridad, épica, estimación y estado:
   `Backlog`, `Ready`, `In progress`, `In review`, `Done`).

   ```
   gh project item-list 1 --owner PonceMateo --limit 100 --format json --jq '.items[] | [.content.number, .content.title, .status, .priority] | @tsv'
   gh issue view <número> --json title,body,state
   ```

   Siempre con `--limit 100` (sin eso recorta a 30 y parece que faltan
   historias) y filtrá con `--jq`. Cada historia es un issue `H/U <n> · <título>`;
   el número del issue no es el de la historia. Priority es MoSCoW (`Must`, `Should`, `Could`, `Won't`). 
   Una historia está terminada cuando `Status` es `Done`, no cuando el issue está cerrado.
2. **Contextualización del problema** (`docs/requirements/`): modelo de negocio.
3. **Maqueta PPTX:** alcance negociado y los dos caminos de MVP.
4. **Figma:** pantallas y estilo. Aporta cero datos.
5. **Excel del cliente:** es el problema, no la solución. Muestra qué datos hay
   que sostener y qué ambigüedades resolver.
6. **Histórico, no fuente:** el CSV de historias en `docs/requirements/`. Está
   congelado: no se lee para implementar ni se actualiza.

Si el board no es accesible, pedile acceso al usuario. Si prefiere seguir igual,
seguí con lo que haya en el repo y decilo.

## Historia nueva

Se agrega al board, nunca al CSV: issue `H/U <n> · <título>` con descripción y
criterios de aceptación, label `Épica: <nombre>`, y en el project Priority,
Épica, Estimación y `Status=Backlog`. Verificá que esté en el board antes de
implementarla.

## Cambio directo o propuesta

- **Cambio directo, sin propuesta**, si el comportamiento observable no cambia:
  bugfix que restaura lo especificado, typos, estilos, refactor interno, tests de
  código existente, configuración y dependencias.
- **Propuesta en OpenSpec** (`/opsx-propose`) si cambia el contrato: historia
  nueva o modificada, regla de negocio, modelo de datos, contrato de API,
  seguridad o permisos.
- **Ante la duda, consultá en una línea** a una persona del equipo, con la duda y
  lo que asumiste.

## Arranque de una planificación

Al iniciar una planificación (`/opsx-propose` o una historia), preguntale al
usuario **una sola vez, con opciones Sí / No**, si quiere hacer una sesión de
preguntas exhaustiva para calibrar el alcance (es opcional; explicalo sin jerga).

- **Sí:** cargá `grill-me`. No escribas ni abras la rama hasta que el usuario
  confirme que el entendimiento es compartido.
- **No:** seguí con la planificación.

## Ramas y commits

**Ramas:** `<tipo>/<slug>/<Nombre>-<Apellido>`, siempre desde `main` y siempre
terminadas con el nombre y apellido de quien la crea. El slug puede ir en español
o en inglés.

- `feat/hu-<n>-<slug>/<Nombre>-<Apellido>` (ej: `feat/hu-27-estado-habilitacion/Mateo-Ponce`)
- `fix/<slug>/<Nombre>-<Apellido>`: corrección sin historia.
- `chore/<slug>/<Nombre>-<Apellido>`: higiene, tooling, docs, configuración.

| `user.name`     | Autor de la rama    |
|-----------------|---------------------|
| `PonceMateo`    | `Mateo-Ponce`       |
| `santitorrens1` | `Santiago-Torrens`  |
| `agutor`        | `Agustin-Torres`    |

Mirá `git config user.name` antes de crear la rama. Si no está en la tabla, no
adivines: preguntá con una opción por integrante.

**Commits:** `<tipo>(<ámbito>): <descripción en imperativo y en minúscula>`, con
tipo entre `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`,
`ci`. Un work unit, un commit. Sin `Co-Authored-By` ni firmas de IA.

```
feat(auth): agregar endpoint de login con correo y contraseña
```

**Trazabilidad:** `Refs #N` referencia la historia (es lo que usa el PR).
`Closes #N` solo si cumple todos sus criterios y queda `Done`: cerrar issues a
medias hace que el backlog mienta. El PR pide el issue o `ninguno, cambio menor`.

## Migraciones

Si la rama toca `backend/alembic/`, avisale al usuario antes de pushear a
`main`: el deploy de Vercel no corre `alembic upgrade head`, así que la
migración de Supabase en producción se aplica a mano.

## Decisiones

Toda decisión técnica no funcional y la causa raíz de un error se registran en
`docs/decisions.md` con fecha y autor **antes** de aplicarlas. Las decisiones de
alcance, contrato o modelo van también en el change de OpenSpec.

## Skills

Cargá las que correspondan según la tarea, antes de escribir código. Si la tarea
no entra en ninguna de estas áreas, no cargues skills.

| Si la tarea toca... | Cargá |
|---|---|
| Rutas, schemas o dependencias de `backend/app/` | `fastapi`, `pydantic` |
| Operaciones async en la API | `fastapi-python` |
| Un proyecto FastAPI nuevo | `fastapi-templates` |
| Modelos, queries o `backend/alembic/` | `sqlalchemy`, `sqlalchemy-alembic-expert-best-practices-code-review`, `supabase-postgres-best-practices` |
| Consultas lentas o índices | `sql-optimization-patterns` |
| Tests del backend | `python-testing-patterns` |
| Componentes, hooks o data fetching de `frontend/src/` | `vercel-react-best-practices`, `ui-styling` |
| Una pantalla nueva o desde una imagen | `ui-ux-pro-max`, `image-to-code` |
| Tests del frontend | `vitest` |
| Accesibilidad | `accessibility` |
| Un change de OpenSpec | La skill `openspec-*` del paso |

El proyecto vive en Supabase + Vercel. Si el MCP de Supabase está conectado,
usá `supabase` en tareas que lo toquen. Hoy `opencode.json` no lo declara: si no
aparece conectado, no inventes el estado de la base.

## Herramientas

Los MCP se declaran en `opencode.json`. Si uno falla, casi siempre es el binario
que lo lanza (Node, `npx`), no la config.

Cada vez que acá diga "preguntá", usá la herramienta de preguntas de opencode
(`question`, opción múltiple), no texto libre.

- **gh.** Si necesitás el board y `gh` no está instalado o no tiene sesión,
  preguntá con «Sí (abre una pestaña nueva)» / «No». Instalar:
  `winget install --id GitHub.cli -e` (Windows), `brew install gh` (macOS/Linux) o, si en linux no funciona, consultá la guía oficial de instalación (https://github.com/cli/cli/blob/trunk/docs/install_linux.md). 
  Login una vez por máquina: `gh auth login --web -s project` (o
  `gh auth refresh -s project`). Nunca pidas el token por chat.
- **CodeGraph.** Indexa el repo en `.codegraph/` (local). Si el índice no existe
  o CodeGraph devuelve vacío, preguntá una vez con «Sí (recomendado)» / «No» si
  correr `npx -y @colbymchenry/codegraph init`. Si no hay Node, avisá y seguí con
  Read, Grep y Glob.
- **Context7.** Documentación de librerías; la lógica del proyecto se lee en el repo.
- **Engram.** Memoria entre sesiones; se configura por máquina con `engram setup opencode`.

## Convenciones técnicas

No se negocian por historia; el detalle está en `docs/decisions.md`.

- Sin TypeScript: el frontend es JavaScript.
- Tests del backend con pytest (no `unittest`), contra PostgreSQL real, nunca
  SQLite: el modelo usa `num_nonnulls`, índices únicos sobre columnas
  normalizadas y CHECKs que SQLite no tiene.
- Los componentes no llaman al backend: todo pasa por `src/services/`, única
  frontera de datos, salvo login y cambio de contraseña (`src/auth/authClient.js`).
  Los componentes no importan `src/mocks/`, que es solo infraestructura de test:
  no agregues datos inventados a las pantallas.