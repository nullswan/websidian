# Obsidian Web Loop

This directory packages a long-running agent prompt, plan, and runbook for building a high-fidelity web-native Obsidian-compatible product without modifying or browser-hosting the proprietary Obsidian app.

The loop is inspired by:

- Ralph-style continuous autonomy: an outer verification loop that keeps going until the work is actually done.
- Karpathy's `autoresearch`: a narrow editable surface, repeatable evals, and a bias toward small, measurable improvements.

Start here:

- `RUN.md` explains how to hand this directory to an agent and let it work for hours.
- `program.md` is the primary long-running prompt.
- `docs/plan.md` is the roadmap and milestone order.
- `skills/obsidian-web/SKILL.md` is the compact instruction set for future agents.

Structure:

- `program.md`: master prompt for the agent loop.
- `RUN.md`: human runbook.
- `docs/`: architecture, legal boundary, roadmap, parity matrix, sync, security, and API scaffolding.
- `evals/`: fidelity score definitions and future automated checks.
- `lab-notes/`: append-only iteration and handoff notes.
- `skills/obsidian-web/SKILL.md`: short-form working instructions.
