# ui-break-cases — reproducible CSS layout bugs, explained fixes, and Playwright tests

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/tested%20with-Playwright-2EAD33)](https://playwright.dev)
[![Chromium only](https://img.shields.io/badge/browser-Chromium%20only-4285F4)](https://www.chromium.org/Home)
[![3 cases](https://img.shields.io/badge/cases-3-0e8a16)](#cases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)](https://www.typescriptlang.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**[Live demo →](https://estebanindiveri.github.io/ui-break-cases/)** · [Cases](#cases) · [Quickstart](#quickstart) · [Propose a case](#propose-a-case)

Reproducible UI bugs, explained fixes, and tests you can reuse.

A small collection of real-world CSS layout failures — a long URL overflowing a flex row (`min-width: auto`), text clipped by a fixed-height container (`overflow: hidden`), and a fixed footer covering the last button on short mobile screens. Each case ships a **broken** page, a **fixed** page that keeps the content and the action, a **control** page that looks similar but is valid by design, and a **Playwright test** you can copy and point at your own component.

It is for people who write UI tests or CSS and want a concrete example to copy. It is not a scanner, a benchmark, or a claim that these are the only bugs that matter.

![Side-by-side comparison of the three fixtures. Left column broken, right column fixed, with capture-only red outlines: a long URL overflowing a flex card while Copy stays on screen; a status sentence clipped to one line; Confirm booking covered by a fixed footer.](docs/media/broken-vs-fixed.gif)

## Quickstart

```bash
npm ci
npx playwright install chromium
npm test
```

The side-by-side comparison is captured from the real fixtures with Playwright. Red outlines and large BROKEN/FIXED labels are capture-only overlays; they are not part of the fixtures or the tests. Regenerate it with `npm run capture:demo` (needs Playwright Chromium and a system `ffmpeg` binary; not an npm package).

## Requirements

- Node.js 22.12.0 or newer (`.nvmrc` and `package.json` `engines` use this floor)
- npm 10+
- Playwright’s Chromium browser (installed separately, see below)

## Install and run

```bash
npm ci
npm run dev
```

`npm run dev` serves the gallery at [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Fixtures are also reachable on their own, for example [http://127.0.0.1:5173/fixtures/flex-long-text/broken.html](http://127.0.0.1:5173/fixtures/flex-long-text/broken.html).

Production build:

```bash
npm run typecheck
npm run build
npm run preview
```

`npm run preview` serves `dist/` at [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The Vite `base` is `./`, so asset and fixture URLs stay relative. Vite’s preview server does not remount `public/` files under `/ui-break-cases/`; see [Live demo](#live-demo) for the Pages build.

## Chromium for Playwright

v0.1 verifies Chromium only.

```bash
npx playwright install chromium
```

On Linux CI images, install OS dependencies as well:

```bash
npx playwright install --with-deps chromium
```

Then:

```bash
npm test
```

`npm test` builds the production bundle, previews it, and runs Playwright against that server. Tests open fixture HTML directly with the viewport declared in `src/cases.ts`. They do not drive the gallery iframes.

## Cases

| Case | Broken | Fixed | Control | Fixture / Test |
| --- | --- | --- | --- | --- |
| Long URL overflows a flex row (`flex-long-text`, 390×640) | An unbreakable URL overflows a flex row and pushes **Copy** out of the card. | `min-width: 0` and `overflow-wrap: anywhere` keep the same URL and the action inside the card. | A code block uses local `overflow-x: auto`. The page does not grow sideways. | [fixtures](public/fixtures/flex-long-text/) · [test](tests/flex-long-text.spec.ts) |
| Text clipped by a fixed-height container (`fixed-height-label`, 390×640) | A one-line height plus `overflow: hidden` clips a multi-line status sentence. | Height follows the text. The next block stays below it. | Intentional truncation with **Show full summary**. The expanded state is tested. A `title` attribute is not the recovery path. | [fixtures](public/fixtures/fixed-height-label/) · [test](tests/fixed-height-label.spec.ts) |
| Fixed footer covers the last button (`fixed-footer-overlap`, 360×500) | After scrolling to the end, a `position: fixed` footer covers **Confirm booking**. | `padding-bottom` reserves the footer height. | The same fixed bar with a matching spacer, which is valid. | [fixtures](public/fixtures/fixed-footer-overlap/) · [test](tests/fixed-footer-overlap.spec.ts) |

Each case lives in `public/fixtures/<id>/{broken,fixed,control}.html`, is listed in `src/cases.ts`, and is covered by `tests/<id>.spec.ts`.

## Propose a case

Have a layout bug that belongs here? Open a [Propose a case](https://github.com/EstebanIndiveri/ui-break-cases/issues/new?template=propose-a-case.yml) issue. A good case is small, reproducible in plain HTML/CSS, and has a fix that keeps the content and the control usable.

## Adapt a test to another component

The assertions are small and geometric. They are written for these fixtures, not as a universal scanner.

Example, from the flex case:

1. Point Playwright at your component instead of `fixtures/flex-long-text/broken.html`.
2. Set the same narrow viewport you care about.
3. Compare the text box (or the action) to the card with a few pixels of tolerance.
4. Keep the original string in the document. A pass that deletes the URL is not a fix.
5. Hit-test the action with `document.elementFromPoint` *before* clicking it.

```ts
const card = await page.locator("#card").boundingBox();
const action = await page.locator("#action").boundingBox();
// action.right <= card.right + 4
```

For clipped text, `Range.getClientRects()` plus the container’s box and `overflow` is enough on a static label. For a fixed footer, scroll to the end first, measure overlap, then call `elementFromPoint` — a click can `scrollIntoView` and hide the bug.

Copy the helper that matches your bug from `tests/helpers.ts`. Do not treat those helpers as production detectors.

## Agent skill (Cursor, Claude Code, Codex)

v0.2 ships an in-repo skill so a coding agent can review a page for these three patterns, skip a **control**, propose a fix that matches the **fixed** fixture, and emit a Playwright test.

- Canonical instructions: [`skill/SKILL.md`](skill/SKILL.md)
- Install per agent, limits, and what was verified locally: [`docs/agent-skill.md`](docs/agent-skill.md)

```bash
npm run verify:skill
```

That command is a deterministic harness (classifier + generated templates on the nine fixtures). It does not run Cursor, Claude Code, or Codex.

Limits, also in the README footer of that doc: **Chromium only**, **these three patterns only**, and **a human must review the agent’s output**.

## What v0.1 checks

- Three cases, nine variants, all load as standalone HTML.
- Broken tests pass by asserting the defect. They are not skipped and not marked as expected failures.
- Fixed tests keep the original copy and check that the control still works.
- Control tests check the intentional behavior, including the expanded summary.
- `npm ci`, `npm run typecheck`, `npm run build`, `npm run preview`, `npm test` (Chromium), `npm run verify:skill`, and `npm run check:pages` are the supported commands.
- The gallery is keyboard-usable and keeps footer iframes at 360×500.
- A CI workflow is included; GitHub Actions is currently disabled, so run the checks locally.

Limitations:

- Chromium only.
- Geometry helpers are fixture-specific.
- No URL scanner, backend, accounts, LLM, MCP, browser extension, npm publish, or extra cases.
- Screenshots are evidence, not the assertion.

## Live demo

**https://estebanindiveri.github.io/ui-break-cases/** — the gallery plus all nine fixtures (broken, fixed and control for each case). Nothing to install.

[Releases](https://github.com/EstebanIndiveri/ui-break-cases/releases)

The site is built from `main` and published on the `gh-pages` branch:

```bash
npm run build:pages
```

The contents of `dist/` are what the `gh-pages` branch serves. `npm run check:pages` serves the same tree locally and asserts HTTP 200 for the gallery, hashed assets, and all nine fixtures.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/adding-a-case.md](docs/adding-a-case.md). Propose a case with the [Propose a case](https://github.com/EstebanIndiveri/ui-break-cases/issues/new?template=propose-a-case.yml) issue form. Open a pull request against `main`. Keep the scope small: one case, three variants, one test file, a gallery entry.

## Related reading

These projects are useful neighbors. ui-break-cases does not replace them.

- [Flexbugs](https://github.com/philipwalton/flexbugs)
- [Pesticide](https://github.com/mrmrs/pesticide)
- [CSS Flexible Box Layout: automatic minimum size](https://www.w3.org/TR/css-flexbox-1/#min-size-auto)
- [Defensive CSS](https://defensivecss.dev)
- [MDN: overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)
- [MDN: position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- [UIJudgeBench](https://pypi.org/project/uijudge-bench/) (`uijudge-bench` on PyPI, v0.4.0 — a benchmark for AI judges of web UI quality)

## License

[MIT](LICENSE)
