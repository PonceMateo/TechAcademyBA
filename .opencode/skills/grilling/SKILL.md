---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

Ask each round with the native `question` tool, not as prose: one `questions` entry per frontier question, all in a single call. This gives the user clickable options and a free-text field.

- `header`: 3-5 word label for the decision.
- `question`: the full body, including any tradeoffs the user needs to choose well.
- `options`: 2-4 concrete answers, each with a one-line `description` of what it commits to. Put your recommended answer first and suffix its label with `(Recommended)`. Since custom answers are enabled by default, never add an `Other` or catch-all option.
- Add a "Yes, go with that" option only when the question is genuinely binary; otherwise the recommendation itself is the fast path.

Do not number questions or print the old `❓`/`➡️` blocks. The tool renders each header as the question title; your recommendation lives in the first option and its description. If the `question` tool is unavailable in the current host, fall back to the numbered markdown round, with the recommendation as the first multiple-choice option.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
