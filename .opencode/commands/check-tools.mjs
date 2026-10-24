#!/usr/bin/env node
// Revision rapida de gh y CodeGraph (ver "Herramientas" en AGENTS.md).
// Uso: node .opencode/commands/check-tools.mjs   (Windows, macOS y Linux)
// Imprime una linea por herramienta. Sale con codigo 1 si alguna no esta OK.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Corre `gh` y junta stdout y stderr. Devuelve null si el binario no existe.
function gh(args) {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.error) return null;
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function checkGh() {
  if (!gh(["--version"])?.ok) return "FALTA";
  const auth = gh(["auth", "status"]);
  if (!auth?.ok) return "SIN_SESION";
  const scopes = auth.out.match(/Token scopes:(.*)/i);
  if (scopes && !/\bproject\b/.test(scopes[1])) return "SIN_SCOPE_PROJECT";
  return "OK";
}

// El indice de CodeGraph es local por maquina y vive en la raiz del repo
// (este script esta en .opencode/commands/, dos niveles mas abajo).
const codegraphDir = fileURLToPath(new URL("../../.codegraph", import.meta.url));
const results = [
  ["gh", checkGh()],
  ["codegraph", existsSync(codegraphDir) ? "OK" : "SIN_INDICE"],
];

for (const [name, status] of results) console.log(`${name}: ${status}`);

const failing = results.some(([, status]) => status !== "OK");
if (failing) console.log("ACCION: hacer la pregunta de cada herramienta que no diga OK.");
process.exit(failing ? 1 : 0);
