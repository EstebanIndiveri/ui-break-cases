<!--
Codex install: paste this block into the AGENTS.md of the project you want
the agent to review. Point the relative paths at your checkout of
ui-break-cases, or copy skill/ and .agents/skills/ui-break-cases/ into
that project.

This snippet does not replace ui-break-cases' own AGENTS.md.
-->

## ui-break-cases layout review

When reviewing UI layout, CSS overflow, clipped text, or a fixed footer covering a control:

1. Read `skill/SKILL.md` (or `.agents/skills/ui-break-cases/SKILL.md`) and the matching file in `skill/cases/`.
2. Confirm the defect with geometry (`boundingBox`, `Range.getClientRects`, `elementFromPoint` before clicking). Use `GEOM_TOLERANCE_PX = 4` and `CLEAR_DEFECT_PX = 16` from `skill/lib/geometry.ts`.
3. Classify the page as resembling **broken**, **fixed**, or **control**. Control is geometry (local scroll, painted expand, matching spacer), not a node in the DOM.
4. If it resembles **control** or **fixed**, report **no bug** and do not change the layout.
5. If it resembles **broken**, propose a fix that keeps the original copy and the control usable (min-width: 0 + overflow-wrap; height: auto; padding-bottom or a spacer equal to the footer).
6. Copy `skill/templates/<id>.spec.ts` and `skill/lib/geometry.ts`. Set `TARGET.url` to the page under review (`page.goto(TARGET.url)`). The test must fail on the broken page via `expect` and pass on the fixed page.

Limits: Chromium only; these three patterns only (`flex-long-text`, `fixed-height-label`, `fixed-footer-overlap`); output must be reviewed by a human. See `docs/agent-skill.md`.
