# Agent notes for ui-break-cases

## Environment

- Node 22.12.0 or newer (`.nvmrc` is `22.12.0`, matching `package.json` `engines`). npm 10+.
- Install from the lockfile: `npm ci`.
- Chromium is the only verified browser:

```bash
npx playwright install chromium
# Linux CI / containers:
npx playwright install --with-deps chromium
```

## Commands

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite gallery at port 5173 |
| `npm run typecheck` | `tsc` for app, Vite config, and Playwright files |
| `npm run build` | Production gallery + copied fixtures into `dist/` |
| `npm run build:pages` | Same build with `base` `/ui-break-cases/` |
| `npm run preview` | Serve `dist/` at port 4173 |
| `npm test` | Build, preview, Playwright Chromium |
| `npm run check:pages` | `build:pages`, serve `dist/` at `/ui-break-cases/`, assert gallery + assets + 9 fixtures return 200 |
| `npm run verify:skill` | Classifier + generated templates + control geometry + skill-copy drift |
| `npm run mutate:classify` | Apply issue #8 classify.ts mutants; report killed / alive / timeout / error |
| `npm run capture:demo` | Playwright screenshots of broken/fixed fixtures + system `ffmpeg` → `docs/media/broken-vs-fixed.gif` |
| `npm run capture:launch` | Playwright + `ffmpeg` → `docs/media/launch-ubc*.mp4`, `.gif`, `spec-hit-test.png` |

Tests hit the preview server, not `npm run dev`. If preview is already running on 4173, Playwright reuses it outside CI.

A CI workflow is included (`.github/workflows/ci.yml`); GitHub Actions is currently disabled, so run the checks locally.

`npm run capture:demo` and `npm run capture:launch` need a system `ffmpeg` binary. It is not an npm dependency. The GIFs and launch media are committed artifacts; do not invent or hand-edit frames.

`capture:launch` loads TTF files from common system paths (DejaVu, then Liberation, then optional macOS Inter / JetBrains Mono). Override with `UI_BREAK_FONT_SANS_BOLD`, `UI_BREAK_FONT_SANS`, `UI_BREAK_FONT_MONO`, and `UI_BREAK_FONT_MONO_BOLD`. It does not require fonts under `/usr/share/fonts/truetype/macos`.

## Invariants for this repo

- Scope is three cases × three variants. Do not add a scanner, backend, LLM, MCP, extra browser, or extra case unless the task says so.
- Broken tests must pass by asserting the defect. Never `test.skip` or `test.fail` them to get a green suite.
- Tests open fixture HTML directly (`fixtures/<id>/<variant>.html`) with the viewport in `src/cases.ts`. Do not test defects through gallery iframes.
- Footer iframe height stays at the declared viewport. Do not auto-resize it to content.
- Geometric helpers in `tests/helpers.ts` are for these fixtures. Do not present them as general detectors.
- Gallery must remain keyboard-usable. Intentional breakage lives in fixtures, not in gallery chrome.

## Where to edit

- Manifest: `src/cases.ts`, types in `src/types.ts`
- Fixtures: `public/fixtures/<id>/`
- Tests: `tests/<id>.spec.ts`
- Gallery: `src/gallery.ts`, `src/styles.css`
- Agent skill: `skill/SKILL.md` (canonical), identical copy at `.agents/skills/ui-break-cases/`, helpers in `skill/lib/geometry.ts`, docs in `docs/agent-skill.md`

New cases: follow `docs/adding-a-case.md`. If you add a case, update `skill/cases/` and `skill/templates/` too.

## Decisions (v0.1)

- Vite 8.3.5, TypeScript 5.9, Playwright 1.64, Node 22.12.0 or newer.
- Default Vite `base` is `./`. Optional `VITE_BASE=/ui-break-cases/` (`npm run build:pages`) writes absolute asset URLs. Vite preview still serves `public/fixtures` at `/fixtures/`. GitHub Pages is not enabled; when it is, that tree is served at `/ui-break-cases/`.
- `appType` is `mpa` so fixture HTML is not replaced by the gallery `index.html`.
- Shared copy is duplicated in HTML and in `src/cases.ts` so fixtures stay standalone. Keep them in sync by hand.
- Tolerance: 4px. Defects are built to exceed 16px.

## Decisions (v0.2)

- The agent skill lives in-repo. `skill/SKILL.md` is the source of truth; Cursor and Codex load the identical copy at `.agents/skills/ui-break-cases/SKILL.md`. Claude Code copies `skill/install/claude.SKILL.md`. There is no second skill under `.cursor/skills` or `.claude/skills` (Cursor would double-load it). It is not published to a marketplace.
- Generated tests import `skill/lib/geometry.ts` and open `TARGET.url` with `page.goto`. They must not import `../../src` or `../../tests`.
- `npm run verify:skill` is a deterministic stand-in for the templates and classifier. Recorded Cursor runs live in `docs/agent-runs/`. It does not prove Claude Code or Codex will follow the skill.
