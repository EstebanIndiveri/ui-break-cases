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

Tests hit the preview server, not `npm run dev`. If preview is already running on 4173, Playwright reuses it outside CI.

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

New cases: follow `docs/adding-a-case.md`.

## Decisions (v0.1)

- Vite 8.3.5, TypeScript 5.9, Playwright 1.64, Node 22.12.0 or newer.
- Default Vite `base` is `./` (works locally and as a GitHub Pages project site). Optional `VITE_BASE=/ui-break-cases/` (`npm run build:pages`) writes absolute asset URLs. Vite preview will still serve `public/fixtures` at `/fixtures/`; GitHub Pages serves them at `/ui-break-cases/fixtures/` because the whole `dist/` tree is mounted there.
- `appType` is `mpa` so fixture HTML is not replaced by the gallery `index.html`.
- Shared copy is duplicated in HTML and in `src/cases.ts` so fixtures stay standalone. Keep them in sync by hand.
- Tolerance: 4px. Defects are built to exceed 16px.
