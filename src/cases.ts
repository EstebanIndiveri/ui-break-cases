import type { CaseManifest } from "./types.ts";

export const FLEX_LONG_TEXT =
  "https://api.example.test/v1/organizations/northwind-trading/projects/inventory-sync-webhooks/endpoints/evt_9f3c2a1b8d7e6f5c4b3a291807";

export const CLIP_LABEL_TEXT =
  "Delayed at the distribution hub because the outbound scan failed validation for carton NW-4418";

export const FOOTER_ACTION_LABEL = "Confirm booking";

export const cases: CaseManifest[] = [
  {
    id: "flex-long-text",
    title: "Long token in a flex row",
    failureDescription:
      "A card row holds a label, an unbreakable URL, and an action. The URL has no spaces, so the flex item’s default min-width:auto keeps it as wide as the token. The card cannot contain the row: the text overflows and the action is pushed out of the card.",
    reproductionCondition:
      "Viewport 390×640. Open the fixture directly. The card is a flex row with a long URL that contains no spaces or wrapping hints.",
    explanation:
      "Flex items refuse to shrink below their content size unless min-width is set. overflow-wrap lets the same characters wrap inside the column so the action stays in the card. Do not delete the URL, hide it, or shrink the font until it is unreadable.",
    viewport: { width: 390, height: 640 },
    sharedContent: FLEX_LONG_TEXT,
    variants: {
      broken: {
        id: "broken",
        label: "Broken",
        path: "fixtures/flex-long-text/broken.html",
        expectedBehavior:
          "The URL or its column overflows the card by a clear margin and the Copy action is pushed outside the card bounds.",
        summary: "Unbreakable URL blows out a flex row.",
        relevantChange:
          "No min-width:0 on the text column. #long-text { white-space: nowrap; } so the token cannot wrap.",
      },
      fixed: {
        id: "fixed",
        label: "Fixed",
        path: "fixtures/flex-long-text/fixed.html",
        expectedBehavior:
          "The same URL is fully present, wraps inside the card, and the Copy action stays inside the card and the viewport.",
        summary: "Same URL wraps; action remains reachable.",
        relevantChange:
          ".body { flex: 1 1 auto; min-width: 0; } #long-text { overflow-wrap: anywhere; }",
      },
      control: {
        id: "control",
        label: "Control",
        path: "fixtures/flex-long-text/control.html",
        expectedBehavior:
          "A code block uses local overflow-x:auto. The page does not grow horizontally. Scrolling the code block reveals the full token.",
        summary: "Horizontal scroll is local to the code block, by design.",
        relevantChange:
          "pre.code { overflow-x: auto; white-space: nowrap; } — page overflow is not used.",
      },
    },
    provenance: {
      kind: "inspired",
      note: "Original fixture. The overflow pattern is the well-known flex min-width:auto behavior, not a pixel-perfect copy of a single production bug.",
      sources: [
        {
          label: "Flexbugs #1",
          href: "https://github.com/philipwalton/flexbugs#flexbug-1",
        },
        {
          label: "Defensive CSS",
          href: "https://defensivecss.dev/tip/flexbox-min-content-size/",
        },
      ],
    },
    links: [
      {
        label: "MDN overflow-wrap",
        href: "https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap",
      },
      {
        label: "MDN min-width",
        href: "https://developer.mozilla.org/en-US/docs/Web/CSS/min-width",
      },
    ],
    knownLimitations: [
      "Helpers compare bounding boxes on this fixture only. They are not a general overflow detector.",
      "Wrapping is the intended fix. Truncation with an ellipsis would hide characters and is not accepted here.",
    ],
    testFile: "tests/flex-long-text.spec.ts",
    sourceDirectory: "public/fixtures/flex-long-text",
  },
  {
    id: "fixed-height-label",
    title: "Fixed-height label clipping",
    failureDescription:
      "A status sentence that used to fit on one line now wraps. The label keeps a one-line height and overflow:hidden, so part of the sentence is clipped with no way to recover it.",
    reproductionCondition:
      "Viewport 390×640. Open the fixture directly. The label is a multi-word sentence in a 24px-tall box with overflow hidden.",
    explanation:
      "A leftover one-line height clips wrapped text. Removing the cap lets the full sentence paint, and the following block stays below it. A title attribute is not a recovery mechanism. The control uses an explicit expand button instead.",
    viewport: { width: 390, height: 640 },
    sharedContent: CLIP_LABEL_TEXT,
    variants: {
      broken: {
        id: "broken",
        label: "Broken",
        path: "fixtures/fixed-height-label/broken.html",
        expectedBehavior:
          "Range.getClientRects() for the label extend past the box, overflow is hidden, and no control reveals the clipped words.",
        summary: "Multi-line copy is clipped by a one-line height.",
        relevantChange: "#label { height: 24px; overflow: hidden; }",
      },
      fixed: {
        id: "fixed",
        label: "Fixed",
        path: "fixtures/fixed-height-label/fixed.html",
        expectedBehavior:
          "The full sentence is visible. Text rects stay inside the label box. The next block starts below the label and does not overlap it.",
        summary: "Height follows the text; following content is not covered.",
        relevantChange: "#label { height: auto; overflow: visible; }",
      },
      control: {
        id: "control",
        label: "Control",
        path: "fixtures/fixed-height-label/control.html",
        expectedBehavior:
          "Collapsed: the summary is clipped and Show full summary is present. Expanded: the full sentence is visible. A title attribute is not used as the recovery path.",
        summary: "Intentional truncation with an explicit expand action.",
        relevantChange:
          "Collapsed uses overflow:hidden; the button toggles aria-expanded and removes the clip.",
      },
    },
    provenance: {
      kind: "inspired",
      note: "Original fixture. Clipping from a leftover single-line height is a common product-UI failure; this is not a dump of a specific app screen.",
      sources: [
        {
          label: "MDN overflow",
          href: "https://developer.mozilla.org/en-US/docs/Web/CSS/overflow",
        },
      ],
    },
    links: [
      {
        label: "Range.getClientRects()",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects",
      },
    ],
    knownLimitations: [
      "Clipping checks use Range.getClientRects() plus the label’s box and computed overflow. That is enough for this static fixture, not for arbitrary clipped widgets.",
      "Line-clamp with an ellipsis and no expand control would still fail the recovery requirement.",
    ],
    testFile: "tests/fixed-height-label.spec.ts",
    sourceDirectory: "public/fixtures/fixed-height-label",
  },
  {
    id: "fixed-footer-overlap",
    title: "Fixed footer covering the last control",
    failureDescription:
      "A short viewport plus a position:fixed footer leaves the last action under the bar even after scrolling to the end of the document. The control cannot receive a hit at its center.",
    reproductionCondition:
      "Viewport 360×500. Open the fixture directly. Scroll to the end. Do not click the last button first — a click may scroll it into view and hide the overlap.",
    explanation:
      "position:fixed removes the footer from document flow. Without reserved space, the last control sits in the footer’s screen rect. Padding or a spacer equal to the footer height keeps the control usable. The control variant shows the same fixed positioning used correctly.",
    viewport: { width: 360, height: 500 },
    sharedContent: FOOTER_ACTION_LABEL,
    variants: {
      broken: {
        id: "broken",
        label: "Broken",
        path: "fixtures/fixed-footer-overlap/broken.html",
        expectedBehavior:
          "At max scroll, the footer overlaps the last button by more than the geometric tolerance, and elementFromPoint at the button center hits the footer.",
        summary: "End of scroll still leaves Confirm booking under the footer.",
        relevantChange:
          "footer { position: fixed; bottom: 0; } with no padding-bottom on main.",
      },
      fixed: {
        id: "fixed",
        label: "Fixed",
        path: "fixtures/fixed-footer-overlap/fixed.html",
        expectedBehavior:
          "At max scroll, Confirm booking sits fully above the footer, stays in the viewport, and elementFromPoint at its center hits the button.",
        summary: "main padding-bottom reserves the footer height.",
        relevantChange: "main { padding-bottom: 88px; } /* footer is 72px */",
      },
      control: {
        id: "control",
        label: "Control",
        path: "fixtures/fixed-footer-overlap/control.html",
        expectedBehavior:
          "A fixed status bar is intentional. A matching spacer keeps the last control clear. elementFromPoint hits the button, showing position:fixed can be valid.",
        summary: "Fixed bar with an equal spacer — valid by design.",
        relevantChange:
          ".spacer { height: 72px; } footer { position: fixed; bottom: 0; height: 72px; }",
      },
    },
    provenance: {
      kind: "inspired",
      note: "Original fixture. Overlap between a fixed chrome bar and the last page control is a common mobile-web layout failure, not a clone of one site.",
      sources: [
        {
          label: "MDN position",
          href: "https://developer.mozilla.org/en-US/docs/Web/CSS/position",
        },
      ],
    },
    links: [
      {
        label: "elementFromPoint()",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint",
      },
    ],
    knownLimitations: [
      "Tests measure at end-of-scroll before any click that could call scrollIntoView.",
      "The gallery iframe is locked to 360×500 and is not resized to the page’s content height.",
      "Helpers are for this page geometry, not a general occluder finder.",
    ],
    testFile: "tests/fixed-footer-overlap.spec.ts",
    sourceDirectory: "public/fixtures/fixed-footer-overlap",
  },
];

export function getCase(id: string): CaseManifest | undefined {
  return cases.find((item) => item.id === id);
}
