# Tools: if something fails

Read only if `node .opencode/commands/check-tools.mjs` ≠ OK.
MCP fails = binary launching (Node, `npx`), not `opencode.json`.

## gh (`MISSING`, `NO_SESSION` or `NO_SCOPE_PROJECT`)

Ask with `question`: "Yes (new tab)" / "No".
Yes is good: backlog lives in GitHub board; without `gh` can't read current stories or status, work with outdated repo info.

- Install: `winget install --id GitHub.cli -e` (Windows), `brew install gh` (macOS/Linux); if Linux fails, official guide (https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
- Login: `gh auth login --web -s project` (or `gh auth refresh -s project`).
- Never ask token via chat.
- Plan B: if user declines, continue with repo and say so.

## CodeGraph (`NO_INDEX` or empty)

Ask once "Yes (recommended)" / "No" to run `npx -y @colbymchenry/codegraph init`.
Yes: index finds symbols and calls without reading whole files; fewer tokens, more accurate; local, once per machine.
Plan B: no Node or rejects, use Read, Grep, Glob.

## Context7

Library docs. If fails, don't invent APIs or versions; warn.

## Engram

Memory across sessions (`engram setup opencode`, per machine). If fails, continue without memory.
