# fixed-height-label

Manifest: `src/cases.ts` id `fixed-height-label`. Viewport **390×640**. Shared copy is the status sentence in `CLIP_LABEL_TEXT`.

## Symptom

A sentence that now wraps is stuck in a one-line-tall box with `overflow: hidden`. Part of the sentence is clipped. Nothing on the page reveals the rest (no expand control). A `title` tooltip is not recovery.

## Geometry confirmation

Open the page directly. Set the viewport to 390×640.

1. Confirm the full sentence is still in the DOM (`#label` on the fixtures), even if it is visually clipped.
2. `textRangeClip("#label")` — `Range.getClientRects()` plus the element box and computed overflow.
3. Broken: more than one client rect, overflow is `hidden` or `clip`, `clippedBottom > CLEAR_DEFECT_PX` (16).
4. Check for an explicit expand control (`#expand-toggle` on the fixtures, `aria-expanded`). Absence of that control is part of the broken diagnosis.
5. Fixed: overflow is not hidden, `clippedBottom` and `clippedRight` are ≤ `GEOM_TOLERANCE_PX` (4), and the next block (`#next-content`) starts at or below the label (`next.top >= label.bottom - 4`).

Do not use `toBeVisible()` as the only check. Visibility can pass while glyphs are clipped.

## Which variant it resembles

| Resembles | When | Bug? |
| --- | --- | --- |
| **broken** | Text rects overflow a hidden box by more than 16px, and there is no expand control. | Yes |
| **fixed** | Full sentence paints; rects stay inside the label; following content does not overlap. | No |
| **control** | Collapsed state is clipped **and** a **painted** expand control is present (`aria-expanded`). `display: none` on the toggle is not a control. Expanding reveals the sentence. No `title` attribute as the recovery path. | No — do not fix |

If the clip is intentional **and** a real control restores the text, report no bug.

## Fix (only if broken)

Match `public/fixtures/fixed-height-label/fixed.html`:

```css
#label { height: auto; overflow: visible; }
```

Keep the full sentence. Do not rely on `-webkit-line-clamp` with no expand path. Do not add `title` instead of showing the text.

## Test

Copy `skill/templates/fixed-height-label.spec.ts` and `skill/lib/geometry.ts`. Set `TARGET.url`. The generated test must fail on the broken layout via `expect` and pass on the fixed layout.
