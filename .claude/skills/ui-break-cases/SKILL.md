---
name: ui-break-cases
description: Review a UI for flex min-width overflow, fixed-height text clipping, or a fixed footer covering the last control. Confirm with geometry, skip controls, propose a fix matching the fixed fixture, and emit a Playwright test. Use when asked to find these CSS layout bugs or adapt ui-break-cases tests.
---

# ui-break-cases (Claude Code)

This is the Claude Code wrapper for the skill package in this repo.

**Before proposing a fix or a test, read:**

1. `skill/SKILL.md` — workflow, tolerances, limits
2. `skill/cases/<id>.md` — symptom, geometry, variant, fix
3. `skill/templates/<id>.spec.ts` — Playwright test to copy
4. `tests/helpers.ts` — `GEOM_TOLERANCE_PX` (4) and `CLEAR_DEFECT_PX` (16)

Then follow that workflow. If the page resembles a **control**, report no bug. Do not invent other pixel slacks. Chromium only. A human must review the output.

Install for another project: copy this directory to `.claude/skills/ui-break-cases/` and copy the `skill/` directory (or clone this repository). Details in `docs/agent-skill.md`.
