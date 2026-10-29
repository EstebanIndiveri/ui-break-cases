# Temp-project install proof

Date: 2026-10-29.

This is not a Cursor/Claude/Codex session. It proves the **portable templates** run in a directory that has no `src/cases.ts`, no `tests/helpers.ts`, and no `public/fixtures` tree.

## Commands

```bash
TMP=$(mktemp -d /tmp/ubc-skill-install-XXXX)
mkdir -p "$TMP/skill/lib" "$TMP/skill/templates" "$TMP/page"
cp skill/lib/geometry.ts "$TMP/skill/lib/"
cp skill/templates/flex-long-text.spec.ts "$TMP/skill/templates/"
cp public/fixtures/flex-long-text/fixed.html "$TMP/page/fixed.html"
cp public/fixtures/flex-long-text/broken.html "$TMP/page/broken.html"
# package.json with @playwright/test@1.64.1 and a playwright.config.ts
# whose testDir is ./skill/templates. No webServer.
cd "$TMP"
npm install
npx playwright install chromium
UI_BREAK_TARGET_URL="file://$TMP/page/fixed.html" npx playwright test
UI_BREAK_TARGET_URL="file://$TMP/page/broken.html" npx playwright test
```

The actual directory this run used: `/tmp/ubc-skill-install-NO1G`.

The temp project contained only:

- `skill/lib/geometry.ts`
- `skill/templates/flex-long-text.spec.ts`
- two standalone HTML files under `page/`
- `package.json` / `playwright.config.ts` / `node_modules`

It did **not** contain `src/`, `tests/`, or `public/fixtures/`.

## Results

| TARGET.url | Exit | What failed / passed |
| --- | --- | --- |
| `file://…/page/fixed.html` | 0 | `1 passed` — token inside the card, Copy hittable |
| `file://…/page/broken.html` | 1 | `Error: expect(received).toBeLessThanOrEqual(expected)` Expected `<= 272`, Received `306.015625` at `expectInside` in `skill/lib/geometry.ts` |

The broken run failed on an `expect` assertion, not an import error or crash.
