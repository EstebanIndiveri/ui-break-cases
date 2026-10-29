# flex-long-text

Manifest: `src/cases.ts` id `flex-long-text`. Viewport **390×640**. Shared copy is the unbreakable URL `https://api.example.test/evt_9f3c2a`.

## Symptom

A flex row holds a label, an unbreakable URL (or similar token), and an action. The text column keeps `min-width: auto`, so it will not shrink below the token’s max-content width. The token overflows the card and the action is pushed out.

## Geometry confirmation

Open the page directly (not a gallery iframe). Set the viewport to 390×640.

1. Confirm the token string is still in the document (`#long-text` on the fixtures).
2. `boundingRect` on the card (`#card`), the token (`#long-text`), and the action (`#action`).
3. `horizontalOverflow(token, card)` and `horizontalOverflow(action, card)`. A defect is `> CLEAR_DEFECT_PX` (16). Slack for “inside” is `GEOM_TOLERANCE_PX` (4).
4. The action may still be inside the **viewport** even when it is outside the card — that is still the bug.
5. Before clicking Copy, `hitTestCenter("#action")`. Then `clickCenter` on that point; do not use `locator.click()`.

## Which variant it resembles

| Resembles | When | Bug? |
| --- | --- | --- |
| **broken** | Card row overflows by more than 16px; action’s right edge is past the card by more than 16px. | Yes |
| **fixed** | Token and action sit inside the card (4px slack); `elementFromPoint` at the action center hits the action. | No |
| **control** | Computed `overflow-x` on the code block is `auto` or `scroll`, `scrollWidth` exceeds `clientWidth` by more than 16px, and `documentHorizontalOverflow` is ≤ 4px. `overflow-x: visible` is not a control. | No — do not fix |

If you see a horizontal scrollbar on a `<pre>`/`<code>` and the page width is stable, that is the control. Wrapping the token or adding `min-width: 0` there would be a mistaken fix.

## Fix (only if broken)

Match `public/fixtures/flex-long-text/fixed.html`:

```css
.body { flex: 1 1 auto; min-width: 0; }
#long-text { overflow-wrap: anywhere; }
```

Keep the full URL. Do not truncate with ellipsis, hide overflow on the card, or shrink the font until it is unreadable.

## Test

Copy `skill/templates/flex-long-text.spec.ts` and `skill/lib/geometry.ts`. Set `TARGET.url` to the page under review (`page.goto(TARGET.url)`). The generated test must fail on the broken layout via `expect` and pass on the fixed layout.
