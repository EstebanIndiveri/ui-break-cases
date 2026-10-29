# Blind-run layout review

Chromium via Playwright 1.64.1. Viewports from `set/pages.json`. Pages opened directly as `file:///workspace/set/<file>` (not in a gallery iframe). Geometry from `skill/lib/geometry.ts` (`GEOM_TOLERANCE_PX=4`, `CLEAR_DEFECT_PX=16`). Hit-tests used `document.elementFromPoint` at the control center before any click. Footer pages were scrolled to document end before measuring.

## Commands

```bash
node -v
# v22.23.4

npm install
# added 3 packages (playwright 1.64.1)

npx playwright install --with-deps chromium
# Chrome for Testing 156.0.8078.4

node /workspace/measure-pages.mjs
# measurement script (not committed); JSON dump of boxes / clips / hit-tests
# exit 0

npx playwright test tests/p02-flex-long-text.spec.ts \
  tests/p04-fixed-height-label.spec.ts \
  tests/p09-fixed-footer-overlap.spec.ts --reporter=list
# 3 failed, all via expect() (not timeout/crash); see raw output below

# Sanity only (not committed): same specs pointed at the fixed variants
npx playwright test .tmp-healthy --reporter=list
# 3 passed (p07 flex, p05 label, p01 footer)
```

`skill/cases/` was not present on this branch; classification used `skill/SKILL.md` plus measured geometry.

## Classification

| Page | Case | Resembles | Bug |
| --- | --- | --- | --- |
| p01.html | fixed-footer-overlap | fixed | no |
| p02.html | flex-long-text | broken | yes |
| p03.html | flex-long-text | control | no |
| p04.html | fixed-height-label | broken | yes |
| p05.html | fixed-height-label | fixed | no |
| p06.html | fixed-footer-overlap | control | no |
| p07.html | flex-long-text | fixed | no |
| p08.html | fixed-height-label | control | no |
| p09.html | fixed-footer-overlap | broken | yes |

Each page matched one case. No page matched a second case.

## Measured numbers per page

### p01.html (360×500) — fixed-footer-overlap / fixed

After `scrollToDocumentEnd`:

- `#last-action`: `{top:368, bottom:412, left:16, right:344, width:328, height:44}`
- `#site-footer`: `{top:428, bottom:500, height:72, position:fixed}`
- `overlapHeight` = 0px
- action.bottom − footer.top = −16px
- `elementFromPoint(action center)` → `{id: last-action, tag: button}`
- `.spacer` not present
- `main` padding-bottom `88px`

### p02.html (390×640) — flex-long-text / broken

- `#card`: `{left:16, right:268, width:252, height:90, display:flex, overflowX:visible}`
- `#long-text`: `{left:33, right:306.015625, width:273.02}` — overflows card by **38.02px**
- `#action`: `{left:318.02, right:385.03, width:67.02}` — overflows card by **117.03px**
- `isClearFlexOverflow` true (overflow and action-past-card both > 16px)
- `documentHorizontalOverflow` = 0px
- `elementFromPoint(action center)` → `{id: action}` (still painted; defect is leaving the card)

Healthy spec failed: `expectInside(text, card)` → `expect(inner.right).toBeLessThanOrEqual(272)` received `306.015625`.

### p03.html (390×640) — flex-long-text / control

- `#code-block`: overflow-x `auto`, `{width:220, scrollWidth:298, clientWidth:220}`
- local scroll: scrollWidth > clientWidth
- `documentHorizontalOverflow` = 0px (page does not grow sideways)

### p04.html (390×640) — fixed-height-label / broken

- `#label` overflow `hidden`, box `{top:69, bottom:93, height:24}`
- Range rects: bottoms 92, 116, 140 → `clippedBottom` = **47px** (> 16), `clippedRight` = 0
- no `#expand-toggle`; `title` null
- `#next-content` `{top:109, bottom:160}` sits below the clipped box (bottom 93)

Healthy spec failed: `expect(overflowIsHidden(clip)).toBe(false)` received `true`.

### p05.html (390×640) — fixed-height-label / fixed

- `#label` overflow `visible`, box `{top:69, bottom:141, height:72}`
- `clippedBottom` = 0, `clippedRight` = 0
- `#next-content` top 157 ≥ label bottom 141

### p06.html (360×500) — fixed-footer-overlap / control

After `scrollToDocumentEnd`:

- `#last-action`: `{top:368, bottom:412}`
- `#site-footer`: `{top:428, height:72, position:fixed}`
- `.spacer`: painted, `{height:72, width:360}` matches footer height
- `overlapHeight` = 0px
- `elementFromPoint(action center)` → `{id: last-action}`

### p07.html (390×640) — flex-long-text / fixed

- `#card`: `{left:16, right:268, width:252}`
- `#long-text`: `{left:33, right:171.98}` overflow 0px (`overflow-wrap: anywhere`)
- `#action`: `{left:183.98, right:251}` overflow 0px
- `elementFromPoint(action center)` → `{id: action}`

### p08.html (390×640) — fixed-height-label / control

- `#label` overflow `hidden`, `clippedBottom` = 47px (same clip as the broken label)
- `#expand-toggle` painted: `{width:179.31, height:40, display:inline-block, visibility:visible, aria-expanded:false}`

### p09.html (360×500) — fixed-footer-overlap / broken

After `scrollToDocumentEnd`:

- `#last-action`: `{top:416, bottom:460}`
- `#site-footer`: `{top:428, bottom:500, height:72, position:fixed}`
- `overlapHeight` = **32px** (> 16)
- `elementFromPoint(action center)` → `{id: site-footer, tag: footer}`
- `main` padding-bottom `40px`; no spacer

Healthy spec failed: `expect(overlapHeight(action, footer)).toBeLessThanOrEqual(4)` received `32`.

## Raw Playwright output (broken pages)

```
Running 3 tests using 1 worker

  ✘  1 [chromium] › tests/p02-flex-long-text.spec.ts:38:1 › flex-long-text healthy: token stays in the card and the action is hittable (168ms)
  ✘  2 [chromium] › tests/p04-fixed-height-label.spec.ts:30:1 › fixed-height-label healthy: full sentence paints and the next block is clear (125ms)
  ✘  3 [chromium] › tests/p09-fixed-footer-overlap.spec.ts:43:1 › fixed-footer-overlap healthy: last action stays above the footer and is hittable (159ms)


  1) [chromium] › tests/p02-flex-long-text.spec.ts:38:1 › flex-long-text healthy: token stays in the card and the action is hittable

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 272
    Received:    306.015625

       at lib/geometry.ts:244

      242 | ): void {
      243 |   expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
    > 244 |   expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
          |                       ^
      245 |   expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance);
      246 |   expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance);
      247 | }
        at expectInside (/workspace/lib/geometry.ts:244:23)
        at /workspace/tests/p02-flex-long-text.spec.ts:55:3

  2) [chromium] › tests/p04-fixed-height-label.spec.ts:30:1 › fixed-height-label healthy: full sentence paints and the next block is clear

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      41 |
      42 |   const clip = await textRangeClip(page, TARGET.selectors.label);
    > 43 |   expect(overflowIsHidden(clip)).toBe(false);
         |                                  ^
      44 |   // 4px slack — GEOM_TOLERANCE_PX
      45 |   expect(clip.clippedBottom).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
      46 |   expect(clip.clippedRight).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
        at /workspace/tests/p04-fixed-height-label.spec.ts:43:34

  3) [chromium] › tests/p09-fixed-footer-overlap.spec.ts:43:1 › fixed-footer-overlap healthy: last action stays above the footer and is hittable

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 4
    Received:    32

      63 |   expect(position).toBe("fixed");
      64 |   // 4px slack — GEOM_TOLERANCE_PX
    > 65 |   expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
         |                                         ^
      66 |   expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
      67 |   expectInViewport(action, TARGET.viewport);
      68 |   expect(hit.hit?.id).toBe(actionId());
        at /workspace/tests/p09-fixed-footer-overlap.spec.ts:65:41

  3 failed
```

Durations on the worker lines are from this run; assertion values are the measured geometry.

## Proposed fixes (broken only; not applied)

- p02.html: `.body { min-width: 0; } #long-text { overflow-wrap: anywhere; }`
- p04.html: `#label { height: auto; overflow: visible; }`
- p09.html: `main { padding-bottom: 88px; }`
