# RUN

This repository is meant to be run by a coding agent for long stretches. The “loop” is not a separate daemon yet. The loop is the agent repeatedly choosing the next highest-leverage task from `program.md`, verifying the result, logging it, and continuing.

## What To Run

Run your preferred coding agent from this directory:

```bash
cd /Users/nullswan/projects/obsidian-web-loop
```

If you want a long unattended session, keep it inside `tmux`:

```bash
tmux new -s obsidian-web-loop
cd /Users/nullswan/projects/obsidian-web-loop
```

Then launch your coding agent CLI from the repo root.

Any agent is fine if it can:

- read and write files
- run shell commands
- keep working without repeated human steering
- update notes as it goes

## Startup Prompt

Give the agent this exact prompt:

```text
Read RUN.md, program.md, docs/plan.md, docs/legal-boundary.md, docs/architecture.md, and skills/obsidian-web/SKILL.md.

Then start executing the project autonomously.

Trust your best judgment.
Do not ask me follow-up questions unless you are blocked by a legal boundary, a missing credential, or a destructive action.
Do not stop after planning.
Choose the next highest-leverage task, implement it, verify it, update docs, write a lab note, and continue.
Keep going for hours.
```

## How The Loop Should Behave

The agent should:

1. read the docs
2. choose a task
3. implement
4. verify
5. write a lab note
6. continue immediately

The agent should not:

- wait for approval after every small task
- stop after making a plan
- ask “what next?”
- spend hours only brainstorming without shipping artifacts

## Suggested Human Steering

Use the smallest amount of steering possible.

Good steering:

- “Keep going.”
- “Bias toward working code over more docs.”
- “Focus on the vault kernel next.”
- “Defer plugins and get editor parity first.”

Bad steering:

- giving a new task every few minutes
- changing priorities before the current milestone settles
- asking for large rewrites without evidence

## Session Cadence

A good unattended run looks like this:

- every task ends with a verification step
- every iteration writes a file in `lab-notes/`
- every 5 iterations the agent updates the roadmap and parity docs
- every major architecture change updates the corresponding doc

## Resume Prompt

When the session ends because of context limits or time, start a fresh one with:

```text
Read RUN.md, program.md, the latest files in lab-notes/, and the current docs.

Resume from the latest recommended next task.
Trust your best judgment.
Do not ask follow-up questions unless blocked by a legal boundary, a missing credential, or a destructive action.
Continue the loop.
```

## Stop The Loop Only If

- a real legal blocker is hit
- the next step requires a secret or credential
- the next step is destructive
- the current milestone is complete and documented

## Recommended First Concrete Task

If you are starting from scratch, the first task should be:

1. turn this prompt pack into a real codebase scaffold
2. create a minimal monorepo or app structure
3. implement the vault model and fixture vault
4. add eval scaffolding

That gives the later loops real code to push on instead of only docs.
