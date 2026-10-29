# fixed-footer-overlap

Manifest: `src/cases.ts` id `fixed-footer-overlap`. Viewport **360×500**. Shared copy is the last-action label `Confirm booking`.

## Symptom

A short viewport plus `position: fixed` footer leaves the last action under the bar **even after scrolling to the end of the document**. The control cannot receive a hit at its center.

## Geometry confirmation

Open the page directly. Set the viewport to 360×500.

1. **Scroll to the document end first.** Do not click the last button yet — a click may `scrollIntoView` and hide the overlap.
2. `boundingRect` on the last action (`#last-action`) and the footer (`#site-footer`).
3. Footer `position` is `fixed`.
4. `overlapHeight(action, footer) > CLEAR_DEFECT_PX` (16) is the defect. Healthy overlap is ≤ `GEOM_TOLERANCE_PX` (4), and `action.bottom <= footer.top + 4`.
5. `hitTestCenter("#last-action")` **before** any click. Broken: `elementFromPoint` hits the footer. Fixed/control: it hits the action.
6. The action should remain in the viewport once space is reserved.
7. Only then `clickCenter` to prove the control still works.

## Which variant it resembles

| Resembles | When | Bug? |
| --- | --- | --- |
| **broken** | At max scroll, overlap > 16px and the hit-test hits the footer. | Yes |
| **fixed** | Reserved space (fixture: `main { padding-bottom: 88px; } /* footer is 72px */`). Overlap ≤ 4px; hit-test hits the action. | No |
| **control** | The same fixed bar with a **painted** matching spacer (fixture: `.spacer { height: 72px; }`). Hit-test hits the action. A spacer that is `display: none` is not a control. | No — do not fix |

A fixed bar is not automatically a bug. If a spacer or padding equal to the footer height keeps the last control clear, report no bug.

## Fix (only if broken)

Match `public/fixtures/fixed-footer-overlap/fixed.html`:

```css
main { padding-bottom: 88px; } /* footer is 72px */
```

An equivalent spacer at the end of the document is also acceptable (that is how the control variant reserves space). Keep the last action enabled and labeled. Do not `display: none` the footer to “fix” the overlap.

## Test

Copy `skill/templates/fixed-footer-overlap.spec.ts` and `skill/lib/geometry.ts`. Set `TARGET.url`. The generated test must fail on the broken layout via `expect` and pass on the fixed layout. Always scroll to the end and hit-test before clicking.
