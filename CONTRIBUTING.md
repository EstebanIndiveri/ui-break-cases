# Contributing

Keep a change small enough that someone can read the HTML, the CSS, and the test in one sitting.

## Propose a case

Use the [Propose a case](https://github.com/EstebanIndiveri/ui-break-cases/issues/new?template=propose-a-case.yml) issue form.

To add a case yourself, follow [docs/adding-a-case.md](docs/adding-a-case.md): three standalone fixtures (broken, fixed, control), a Playwright test, and a gallery entry.

## Local checks

GitHub Actions is currently disabled, so run the checks locally:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run verify:skill
npm run check:pages
```

`npm test` uses Playwright’s Chromium browser. Install it with `npx playwright install chromium`.
