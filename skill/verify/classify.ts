import type { Page } from "@playwright/test";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  documentHorizontalOverflow,
  hitTestCenter,
  horizontalOverflow,
  openFixture,
  overflowIsHidden,
  overlapHeight,
  scrollMetrics,
  scrollToDocumentEnd,
  textRangeClip,
} from "../../tests/helpers.ts";

/**
 * Mechanical stand-in for the skill's detection rules.
 * A coding agent is expected to reach the same classification by following
 * skill/SKILL.md; this module does not call an LLM.
 */

export type Resembles = "broken" | "fixed" | "control";

export type Classification = {
  caseId: "flex-long-text" | "fixed-height-label" | "fixed-footer-overlap";
  resembles: Resembles;
  /** True only for a broken match. Control and fixed are not bugs. */
  bug: boolean;
  reasons: string[];
};

export async function count(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

export async function classifyFlexLongText(
  page: Page,
): Promise<Classification | null> {
  const codeBlocks = await count(page, "#code-block");
  const cards = await count(page, "#card");
  const tokens = await count(page, "#long-text");
  if (tokens === 0) {
    return null;
  }

  if (codeBlocks > 0 && cards === 0) {
    const pageOverflow = await documentHorizontalOverflow(page);
    const metrics = await scrollMetrics(page, "#code-block");
    const localScroll =
      metrics.scrollWidth > metrics.clientWidth + CLEAR_DEFECT_PX;
    const pageContained = pageOverflow <= GEOM_TOLERANCE_PX;
    if (localScroll && pageContained) {
      return {
        caseId: "flex-long-text",
        resembles: "control",
        bug: false,
        reasons: [
          "Code block uses local overflow-x; page overflow is within 4px slack.",
        ],
      };
    }
    return {
      caseId: "flex-long-text",
      resembles: "control",
      bug: false,
      reasons: [
        "Token lives in a code block rather than a flex card; treat as control, not a flex-row bug.",
      ],
    };
  }

  if (cards === 0 || (await count(page, "#action")) === 0) {
    return null;
  }

  const card = await boundingRect(page, "#card");
  const text = await boundingRect(page, "#long-text");
  const action = await boundingRect(page, "#action");
  const overflow = Math.max(
    horizontalOverflow(text, card),
    horizontalOverflow(action, card),
  );

  if (
    overflow > CLEAR_DEFECT_PX &&
    action.right > card.right + CLEAR_DEFECT_PX
  ) {
    return {
      caseId: "flex-long-text",
      resembles: "broken",
      bug: true,
      reasons: [
        `Flex row overflows the card by ${overflow.toFixed(1)}px (defect threshold 16px).`,
      ],
    };
  }

  const hit = await hitTestCenter(page, "#action");
  if (
    overflow <= GEOM_TOLERANCE_PX &&
    action.right <= card.right + GEOM_TOLERANCE_PX &&
    hit.hit?.id === "action"
  ) {
    return {
      caseId: "flex-long-text",
      resembles: "fixed",
      bug: false,
      reasons: [
        "Token and action stay inside the card; hit-test reaches the action.",
      ],
    };
  }

  return {
    caseId: "flex-long-text",
    resembles: "broken",
    bug: true,
    reasons: [
      "Flex card is present but the row is not clearly inside the card.",
    ],
  };
}

export async function classifyFixedHeightLabel(
  page: Page,
): Promise<Classification | null> {
  if ((await count(page, "#label")) === 0) {
    return null;
  }

  const clip = await textRangeClip(page, "#label");
  const expandCount = await count(page, "#expand-toggle");
  const hidden = overflowIsHidden(clip);

  if (expandCount > 0) {
    return {
      caseId: "fixed-height-label",
      resembles: "control",
      bug: false,
      reasons: [
        "Clipped label ships an explicit expand control; valid by design.",
      ],
    };
  }

  if (
    clip.rects.length > 1 &&
    hidden &&
    clip.clippedBottom > CLEAR_DEFECT_PX
  ) {
    return {
      caseId: "fixed-height-label",
      resembles: "broken",
      bug: true,
      reasons: [
        `Label client rects extend ${clip.clippedBottom.toFixed(1)}px past a hidden-overflow box with no expand control.`,
      ],
    };
  }

  const label = await boundingRect(page, "#label");
  const nextExists = (await count(page, "#next-content")) > 0;
  const nextClear = nextExists
    ? (await boundingRect(page, "#next-content")).top >=
      label.bottom - GEOM_TOLERANCE_PX
    : true;

  if (
    !hidden &&
    clip.clippedBottom <= GEOM_TOLERANCE_PX &&
    clip.clippedRight <= GEOM_TOLERANCE_PX &&
    nextClear
  ) {
    return {
      caseId: "fixed-height-label",
      resembles: "fixed",
      bug: false,
      reasons: ["Full sentence paints inside the label; following block is clear."],
    };
  }

  return null;
}

export async function classifyFixedFooterOverlap(
  page: Page,
): Promise<Classification | null> {
  if (
    (await count(page, "#last-action")) === 0 ||
    (await count(page, "#site-footer")) === 0
  ) {
    return null;
  }

  await scrollToDocumentEnd(page);
  const action = await boundingRect(page, "#last-action");
  const footer = await boundingRect(page, "#site-footer");
  const position = await page.locator("#site-footer").evaluate((node) => {
    return getComputedStyle(node).position;
  });
  if (position !== "fixed") {
    return null;
  }

  const overlap = overlapHeight(action, footer);
  const hit = await hitTestCenter(page, "#last-action");
  const spacerCount = await count(page, ".spacer");

  if (overlap > CLEAR_DEFECT_PX && hit.hit?.id === "site-footer") {
    return {
      caseId: "fixed-footer-overlap",
      resembles: "broken",
      bug: true,
      reasons: [
        `At end of scroll the footer overlaps the last action by ${overlap.toFixed(1)}px and elementFromPoint hits the footer.`,
      ],
    };
  }

  const clear =
    overlap <= GEOM_TOLERANCE_PX &&
    action.bottom <= footer.top + GEOM_TOLERANCE_PX &&
    hit.hit?.id === "last-action";

  if (!clear) {
    return {
      caseId: "fixed-footer-overlap",
      resembles: "broken",
      bug: true,
      reasons: [
        "Fixed footer is present and the last action is not clearly hittable at end of scroll.",
      ],
    };
  }

  if (spacerCount > 0) {
    return {
      caseId: "fixed-footer-overlap",
      resembles: "control",
      bug: false,
      reasons: [
        "Fixed bar with a matching spacer; last action is hittable — valid by design.",
      ],
    };
  }

  return {
    caseId: "fixed-footer-overlap",
    resembles: "fixed",
    bug: false,
    reasons: [
      "Reserved space keeps the last action above the fixed footer and hittable.",
    ],
  };
}

export async function classifyFixture(
  page: Page,
  fixturePath: string,
  viewport: { width: number; height: number },
): Promise<Classification> {
  await openFixture(page, fixturePath, viewport);
  const matches = (
    await Promise.all([
      classifyFlexLongText(page),
      classifyFixedHeightLabel(page),
      classifyFixedFooterOverlap(page),
    ])
  ).filter((item): item is Classification => item !== null);

  const bug = matches.find((item) => item.bug);
  if (bug) {
    return bug;
  }
  const control = matches.find((item) => item.resembles === "control");
  if (control) {
    return control;
  }
  const fixed = matches.find((item) => item.resembles === "fixed");
  if (fixed) {
    return fixed;
  }
  throw new Error(`No ui-break-cases pattern matched ${fixturePath}`);
}
