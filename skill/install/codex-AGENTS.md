<!--
Codex install: paste this block into the AGENTS.md of the project you want
the agent to review. Point the relative paths at your checkout of
ui-break-cases, or copy skill/ into that project.

This snippet does not replace ui-break-cases' own AGENTS.md.
-->

## ui-break-cases layout review

When reviewing UI layout, CSS overflow, clipped text, or a fixed footer covering a control:

1. Read `skill/SKILL.md` and the matching file in `skill/cases/`.
2. Confirm the defect with geometry (`boundingBox`, `Range.getClientRects`, `elementFromPoint` before clicking). Use `GEOM_TOLERANCE_PX = 4` and `CLEAR_DEFECT_PX = 16` from `tests/helpers.ts`.
3. Classify the page as resembling **broken**, **fixed**, or **control**.
4. If it resembles **control** or **fixed**, report **no bug** and do not change the layout.
5. If it resembles **broken**, propose a fix equivalent to `public/fixtures/<id>/fixed.html`. Keep the original copy and the control usable.
6. Copy `skill/templates/<id>.spec.ts` and adapt `TARGET` to the page under review. The test must fail on the broken page and pass on the fixed page.

Limits: Chromium only; these three patterns only (`flex-long-text`, `fixed-height-label`, `fixed-footer-overlap`); output must be reviewed by a human. See `docs/agent-skill.md`.
