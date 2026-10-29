/**
 * Generated-test template for fixed-footer-overlap.
 *
 * Asserts the HEALTHY layout (the "fixed" variant). Copy this file and
 * `skill/lib/geometry.ts`. Set TARGET.url / selectors / viewport / copy
 * to the page under review. Do not import from ../../src or ../../tests.
 *
 * Scroll to the end and hit-test BEFORE clicking. A locator click can
 * scrollIntoView and hide the overlap.
 *
 * A painted matching spacer under a fixed bar is valid by design — report
 * no bug instead of treating this test as a defect report.
 */
import { expect, test } from "@playwright/test";
import {
  GEOM_TOLERANCE_PX,
  boundingRect,
  clickCenter,
  expectInViewport,
  hitTestCenter,
  openPage,
  overlapHeight,
  readText,
  scrollToDocumentEnd,
} from "../lib/geometry.ts";

const TARGET = {
  url: process.env.UI_BREAK_TARGET_URL ?? "",
  viewport: { width: 360, height: 500 },
  selectors: {
    action: "#last-action",
    footer: "#site-footer",
    status: "#action-status",
  },
  copy: "Confirm booking",
  confirmed: "Booking confirmed",
};

function actionId(): string {
  return TARGET.selectors.action.replace(/^#/, "");
}

test("fixed-footer-overlap healthy: last action stays above the footer and is hittable", async ({
  page,
}) => {
  expect(TARGET.url.length, "Set TARGET.url or UI_BREAK_TARGET_URL").toBeGreaterThan(
    0,
  );
  await openPage(page, TARGET.url, TARGET.viewport);

  await expect(readText(page.locator(TARGET.selectors.action))).resolves.toBe(
    TARGET.copy,
  );

  await scrollToDocumentEnd(page);
  const action = await boundingRect(page, TARGET.selectors.action);
  const footer = await boundingRect(page, TARGET.selectors.footer);
  const position = await page.locator(TARGET.selectors.footer).evaluate((node) => {
    return getComputedStyle(node).position;
  });
  const hit = await hitTestCenter(page, TARGET.selectors.action);

  expect(position).toBe("fixed");
  // 4px slack — GEOM_TOLERANCE_PX
  expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
  expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
  expectInViewport(action, TARGET.viewport);
  expect(hit.hit?.id).toBe(actionId());
  await clickCenter(page, hit);
  await expect(page.locator(TARGET.selectors.status)).toHaveText(
    TARGET.confirmed,
  );
});
