# Agent skill (v0.2)

A portable instructions package so a coding agent (Cursor, Claude Code, Codex) can review a UI for the **three** bug patterns in this repo, skip layouts that match a **control**, propose a fix that matches the **fixed** fixture, and emit a Playwright test.

It is not a scanner, a hosted service, or a marketplace plugin.

## Limits (read these first)

- **Chromium only.** Fixtures and tests are not verified in Firefox, WebKit, or mobile Safari.
- **These patterns only.** `flex-long-text`, `fixed-height-label`, `fixed-footer-overlap`. Other layout bugs are out of scope.
- **Human review is required.** Treat the agent’s diagnosis, CSS, and generated test as a draft.
- Helpers in `skill/lib/geometry.ts` are for these patterns. They are not general detectors.
- GitHub Actions is not required. Run the checks locally.

## Package layout

| Path | Role |
| --- | --- |
| `skill/SKILL.md` | Canonical workflow (source of truth) |
| `.agents/skills/ui-break-cases/SKILL.md` | Identical copy. Cursor and Codex load this path. |
| `skill/install/claude.SKILL.md` | Identical copy. Paste to `.claude/skills/ui-break-cases/SKILL.md` for Claude Code. Not committed under `.claude/skills` here so Cursor does not load the skill twice. |
| `skill/cases/*.md` | Per-case symptom, geometry, variant, fix |
| `skill/lib/geometry.ts` | Portable helpers. No imports from `../../src` or `../../tests`. |
| `skill/templates/*.spec.ts` | Playwright test that asserts the **healthy** (fixed) layout via `page.goto(TARGET.url)` |
| `skill/verify/classify.ts` | Mechanical classifier used by local verification |
| `.cursor/rules/ui-break-cases.mdc` | Optional on-demand Cursor rule (not a second skill) |
| `skill/install/codex-AGENTS.md` | Codex `AGENTS.md` snippet to paste |
| `docs/agent-runs/` | Recorded Cursor run against the nine fixtures |

`npm run check:skill-copies` fails if the SKILL.md copies drift.

## Install per agent

Clone this repository, or copy `skill/` plus the loader your agent uses.

### Cursor

Copy `.agents/skills/ui-break-cases/` and the `skill/` directory into the target project (or keep this repo as a sibling the agent can read). Cursor loads `.agents/skills/<name>/SKILL.md`.

Do **not** also copy the skill into `.cursor/skills` or `.claude/skills` in the same project — Cursor would list it twice.

Optional: copy `.cursor/rules/ui-break-cases.mdc` if you want an on-demand rule in addition to the skill.

### Claude Code

Copy `skill/install/claude.SKILL.md` to `.claude/skills/ui-break-cases/SKILL.md` in the target project, and copy `skill/` so the relative reads resolve. Restart or start a session that can see project skills.

### Codex

Paste `skill/install/codex-AGENTS.md` into the target project’s `AGENTS.md`, and copy `.agents/skills/ui-break-cases/` plus `skill/`. Adjust relative paths if those directories are not at the repo root.

## How the agent should work

1. Open the **page under review** directly (`TARGET.url`, not a gallery iframe).
2. Confirm the symptom with geometry: `boundingBox` / `getBoundingClientRect`, `Range.getClientRects` for clipped text, `elementFromPoint` at a control’s center **before** clicking.
3. Decide which case applies and whether the page resembles **broken**, **fixed**, or **control**. Control is measured (computed `overflow-x`, painted expand, spacer height), not inferred from a node existing in the DOM. If a control and a broken pattern both match, **control wins**.
4. Control or fixed → report **no bug**. Do not restyle a valid design.
5. Broken → change CSS/markup to match that case’s `fixed` variant. Keep the original string and the control.
6. Copy `skill/templates/<id>.spec.ts` and `skill/lib/geometry.ts`. Point `TARGET.url` at the user’s page. Use `GEOM_TOLERANCE_PX = 4` and `CLEAR_DEFECT_PX = 16`. Comment any other pixel value.

The generated test asserts healthy layout, so it **fails on broken** (via `expect`) and **passes on fixed**.

## What was verified here vs what depends on the agent

A Cursor session against the nine fixtures is recorded in [`docs/agent-runs/`](agent-runs/README.md). Claude Code and Codex were **not** run.

Local verification is deterministic:

```bash
npm ci
npx playwright install chromium
npm test
npm run check:skill-copies
npm run verify:skill
```

| Check | Command | Proves | Does not prove |
| --- | --- | --- | --- |
| Existing suite | `npm test` | Gallery, nine fixture tests, classifier, control mutations, flex 99999 threshold | That an agent will follow the skill |
| Skill copies | `npm run check:skill-copies` | `skill/SKILL.md` matches `.agents/skills` and `skill/install/claude.SKILL.md` | Agent behavior |
| Skill harness | `npm run verify:skill` | Classifier labels each fixture separately; each template **fails on broken via expect()** and **passes on fixed**; each **control** has a real geometry check | That an agent will pick the right case on a different codebase |

`npm run verify:skill` prints pass/fail **per check**. Control fixtures are not expected to pass the “healthy flex card / unclipped label” templates — those layouts are valid by design. The harness runs geometry on the control instead of hardcoding `ok: true`.

Install outside this repo is proven by copying `skill/` into a temp project and running one generated test; see `docs/agent-runs/temp-project.md`.

## Tolerances

Same as the rest of the repo, from `skill/lib/geometry.ts`:

- `GEOM_TOLERANCE_PX = 4`
- `CLEAR_DEFECT_PX = 16`

Defects in the fixtures are built to exceed 16px. The 4–16px band is unclassified (not broken).
