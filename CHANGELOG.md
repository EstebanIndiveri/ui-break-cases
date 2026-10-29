# Changelog

## v0.2.0 — 2026-10-29

- Skill / plugin package for coding agents (Cursor, Claude Code, Codex) in `skill/`, with per-agent wrappers and install notes in `docs/agent-skill.md`.
- Detection and fix guidance for each case in `src/cases.ts`, plus Playwright templates that fail on broken fixtures and pass on fixed fixtures.
- Local `npm run verify:skill` harness. No GitHub Actions dependency. Agent output still needs a human review.

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
