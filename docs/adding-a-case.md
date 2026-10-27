# Adding a case

Keep a case small enough that someone can read the HTML, the CSS, and the test in one sitting.

## 1. Pick a defect you can measure

Write the reproduction in one sentence: viewport, content, and the layout rule that fails. If you cannot say how a test will observe the defect without `toBeVisible()`, the case is not ready.

## 2. Add three standalone fixtures

Create `public/fixtures/<id>/broken.html`, `fixed.html`, and `control.html`.

- Each file must open on a static server with no gallery CSS or JS.
- Broken, fixed, and control should share the same copy.
- The fix must keep the text and the control. Do not delete content, clip it without a recovery path, or shrink the font until it is unreadable.
- The control must be a legitimate design (local scroll, explicit expand, reserved space for a fixed bar). `title` alone is not a control.

## 3. Register it in the manifest

Add an entry to `src/cases.ts` with:

- `id`, `title`
- `failureDescription`
- `reproductionCondition`
- `viewport`
- variant `path`s and `expectedBehavior`
- `provenance` (`original` or `inspired`, plus a short note)
- `links`, `knownLimitations`
- `testFile` and `sourceDirectory`

The gallery reads this object. There is no plugin API.

## 4. Write Playwright tests

Add `tests/<id>.spec.ts`. Navigate to the fixture path with the declared viewport.

- Broken: assert the defect exists. The test should pass.
- Fixed: assert the defect is gone and the shared content is still there.
- Control: assert the intentional behavior, including expanded or scrolled states.

Use a small explicit tolerance (this repo uses 4px) and a defect clearly larger than that (16px+). Do not skip broken tests and do not mark them as expected failures.

Footer-style cases: scroll to the end, measure, then `elementFromPoint`. Do not click first.

## 5. Check the gallery

`npm run dev` should list the new case. Confirm:

- Variant tabs update the iframe `src`
- The iframe size matches the viewport
- For short-viewport cases, the iframe does not grow to the content height
- “Open fixture” works on the production preview, including a GitHub Pages base if you set `VITE_BASE`

## 6. Capture evidence

Run `npm test` and keep a screenshot of the broken variant next to the fixed one. The suite writes PNG files to `artifacts/screenshots/`.
