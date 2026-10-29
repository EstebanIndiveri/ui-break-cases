# Cursor run — nine fixtures

Date: 2026-10-29.

## Honesty

This run is the same Cursor cloud agent that implemented the v0.2 skill PR ([run](https://cursor.com/agents/bc-d0bac5f6-f888-53ef-afb6-779c81254b0f)), **not** a separate end-user chat and **not** the mechanical classifier acting as a stand-in.

What was actually executed:

1. Read `skill/SKILL.md` and `skill/cases/<id>.md`.
2. Opened each fixture HTML directly at `http://127.0.0.1:4173/fixtures/<id>/<variant>.html` (Vite preview of `dist/`, Chromium via Playwright). Did not use gallery iframes.
3. Measured geometry with the helpers in `skill/lib/geometry.ts` (`boundingRect`, `textRangeClip`, `hitTestCenter`, `scrollToDocumentEnd`, `computedOverflowX`, `isPainted`).
4. Classified broken / fixed / control from those numbers and the skill rules.
5. For each **broken** fixture, proposed the CSS delta below and pointed `skill/templates/<id>.spec.ts` at the fixture URL (`page.goto(TARGET.url)`).
6. Ran that generated test against broken (must fail on `expect`) and against the matching fixed page (must pass).
7. For **fixed** and **control**, reported no bug and did not change CSS.

Claude Code and Codex were **not** run.

## Prompt (same for every fixture)

```
Review this page for the three ui-break-cases layout bugs.
Follow skill/SKILL.md and skill/cases/.
Open TARGET.url directly. Confirm with geometry (bounding boxes,
Range.getClientRects, elementFromPoint before any click).
Classify broken / fixed / control. Control wins over a false broken match.
If broken: propose a fix equivalent to that case's fixed variant
(keep the original copy; keep the control usable) and emit a Playwright
test from skill/templates that fails on broken via expect() and passes
on fixed. If fixed or control: report no bug and do not change CSS.
Chromium only. Human review required.
```

Model: **Cursor Grok 4.6** (Cursor cloud agent).

Viewport: flex and label 390×640; footer 360×500. Tolerances: `GEOM_TOLERANCE_PX = 4`, `CLEAR_DEFECT_PX = 16`.

Generated-test command (example):

```bash
UI_BREAK_TARGET_URL=http://127.0.0.1:4173/fixtures/<id>/<variant>.html \
  npx playwright test -c playwright.skill.config.ts skill/templates/<id>.spec.ts --reporter=list
```

That is the template with `TARGET.url` set. The template already uses `openPage` → `page.goto(TARGET.url)` and imports `skill/lib/geometry.ts` only.

---

## 1. flex-long-text / broken

- **URL:** `http://127.0.0.1:4173/fixtures/flex-long-text/broken.html`
- **Case flagged:** `flex-long-text`, resembles **broken**, bug=yes
- **Geometry:** card right 268px; token right 306.0px; action right 385.0px; overflow 117.0px (> 16). Action still inside the 390px viewport. Token string still `https://api.example.test/evt_9f3c2a`.
- **Fix (equivalent to fixed.html):**

```diff
 .body {
   flex: 1 1 auto;
+  min-width: 0;
 }
 #long-text {
   ...
+  overflow-wrap: anywhere;
 }
```

  Same as `public/fixtures/flex-long-text/fixed.html`. Keeps the full URL; does not ellipsize or shrink the font.
- **Generated test:** broken → `Error: expect(received).toBeLessThanOrEqual(expected)` Expected `<= 272` Received `306.015625` (`expectInside` on the token vs card). fixed → **1 passed**.

## 2. flex-long-text / fixed

- **URL:** `http://127.0.0.1:4173/fixtures/flex-long-text/fixed.html`
- **Case flagged:** `flex-long-text`, resembles **fixed**, **no bug**
- **Geometry:** overflow 0; action right 251 ≤ card right 268; `elementFromPoint` hits `#action`.
- **Fix:** none.

## 3. flex-long-text / control

- **URL:** `http://127.0.0.1:4173/fixtures/flex-long-text/control.html`
- **Case flagged:** `flex-long-text`, resembles **control**, **no bug**
- **Geometry:** computed `overflow-x: auto` on `#code-block`; scrollWidth 298 − clientWidth 220 = 78px local scroll; page overflow 0.
- **Fix:** none. Wrapping the token here would be a mistaken fix.

## 4. fixed-height-label / broken

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-height-label/broken.html`
- **Case flagged:** `fixed-height-label`, resembles **broken**, bug=yes
- **Geometry:** 3 client rects; overflow hidden; clippedBottom 47px (> 16); expand control not painted.
- **Fix (equivalent to fixed.html):**

```diff
 #label {
-  height: 24px;
-  overflow: hidden;
+  height: auto;
+  overflow: visible;
 }
```

  Keeps the full sentence. Does not add `title`.
- **Generated test:** broken → `Error: expect(received).toBe(expected)` Expected `false` Received `true` (`overflowIsHidden`). fixed → **1 passed**.

## 5. fixed-height-label / fixed

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-height-label/fixed.html`
- **Case flagged:** `fixed-height-label`, resembles **fixed**, **no bug**
- **Geometry:** overflow visible; clippedBottom 0; next block top 190 ≥ label bottom 174.
- **Fix:** none.

## 6. fixed-height-label / control

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-height-label/control.html`
- **Case flagged:** `fixed-height-label`, resembles **control**, **no bug**
- **Geometry:** clippedBottom 47px with hidden overflow **and** `#expand-toggle` painted (`aria-expanded="false"`).
- **Fix:** none.

## 7. fixed-footer-overlap / broken

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-footer-overlap/broken.html`
- **Case flagged:** `fixed-footer-overlap`, resembles **broken**, bug=yes
- **Geometry (after scroll-to-end):** footer `position: fixed`; overlap 32px (> 16); `elementFromPoint` at the action center hits `#site-footer`.
- **Fix (equivalent to fixed.html):**

```diff
 main {
-  padding: 16px 16px 40px;
+  padding: 16px 16px 88px; /* footer is 72px */
 }
```

  Keeps “Confirm booking”. Does not hide the footer.
- **Generated test:** broken → `Error: expect(received).toBeLessThanOrEqual(expected)` Expected `<= 4` Received `32` (`overlapHeight`). fixed → **1 passed**.

## 8. fixed-footer-overlap / fixed

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-footer-overlap/fixed.html`
- **Case flagged:** `fixed-footer-overlap`, resembles **fixed**, **no bug**
- **Geometry:** overlap 0; action bottom 412 ≤ footer top 428; hit-test hits `#last-action`.
- **Fix:** none.

## 9. fixed-footer-overlap / control

- **URL:** `http://127.0.0.1:4173/fixtures/fixed-footer-overlap/control.html`
- **Case flagged:** `fixed-footer-overlap`, resembles **control**, **no bug**
- **Geometry:** painted `.spacer` height 72px matching the footer; overlap 0; hit-test hits `#last-action`.
- **Fix:** none. A fixed bar with a matching spacer is valid.

---

## Summary

| Fixture | Case | Bug? | Fix proposed? | Generated test |
| --- | --- | --- | --- | --- |
| flex-long-text broken | flex-long-text | yes | min-width:0 + overflow-wrap | FAIL via expect; PASS on fixed |
| flex-long-text fixed | flex-long-text | no | no | — |
| flex-long-text control | flex-long-text | no | no | — |
| fixed-height-label broken | fixed-height-label | yes | height:auto; overflow:visible | FAIL via expect; PASS on fixed |
| fixed-height-label fixed | fixed-height-label | no | no | — |
| fixed-height-label control | fixed-height-label | no | no | — |
| fixed-footer-overlap broken | fixed-footer-overlap | yes | padding-bottom 88px | FAIL via expect; PASS on fixed |
| fixed-footer-overlap fixed | fixed-footer-overlap | no | no | — |
| fixed-footer-overlap control | fixed-footer-overlap | no | no | — |

## Errata

Written after the run. The block above is the historical prompt and notes as recorded.

1. **Prompt, control-wins.** The run used “Control wins over a false broken match.” The skill now requires reporting every matching case; control wins over a false broken match **for the same case only**.
2. **flex-long-text / broken geometry.** The notes rounded subpixels. Chromium measured token right **306.015625px**, action right **385.03125px**, overflow **117.03125px**, not 306.0 / 385.0 / 117.0. The generated-test line below that section already recorded `Received 306.015625`.
