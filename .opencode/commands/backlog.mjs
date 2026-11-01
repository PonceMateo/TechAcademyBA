// .opencode/commands/backlog.mjs
import { execFileSync } from "node:child_process";

const gh = (args) => execFileSync("gh", args, { encoding: "utf8" });

const ESTADOS = ["Backlog", "Ready", "In progress", "In review", "Done"];
const ENCABEZADO = "story\ttitle\tstatus\tpriority\testimate\tissue\n";

const filas = () =>
  gh([
    "project", "item-list", "1", "--owner", "PonceMateo", "--limit", "200",
    "--format", "json", "--jq",
    ".items[] | [.content.number, .content.title, .status, .priority, .estimate] | @tsv",
  ])
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [issue, title = "", status, priority, estimate] = l.split("\t");
      const m = title.match(/^H\/U\s*(\d+)\s*[·\-–]/);
      const storyNum = m ? Number(m[1]) : null;
      // Story number from the title; if absent, fall back to the issue number as "#N".
      const story = m ? m[1] : issue ? `#${issue}` : "";
      return { story, storyNum, title, status, priority, estimate, issue };
    })
    .sort((a, b) => {
      // Stories first (desc by story number); rows without story number last (desc by issue).
      if (a.storyNum !== null && b.storyNum !== null) return b.storyNum - a.storyNum;
      if (a.storyNum !== null) return -1;
      if (b.storyNum !== null) return 1;
      return Number(b.issue) - Number(a.issue);
    });

const fmt = (f) =>
  [f.story, f.title, f.status, f.priority, f.estimate, f.issue ? `#${f.issue}` : ""].join("\t");

const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const historia = valor("--story");
const statusArg = valor("--status");
const todo = args.includes("--all");

if (historia) {
  if (!/^#?\d+$/.test(historia)) {
    console.error("Uso: backlog.mjs --story <n> (historia) o --story #<n> (issue sin título H/U)");
    process.exit(1);
  }
  const f = filas().find((f) => f.story === historia);
  if (!f) {
    console.error(`No hay una fila para "${historia}" en el board.`);
    process.exit(2);
  }
  console.log(`Fila del board: ${f.story} | ${f.status} | ${f.priority} | ${f.estimate} | #${f.issue}\n`);
  process.stdout.write(gh(["issue", "view", f.issue, "--json", "title,body,state"]));
} else {
  let rows = filas();
  if (statusArg) {
    const pedidos = statusArg.split(",").map((s) => s.trim().toLowerCase());
    const invalidos = pedidos.filter((p) => !ESTADOS.some((e) => e.toLowerCase() === p));
    if (invalidos.length) {
      console.error(`Estado inválido: ${invalidos.join(", ")}. Válidos: ${ESTADOS.join(", ")}`);
      process.exit(1);
    }
    rows = rows.filter((f) => pedidos.includes((f.status ?? "").toLowerCase()));
  } else if (!todo) {
    rows = rows.filter((f) => f.status !== "Done");
  }
  process.stdout.write(ENCABEZADO + rows.map(fmt).join("\n") + "\n");
}