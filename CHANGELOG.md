# Changelog

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
