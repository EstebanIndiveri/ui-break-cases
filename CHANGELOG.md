# Changelog

## Unreleased

- Scorer: strip ANSI from `specOutput` before parsing; prompt asks for `NO_COLOR=1` when capturing Playwright output.
- Launch excerpt: ignore commented-out `expect(overlapHeight…)` anchors, and say the hit `expect` is missing instead of `exceeded cap`.
- Classifier tests: kill remaining bottom-tolerance-0 mutants (N10, N13–N16, N20, N23) and the leftover v0.2 gates (`nextClear`, `action.right`, `rects`, `clip`, `localScroll`, `next-content`). Dropping `action.right` from the flex **fixed** gate is equivalent to `overflow <= tolerance` (documented, not forced). `node scripts/mutate-classify.mjs` reruns that set.
- Docs: drop the stale “while bc-170139f1 is running” line; stop leaking the blind-run-2 p01 answer; do not reuse that set for Claude Code or Codex.

## v0.2.0 — 2026-10-29

- Skill / plugin package for coding agents (Cursor, Claude Code, Codex) in `skill/`. `skill/SKILL.md` is the source of truth; Cursor and Codex load the identical copy at `.agents/skills/ui-break-cases/`.
- Portable templates import `skill/lib/geometry.ts` and open `TARGET.url` (`page.goto`). They do not import `../../src` or `../../tests`.
- Detection and fix guidance for each case, plus Playwright templates that fail on broken fixtures via `expect` and pass on fixed fixtures. Control is measured (not hardcoded).
- Local `npm run verify:skill` harness and `npm run check:skill-copies`. Recorded Cursor run in `docs/agent-runs/`. No GitHub Actions dependency. Agent output still needs a human review.

## v0.1.1 — 2026-10-29

- Gallery: keyboard focus moves correctly when switching cases (#4).
- Pages: description, canonical and Open Graph / Twitter card tags.
- README: live demo link; removed "coming soon" notes.

## v0.1.0 — 2026-10-28

- Three cases, each with broken, fixed, and control fixtures: `flex-long-text`, `fixed-height-label`, and `fixed-footer-overlap`.
- Playwright tests, Chromium only. Broken tests pass by asserting the defect.
- A static gallery for browsing cases and variants.
- A guide for adding a case in `docs/adding-a-case.md`.
- MIT license.
