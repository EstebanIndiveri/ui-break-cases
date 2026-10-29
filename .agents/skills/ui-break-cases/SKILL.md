---
name: ui-break-cases
description: Review a UI for the three layout bugs in ui-break-cases (flex min-width overflow, fixed-height clipping, fixed-footer overlap). Confirm with geometry, classify broken vs fixed vs control, propose a fix that matches the fixed variant, and emit a Playwright test. Use when asked to find these CSS bugs, adapt the fixtures, or generate a Playwright geometry test.
---

# ui-break-cases agent skill

You review a page for **only** the three patterns in this package. You are not a general layout scanner.

Chromium only. Output must be reviewed by a human before it is merged.

This file is the source of truth. Identical copies live at `.agents/skills/ui-break-cases/SKILL.md` (Cursor and Codex) and `skill/install/claude.SKILL.md` (paste into `.claude/skills/ui-break-cases/SKILL.md` for Claude Code). Do not keep a second skill under `.cursor/skills` or `.claude/skills` in this repo — Cursor would load it twice.

## Workflow

1. Identify the target URL, the viewport, and the relevant selectors.
2. Read the matching file in `skill/cases/` if it is available.
3. Confirm the symptom with geometry. Do not trust a screenshot alone. Do not click a control until after `elementFromPoint` (a locator click can `scrollIntoView` and hide the bug).
4. Classify what the target **resembles**: `broken`, `fixed`, or `control`.
5. If it resembles **control**, report **no bug** and stop. Do not “fix” a valid design.
6. If it resembles **fixed**, report **no bug** (already healthy). Do not restyle it.
7. If it resembles **broken**, propose a fix equivalent to that case’s `fixed` variant: keep the original copy and keep the control usable. Do not delete content, truncate with an ellipsis, shrink the font until it is unreadable, or use `title` as the recovery path.
8. Emit a Playwright test by copying `skill/templates/<id>.spec.ts` and `skill/lib/geometry.ts`. Point `TARGET.url` at the page under review (`page.goto(TARGET.url)`). That test must **fail on the broken page and pass on the fixed page** via an `expect` assertion, not a crash.

## Tolerances

Use the constants in `skill/lib/geometry.ts` (copied into the generated test). Do not invent other slacks.

- `GEOM_TOLERANCE_PX = 4` — allowed slack for “inside”, “no overlap”, “no clip”.
- `CLEAR_DEFECT_PX = 16` — a real defect must exceed this so a 1px font difference cannot flip the result.

Every pixel threshold in a generated test must be one of those constants or carry a comment. The 4–16px band is unclassified: do not call it broken.

## Geometry toolbox

Copy helpers from `skill/lib/geometry.ts`. They are for these patterns, not production detectors. That file must not import from `../../src` or `../../tests`.

| Need | Helper / API |
| --- | --- |
| Open the page | `openPage` → `page.goto(TARGET.url)` |
| Boxes | `boundingRect` / `getBoundingClientRect` |
| Text that overflows a box | `horizontalOverflow`, `documentHorizontalOverflow` |
| Flex overflow vs threshold | `isClearFlexOverflow(overflow, actionRight, cardRight)` — false if the threshold is mutated to 99999 |
| Clipped text | `Range.getClientRects()` via `textRangeClip`; also computed `overflow` |
| Painted control | `isPainted` (not merely present in the DOM) |
| Local scroll | `computedOverflowX` + `overflowXAllowsScroll` + `scrollMetrics` |
| Occlusion before click | `hitTestCenter` (`document.elementFromPoint` at the box center) |
| Click without `scrollIntoView` | `clickCenter` (`page.mouse.click` on the measured point) |
| End of page | `scrollToDocumentEnd` **before** measuring a fixed footer |

## Classification rules

Run every case that could apply. The first matching **control** wins over a false broken match.

A control is geometry, not structure:

- Flex: a code block whose **computed** `overflow-x` is `auto` or `scroll`, whose `scrollWidth` exceeds `clientWidth`, and whose **page** does not grow sideways (≤ 4px). `overflow-x: visible` is not a control.
- Label: clip plus a **painted** expand control (`aria-expanded`). `display: none` on the toggle is not a control.
- Footer: a **painted** spacer whose height matches the fixed bar, with the last action hittable.

Details, symptoms, and the exact CSS delta live in:

- `skill/cases/flex-long-text.md`
- `skill/cases/fixed-height-label.md`
- `skill/cases/fixed-footer-overlap.md`

Summary:

| Case | Broken | Fixed | Control (no bug) |
| --- | --- | --- | --- |
| `flex-long-text` | Unbreakable token overflows a flex row; action is pushed out of the card by more than `CLEAR_DEFECT_PX`. | Same token wraps; action stays inside the card and is hittable. | Local `overflow-x: auto`/`scroll` on a code block; the **page** does not grow sideways. |
| `fixed-height-label` | `Range.getClientRects()` extend past a hidden-overflow box by more than `CLEAR_DEFECT_PX`; no painted expand control. | Rects stay inside; following block does not overlap. | Intentional clip **plus** a painted expand control (`aria-expanded`). A `title` attribute is not recovery. |
| `fixed-footer-overlap` | After scroll-to-end, fixed footer overlaps the last action by more than `CLEAR_DEFECT_PX`; `elementFromPoint` hits the footer. | Reserved space (`padding-bottom` or equal spacer); hit-test hits the action. | Same fixed bar **with** a painted matching spacer — valid by design. |

## Fix rules

Follow the `fixed` variant for the matching case. Keep the original string. Keep the action reachable: inside its container, in the viewport, and hittable at its center.

Do not “fix” a control. Local scroll, an expand button, or a spacer under a fixed bar is valid.

## Playwright test

Copy `skill/templates/<id>.spec.ts` and `skill/lib/geometry.ts`. Replace the `TARGET` object (`url`, viewport, selectors, copy). Use `openPage(page, TARGET.url, TARGET.viewport)` — that is `page.goto(TARGET.url)`.

The template asserts **healthy** layout (the `fixed` tests), not the defect. So:

- broken page → test **fails** on `expect(...)`
- fixed page → test **passes**

Do not `test.skip` or `test.fail` to green the suite.

## Limits

- Chromium only.
- These three patterns only. Unknown layout issues are out of scope; say so.
- Gallery chrome is not the bug. Open the target page directly.
- Human review is required. Treat this output as a draft.

## Verification in this repo

Mechanical checks (`npm run verify:skill`) instantiate these templates against the nine fixtures and run the classifier in `skill/verify/classify.ts`. That proves the **templates and detection rules** on this repo’s HTML. It does not prove that a coding agent will follow the skill. Recorded Cursor runs live in `docs/agent-runs/`.
