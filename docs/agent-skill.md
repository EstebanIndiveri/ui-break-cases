# Agent skill (v0.2)

A portable instructions package so a coding agent (Cursor, Claude Code, Codex) can review a UI for the **three** bug patterns in this repo, skip layouts that match a **control**, propose a fix that matches the **fixed** fixture, and emit a Playwright test.

It is not a scanner, a hosted service, or a marketplace plugin.

## Limits (read these first)

- **Chromium only.** Fixtures and tests are not verified in Firefox, WebKit, or mobile Safari.
- **These patterns only.** `flex-long-text`, `fixed-height-label`, `fixed-footer-overlap`. Other layout bugs are out of scope.
- **Human review is required.** Treat the agent’s diagnosis, CSS, and generated test as a draft.
- Helpers in `tests/helpers.ts` are for these fixtures. They are not general detectors.
- GitHub Actions is not required. Run the checks locally.

## Package layout

| Path | Role |
| --- | --- |
| `skill/SKILL.md` | Canonical workflow |
| `skill/cases/*.md` | Per-case symptom, geometry, variant, fix |
| `skill/templates/*.spec.ts` | Playwright test that asserts the **healthy** (fixed) layout |
| `skill/verify/classify.ts` | Mechanical classifier used by local verification |
| `.cursor/skills/ui-break-cases/SKILL.md` | Cursor skill wrapper |
| `.cursor/rules/ui-break-cases.mdc` | Cursor rule wrapper (on-demand) |
| `.claude/skills/ui-break-cases/SKILL.md` | Claude Code skill wrapper |
| `skill/install/codex-AGENTS.md` | Codex `AGENTS.md` snippet to paste |

## Install per agent

Clone this repository (or copy `skill/` plus the wrapper you need). The wrappers tell the agent to read `skill/SKILL.md`.

### Cursor

**Skill (preferred):** copy `.cursor/skills/ui-break-cases/` into the target project, and copy `skill/` next to it (or keep this repo as a sibling the agent can read).

**Rule:** copy `.cursor/rules/ui-break-cases.mdc` into the target project’s `.cursor/rules/`. The rule is not always-on; it applies when the task matches the description.

### Claude Code

Copy `.claude/skills/ui-break-cases/` into the target project as `.claude/skills/ui-break-cases/`, and copy `skill/` so the relative reads resolve. Restart or start a session that can see project skills.

### Codex

Paste `skill/install/codex-AGENTS.md` into the target project’s `AGENTS.md`. Adjust relative paths if `skill/` is not at the repo root.

## How the agent should work

1. Open the **page under review** directly (not a gallery iframe).
2. Confirm the symptom with geometry: `boundingBox` / `getBoundingClientRect`, `Range.getClientRects` for clipped text, `elementFromPoint` at a control’s center **before** clicking.
3. Decide which case applies and whether the page resembles **broken**, **fixed**, or **control**.
4. Control or fixed → report **no bug**. Do not restyle a valid design.
5. Broken → change CSS/markup to match that case’s `fixed` variant. Keep the original string and the control.
6. Copy `skill/templates/<id>.spec.ts`. Point `TARGET` at the user’s URL, viewport, and selectors. Use `GEOM_TOLERANCE_PX = 4` and `CLEAR_DEFECT_PX = 16`. Comment any other pixel value.

The generated test asserts healthy layout, so it **fails on broken** and **passes on fixed**.

## What was verified here vs what depends on the agent

A real Cursor / Claude Code / Codex session against arbitrary product UI is **not** part of this repo’s checks. Local verification is deterministic:

```bash
npm ci
npx playwright install chromium
npm test
npm run verify:skill
```

| Check | Command | Proves | Does not prove |
| --- | --- | --- | --- |
| Existing suite | `npm test` | Gallery, nine fixture tests, and the classifier on all nine fixtures | That an agent will follow the skill |
| Skill harness | `npm run verify:skill` | Classifier labels each fixture; each template **fails on broken** and **passes on fixed**; each **control** is `bug=no` | That an agent will pick the right case on a different codebase |

`npm run verify:skill` prints pass/fail per fixture. Control fixtures are not expected to pass the “healthy flex card / unclipped label” templates — those layouts are valid by design, so the harness records **no bug** from detection and does not treat the healthy template as a defect report.

## Tolerances

Same as the rest of the repo, from `tests/helpers.ts`:

- `GEOM_TOLERANCE_PX = 4`
- `CLEAR_DEFECT_PX = 16`

Defects in the fixtures are built to exceed 16px.
