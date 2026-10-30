# Layout review

Review every HTML page listed in `pages.json` in `set/`.

For each page:

1. Open the HTML file directly (not inside a gallery iframe). Use the viewport in `pages.json`.
2. Confirm layout with geometry: bounding boxes, `Range.getClientRects()` for clipped text, and `document.elementFromPoint` at a control’s center **before** any click.
3. Decide whether the page matches `flex-long-text`, `fixed-height-label`, and/or `fixed-footer-overlap`. A page may match more than one case. Report every match. A control for one case does not cancel a bug in another case.
4. For each match, classify `broken`, `fixed`, or `control`.
5. If a match is **broken**, propose a CSS/markup fix that keeps the original text and keeps the control usable, and emit a Playwright test from `skill/templates/<id>.spec.ts` plus `skill/lib/geometry.ts` pointed at that page’s URL (`page.goto(TARGET.url)`). The test must fail on the broken page via `expect(received)` and would pass on a healthy layout.
6. If a match is **fixed** or **control**, report no bug for that case and do not change CSS.

Tolerances: 4px slack, 16px defect. Chromium only. Human review required.

Do not infer the answer from filenames. Filenames are random.

Write JSON to `results.json` with this shape:

```json
{
  "p01.html": {
    "matches": [
      {
        "caseId": "flex-long-text | fixed-height-label | fixed-footer-overlap",
        "resembles": "broken | fixed | control",
        "bug": true,
        "fix": "css or null",
        "specOutput": "full captured Playwright stdout/stderr, or null",
        "notes": "short geometry notes"
      }
    ]
  }
}
```

Use `bug: true` only when `resembles` is `"broken"`. Do not report two different `resembles` / `bug` values for the same `caseId` on one page.

For a **broken** match, `specOutput` must be the Playwright stdout/stderr of the generated spec against that page, **self-reported by the agent; the scorer does not re-run specs**. Capture it with `NO_COLOR=1` so the log has no ANSI color codes:

```bash
NO_COLOR=1 npx playwright test path/to/generated.spec.ts
```

The scorer strips ANSI if color leaks through. It requires a Playwright `N failed` summary with no `N passed`, plus an `Error: expect(received)` block that includes `Expected:` / `Received:` lines and an `at file:line` frame. Timeouts, `Test timeout of Nms`, and `Rejected to value` are rejected. A boolean flag is not a substitute. Do not add fields this schema does not define (`specFailedViaExpect`, page-level `specOutput`, `spec`, …).
