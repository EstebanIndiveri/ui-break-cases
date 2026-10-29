import type { Page } from "@playwright/test";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  computedOverflowX,
  documentHorizontalOverflow,
  hitTestCenter,
  horizontalOverflow,
  isClearFlexOverflow,
  isPainted,
  openPage,
  overflowIsHidden,
  overflowXAllowsScroll,
  overlapHeight,
  scrollMetrics,
  scrollToDocumentEnd,
  textRangeClip,
} from "../lib/geometry.ts";

/**
 * Mechanical stand-in for the skill's detection rules.
 * A coding agent is expected to reach the same classification by following
 * skill/SKILL.md; this module does not call an LLM.
 *
 * Control wins over a false broken match for the SAME case only.
 * A flex control on the page does not hide a broken footer.
 * Broken is returned only when the defect exceeds CLEAR_DEFECT_PX.
 * The 4–16px band is unclassified (null), not a fallback "broken".
 * Every matching case is reported; callers must not drop a bug because
 * another case resembled control.
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
  threshold = CLEAR_DEFECT_PX,
  tolerance = GEOM_TOLERANCE_PX,
): Promise<Classification | null> {
  const codeBlocks = await count(page, "#code-block");
  const cards = await count(page, "#card");
  const tokens = await count(page, "#long-text");
  if (tokens === 0) {
    return null;
  }

  if (codeBlocks > 0) {
    const overflowX = await computedOverflowX(page, "#code-block");
    const pageOverflow = await documentHorizontalOverflow(page);
    const metrics = await scrollMetrics(page, "#code-block");
    const localScroll =
      metrics.scrollWidth > metrics.clientWidth + CLEAR_DEFECT_PX;
    const pageContained = pageOverflow <= tolerance;
    if (
      overflowXAllowsScroll(overflowX) &&
      localScroll &&
      pageContained
    ) {
      return {
        caseId: "flex-long-text",
        resembles: "control",
        bug: false,
        reasons: [
          `Code block overflow-x is ${overflowX}; local scrollWidth-clientWidth is ${(metrics.scrollWidth - metrics.clientWidth).toFixed(1)}px; page overflow is ${pageOverflow.toFixed(1)}px.`,
        ],
      };
    }
    if (cards === 0) {
      return null;
    }
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

  if (isClearFlexOverflow(overflow, action.right, card.right, threshold)) {
    return {
      caseId: "flex-long-text",
      resembles: "broken",
      bug: true,
      reasons: [
        `Flex row overflows the card by ${overflow.toFixed(1)}px (defect threshold ${threshold}px).`,
      ],
    };
  }

  const hit = await hitTestCenter(page, "#action");
  if (
    overflow <= tolerance &&
    action.right <= card.right + tolerance &&
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

  return null;
}

export async function classifyFixedHeightLabel(
  page: Page,
): Promise<Classification | null> {
  if ((await count(page, "#label")) === 0) {
    return null;
  }

  const clip = await textRangeClip(page, "#label");
  const expandPainted = await isPainted(page, "#expand-toggle");
  const hidden = overflowIsHidden(clip);

  if (expandPainted) {
    const aria = await page.locator("#expand-toggle").getAttribute("aria-expanded");
    if (hidden && clip.clippedBottom > CLEAR_DEFECT_PX && aria !== null) {
      return {
        caseId: "fixed-height-label",
        resembles: "control",
        bug: false,
        reasons: [
          "Clipped label has a painted expand control with aria-expanded; valid by design.",
        ],
      };
    }
  }

  if (
    clip.rects.length > 1 &&
    hidden &&
    clip.clippedBottom > CLEAR_DEFECT_PX &&
    !expandPainted
  ) {
    return {
      caseId: "fixed-height-label",
      resembles: "broken",
      bug: true,
      reasons: [
        `Label client rects extend ${clip.clippedBottom.toFixed(1)}px past a hidden-overflow box with no painted expand control.`,
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
  const spacerPainted = await isPainted(page, ".spacer");
  const clear =
    overlap <= GEOM_TOLERANCE_PX &&
    action.bottom <= footer.top + GEOM_TOLERANCE_PX &&
    hit.hit?.id === "last-action";

  if (spacerPainted && clear) {
    const spacer = await boundingRect(page, ".spacer");
    if (spacer.height + GEOM_TOLERANCE_PX >= footer.height) {
      return {
        caseId: "fixed-footer-overlap",
        resembles: "control",
        bug: false,
        reasons: [
          `Painted spacer ${spacer.height.toFixed(1)}px matches footer ${footer.height.toFixed(1)}px; last action is hittable.`,
        ],
      };
    }
  }

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

  if (clear) {
    return {
      caseId: "fixed-footer-overlap",
      resembles: "fixed",
      bug: false,
      reasons: [
        "Reserved space keeps the last action above the fixed footer and hittable.",
      ],
    };
  }

  return null;
}

export type FixtureReport = {
  matches: Classification[];
};

export function matchFor(
  report: FixtureReport,
  caseId: Classification["caseId"],
): Classification | undefined {
  return report.matches.find((item) => item.caseId === caseId);
}

export function reportHasBug(report: FixtureReport): boolean {
  return report.matches.some((item) => item.bug);
}

/**
 * Classify the page that is already open. Does not navigate.
 * Control of case A cannot hide a broken match of case B.
 */
export async function classifyOpenPage(page: Page): Promise<FixtureReport> {
  const matches: Classification[] = [];
  const flex = await classifyFlexLongText(page);
  if (flex) {
    matches.push(flex);
  }
  const label = await classifyFixedHeightLabel(page);
  if (label) {
    matches.push(label);
  }
  const footer = await classifyFixedFooterOverlap(page);
  if (footer) {
    matches.push(footer);
  }
  return { matches };
}

export async function classifyFixture(
  page: Page,
  fixturePath: string,
  viewport: { width: number; height: number },
): Promise<FixtureReport> {
  await openPage(page, fixturePath, viewport);
  const report = await classifyOpenPage(page);
  if (report.matches.length === 0) {
    throw new Error(`No ui-break-cases pattern matched ${fixturePath}`);
  }
  return report;
}
