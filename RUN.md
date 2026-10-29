# Blind-run-2 layout review

Branch: `blind-run-2` (started at `03b68c443ec816bb9ef1a955e1cd4d54b425b986`).
Chromium via Playwright 1.64.1. Viewport per `set/pages.json`. Pages opened with `page.goto(file:///workspace/set/<file>)`, not through a gallery iframe.

Tolerances used: `GEOM_TOLERANCE_PX = 4`, `CLEAR_DEFECT_PX = 16`.

## Commands

```
git rev-parse HEAD && git branch --show-current && git status
# 03b68c443ec816bb9ef1a955e1cd4d54b425b986
# blind-run-2
# nothing to commit, working tree clean

npm install && npx playwright install --with-deps chromium
# added 3 packages; Chromium 156.0.8078.4 (playwright v1248) installed

node /workspace/_measure.mjs
# geometry dump for all 9 pages (see numbers below)

node /workspace/_measure_label.mjs
# Range.getClientRects for p01/p03/p05 #warning

npx playwright test generated/templates/p01-fixed-height-label.spec.ts
# exit 1 — Error: expect(received).toBe(expected)  Expected false Received true

npx playwright test generated/templates/p06-fixed-footer-overlap.spec.ts
# exit 1 — Error: expect(received).toBeLessThanOrEqual(expected)  Expected <= 4 Received 40

npx playwright test generated/templates/p07-flex-long-text.spec.ts
# exit 1 — Error: expect(received).toBeLessThanOrEqual(expected)  Expected <= 271 Received 491.40625
```

Temporary measure scripts were deleted and not committed.

## Classification

| Page | Viewport | Case | Resembles |
| --- | --- | --- | --- |
| p01.html | 390×640 | fixed-height-label | broken |
| p02.html | 360×500 | fixed-footer-overlap | control |
| p03.html | 390×640 | fixed-height-label | fixed |
| p04.html | 390×640 | flex-long-text | control |
| p05.html | 390×640 | fixed-height-label | control |
| p06.html | 360×500 | fixed-footer-overlap | broken |
| p07.html | 390×640 | flex-long-text | broken |
| p08.html | 360×500 | fixed-footer-overlap | fixed |
| p09.html | 390×640 | flex-long-text | fixed |

Each page matched one of the three cases. No page matched more than one.

## Measured numbers

### p01.html (390×640) — fixed-height-label broken

- `#warning` box: top=36, bottom=60, height=24, overflow=hidden
- `Range.getClientRects()`: 4 rects, bottoms 56 / 80 / 104 / 128
- clippedBottom=**68** (>16), clippedRight=0
- no `[aria-expanded]` node
- `#rest` top=70, bottom=102 (10px below the 24px box; text rects overlap it)
- no flex-row overflow, no fixed footer

### p02.html (360×500) — fixed-footer-overlap control

- `#plank` position=fixed, top=432, height=**68**, bottom=500
- painted `.pad` spacer height=**68** (matches the bar)
- `#board` top=368, bottom=412
- overlapHeight=**0**; action.bottom − footer.top = −20
- `elementFromPoint(180, 390)` → `#board`
- `.sheet` padding-bottom=20px (spacer does the reservation)

### p03.html (390×640) — fixed-height-label fixed

- `#warning` box: top=36, bottom=132, height=96, overflow=visible
- clippedBottom=**0**, clippedRight=0
- `#rest` top=142 (≥ 132 − 4)

### p04.html (390×640) — flex-long-text control

- `#tape` overflow-x=**auto**, scrollWidth=**466**, clientWidth=**176**
- document overflow-x=**0**
- no flex row, no action pushed out of a card
- token lives in a local scroller; page does not grow sideways

### p05.html (390×640) — fixed-height-label control

- `#warning` same clip as p01: height=24, overflow=hidden, clippedBottom=**68**
- painted `#widen` button 306×30, `aria-expanded=false`, display=block
- control wins over a false broken match for this case

### p06.html (360×500) — fixed-footer-overlap broken

- `#plank` position=fixed, top=432, height=68
- no matching spacer
- `.sheet` padding-bottom=**28px**
- `#board` top=428, bottom=472
- overlapHeight=**40** (>16); action.bottom − footer.top = 40
- `elementFromPoint(180, 450)` → `#plank` (not `#board`)

### p07.html (390×640) — flex-long-text broken

- `#rack` flex row, width=232, right=267
- `#callsign` white-space=nowrap, right=**491.40625**, overflowPx=**224.41**
- `#cue` left=499.41, right=**555.64** (outside card and viewport 390)
- isClearFlexOverflow=true (overflow > 16 and actionRight > cardRight + 16)
- document overflow-x=**166**
- `elementFromPoint` at action center → null (outside viewport)
- no local overflow-x auto/scroll scroller

### p08.html (360×500) — fixed-footer-overlap fixed

- `#plank` position=fixed, top=432, height=68
- `.sheet` padding-bottom=**104px**
- `#board` top=352, bottom=396
- overlapHeight=**0**; action.bottom − footer.top = −36
- `elementFromPoint(180, 374)` → `#board`

### p09.html (390×640) — flex-long-text fixed

- `#rack` width=232, right=267
- `#callsign` overflow-wrap=anywhere, right=**192.77** (inside card)
- `#cue` right=**257** (inside card)
- overflowPx=**0**, document overflow-x=**0**
- `elementFromPoint(228.88, 111.59)` → `#cue`

## Generated specs (broken pages only)

Copied `skill/templates/<id>.spec.ts` and `skill/lib/geometry.ts` into `generated/`.
`TARGET.url` is `file:///workspace/set/p0{1,6,7}.html`. Selectors and copy taken from the live DOM.

### p01 spec output (verbatim)

```
Running 1 test using 1 worker

(node:3830) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✘  1 [chromium] › generated/templates/p01-fixed-height-label.spec.ts:30:1 › fixed-height-label healthy: full sentence paints and the next block is clear (134ms)


  1) [chromium] › generated/templates/p01-fixed-height-label.spec.ts:30:1 › fixed-height-label healthy: full sentence paints and the next block is clear 

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
        at /workspace/generated/templates/p01-fixed-height-label.spec.ts:43:34

    Error Context: test-results/generated-templates-p01-fi-c2959-and-the-next-block-is-clear-chromium/error-context.md

  1 failed
    [chromium] › generated/templates/p01-fixed-height-label.spec.ts:30:1 › fixed-height-label healthy: full sentence paints and the next block is clear 
```

### p06 spec output (verbatim)

```
Running 1 test using 1 worker

(node:3623) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✘  1 [chromium] › generated/templates/p06-fixed-footer-overlap.spec.ts:43:1 › fixed-footer-overlap healthy: last action stays above the footer and is hittable (205ms)


  1) [chromium] › generated/templates/p06-fixed-footer-overlap.spec.ts:43:1 › fixed-footer-overlap healthy: last action stays above the footer and is hittable 

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 4
    Received:    40

      63 |   expect(position).toBe("fixed");
      64 |   // 4px slack — GEOM_TOLERANCE_PX
    > 65 |   expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
         |                                         ^
      66 |   expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
      67 |   expectInViewport(action, TARGET.viewport);
      68 |   expect(hit.hit?.id).toBe(actionId());
        at /workspace/generated/templates/p06-fixed-footer-overlap.spec.ts:65:41

    Error Context: test-results/generated-templates-p06-fi-c8400--the-footer-and-is-hittable-chromium/error-context.md

  1 failed
    [chromium] › generated/templates/p06-fixed-footer-overlap.spec.ts:43:1 › fixed-footer-overlap healthy: last action stays above the footer and is hittable 
```

### p07 spec output (verbatim)

```
Running 1 test using 1 worker

(node:3624) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✘  1 [chromium] › generated/templates/p07-flex-long-text.spec.ts:38:1 › flex-long-text healthy: token stays in the card and the action is hittable (183ms)


  1) [chromium] › generated/templates/p07-flex-long-text.spec.ts:38:1 › flex-long-text healthy: token stays in the card and the action is hittable 

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 271
    Received:    491.40625

       at generated/lib/geometry.ts:244

      242 | ): void {
      243 |   expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
    > 244 |   expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
          |                       ^
      245 |   expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance);
      246 |   expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance);
      247 | }
        at expectInside (/workspace/generated/lib/geometry.ts:244:23)
        at /workspace/generated/templates/p07-flex-long-text.spec.ts:55:3

    Error Context: test-results/generated-templates-p07-fl-9fd5a--and-the-action-is-hittable-chromium/error-context.md

  1 failed
    [chromium] › generated/templates/p07-flex-long-text.spec.ts:38:1 › flex-long-text healthy: token stays in the card and the action is hittable 
```
