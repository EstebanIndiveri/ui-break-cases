---
name: ui-break-cases
description: Review a UI for flex min-width overflow, fixed-height text clipping, or a fixed footer covering the last control. Confirm with geometry, skip controls, propose a fix matching the fixed fixture, and emit a Playwright test. Use when asked to find these CSS layout bugs or adapt ui-break-cases tests.
---

# ui-break-cases (Cursor)

Copy this file to `.cursor/skills/ui-break-cases/SKILL.md` in the project you want the agent to review, and copy the `skill/` directory (or clone this repository so the relative paths resolve).

**Before proposing a fix or a test, read:**

1. `skill/SKILL.md` — workflow, tolerances, limits
2. `skill/cases/<id>.md` — symptom, geometry, variant, fix
3. `skill/templates/<id>.spec.ts` — Playwright test to copy
4. `tests/helpers.ts` — `GEOM_TOLERANCE_PX` (4) and `CLEAR_DEFECT_PX` (16)

If the page resembles a **control**, report no bug. Chromium only. Human review required. See `docs/agent-skill.md`.
