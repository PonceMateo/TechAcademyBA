# AGENTS.md

Flujo de trabajo del equipo de TechAcademy BA. Leerlo antes de abrir el primer
branch.

> **Sobre el bloque gestionado por OpenSpec.** OpenSpec administra `openspec/` y
> `.opencode/`. **No administra la raíz de `AGENTS.md`**: si alguna vez aparece
> un bloque delimitado por `<!-- OPENSPEC:START -->` y `<!-- OPENSPEC:END -->`
> en este archivo, OpenSpec reescribe únicamente lo que está entre esos
> marcadores. El contenido del equipo vive **fuera** de ese bloque y no se
> edita cuando OpenSpec actualiza el suyo. Hoy no hay bloque gestionado: todo
> lo de este archivo es del equipo.

## Fuentes de verdad

Por orden de autoridad, y en este orden:

1. **CSV de historias de usuario** (`docs/requirements/`). Es la fuente de verdad
  de restricciones y del modelo. 18 Must = 44 PHU, 12 Should = 43 PHU, más 8
  Could y 9 Won't. Las historias #45 a #47 están solo en el CSV: todavía no
  tienen issue en GitHub.
2. **Contextualización del problema** (`docs/requirements/`). Define el modelo
  de negocio.
3. **Maqueta PPTX.** Alcance negociado y los dos caminos de MVP.
4. **Figma.** Estructura de pantallas y estilo. Aporta cero datos.
5. **Excel del cliente.** Es **el problema, no la solución**. Sirve para ver qué
  datos hay que sostener y qué ambigüedades hay que resolver, nunca como
  fuente de verdad del modelo. Un objetivo del proyecto es deshacerse de él.

`docs/glossary.md` traduce la terminología del cliente. `docs/decisions.md`
registra las decisiones técnicas con fecha y autor.

## Cambio directo o propuesta

### Cambio directo, sin propuesta

Se hace en la rama, sin abrir propuesta en OpenSpec, cuando **el comportamiento
observable no cambia**:

- Un bugfix que restaura el comportamiento que ya estaba especificado.
- Typos y estilos.
- Refactor interno sin cambio de comportamiento.
- Tests de código que ya existe.
- Configuración y dependencias.

### Propuesta en OpenSpec

Se abre una propuesta (comando `/opsx-propose`) cuando **algo del contrato
cambia**:

- Una historia de usuario nueva o modificada.
- Una regla de negocio.
- Un cambio en el modelo de datos.
- Un cambio en un contrato de API.
- Un cambio de seguridad o de permisos.

### Ante la duda

**Consultá en una línea.** Escribile a una persona del equipo una línea con la
duda y qué asumiste para seguir. No arranques una propuesta completa para
resolver una duda de cinco minutos: la propuesta es cara de revisar y de
mantener, y una línea se responde en un rato.

Si la respuesta te cambia el modelo o una regla de negocio, recién ahí es una
propuesta.

## Ramas

- `feat/hu-<n>-<slug>` — historia de usuario `<n>`. Ejemplo: `feat/hu-27-estado-habilitacion`.
- `fix/<slug>` — corrección sin historia asociada.
- `chore/<slug>` — higiene, tooling, documentación, configuración.

Rama base: `main`. Un work unit, un commit.

## Commits

Formato convencional:

```
<tipo>(<ámbito>): <descripción en imperativo y en minúscula>
```

Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`.

Ejemplos reales de este repo:

```
chore(repo): add project hygiene, team conventions and glossary
feat(auth): add email and password login endpoint
```

El `Co-Authored-By` y cualquier firma de IA **no** van en los commits.

## Trazabilidad con el backlog

- `Refs #N` referencia la historia. **Es lo que usa el pull request.**
- `Closes #N` cierra el issue. **Solo si la historia cumple todos sus criterios
  de aceptación.**

Este proyecto maqueta: si cerráramos issues a medias, el backlog mentiría sobre
el estado real del producto. La plantilla del pull request pide el issue o
change relacionado, o `ninguno, cambio menor`.

## Decisiones

Toda decisión técnica no funcional se registra en `docs/decisions.md` con
**fecha y autor**. También cuando se corrige la causa raíz de un error. La
decisión no se aplica primero y se registra después: se registra, y después se
aplica.

Cuando la decisión es una decisión de OpenSpec (alcance, contrato, modelo), va
también en el change. `docs/decisions.md` es el índice de por qué, no el lugar
donde se discuten las alternativas.

## Herramientas

Los servidores MCP están declarados en `opencode.json`, así que llegan con el `pull`. Si uno
aparece caído, la causa casi siempre es que el binario no está en el `PATH` de esa máquina, no
la configuración.

- **CodeGraph** indexa el repo en `.codegraph/`, que es local y no está versionado. Sin índice
  devuelve vacío en lugar de error: usá Read, Grep y Glob hasta que exista. Indexar es
  decisión del equipo, no del agente: si falta, avisá y seguí.
- **Context7** es para documentación de librerías. La lógica del proyecto se lee en el repo.
- **Engram** conserva decisiones entre sesiones. Se registra con `engram setup opencode`, que
  escribe en la configuración global de cada máquina y por eso no está en el repo.

## Convenciones técnicas de este proyecto

Estas no se negocian por historia. El detalle de cada una está en
`docs/decisions.md`.

- **Sin TypeScript.** El frontend es JavaScript.
- **Los tests del backend son pytest.** `unittest` no se usa.
- **Los tests corren contra PostgreSQL real**, nunca SQLite: el modelo usa
  `num_nonnulls`, índices únicos sobre columnas normalizadas y CHECKs que
  SQLite no tiene. Una suite en SQLite pasaría y la migración fallaría después.
- **El idioma del código sigue al idioma del dominio, que es español.** Las
  entidades son `Comision`, `Inscripcion`, `Cobranza`, sin tildes en el
  código. Los nombres, el código y los paths van en inglés. El glosario traduce
  hacia afuera.
- **La UI es es-AR** y la base de strings no se extrae: no hay i18n.
- **Solo el login llama al backend.** El resto del frontend consume
  `src/services/`, que es la única frontera de datos: los componentes no
  importan `src/mocks/` ni conocen la fuente.
- **Los datos del maquetado son placeholders**, no datos de negocio. La
  secretaría carga los reales cuando el sistema esté funcional.
