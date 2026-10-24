# Herramientas: qué hacer si algo falla

Se lee solo cuando `node .opencode/commands/check-tools.mjs` reporta algo distinto de OK.
Si un MCP falla, casi siempre es el binario que lo lanza (Node, `npx`), no la config de `opencode.json`.

## gh (`FALTA`, `SIN_SESION` o `SIN_SCOPE_PROJECT`)

Preguntá con `question`: «Sí (abre una pestaña nueva)» / «No».
Por qué conviene el Sí: el backlog vive en el board de GitHub y, sin `gh`, no se
pueden leer las historias actuales ni su estado, y se trabajaría con información
del repo que puede estar desactualizada.

- Instalar: `winget install --id GitHub.cli -e` (Windows), `brew install gh`
  (macOS/Linux) o, si en Linux no funciona, la guía oficial
  (https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
- Login: `gh auth login --web -s project` (o `gh auth refresh -s project`).
- Nunca pedir el token por chat.
- Plan B: si el usuario no quiere, seguir con lo que haya en el repo y decirlo.

## CodeGraph (`SIN_INDICE` o devuelve vacío)

Preguntá una vez con «Sí (recomendado)» / «No» si correr
`npx -y @colbymchenry/codegraph init`.
Por qué conviene el Sí: el índice permite encontrar símbolos y llamadas sin leer
archivos enteros, así que gasta menos tokens y acierta más; es local y se hace
una sola vez por máquina.
Plan B: si no hay Node o dice que no, usar Read, Grep y Glob.

## Context7

Documentación de librerías. Si falla, no inventar APIs ni versiones y avisar que
no se pudieron verificar.

## Engram

Memoria entre sesiones (`engram setup opencode`, por máquina). Si falla, seguir sin memoria.
