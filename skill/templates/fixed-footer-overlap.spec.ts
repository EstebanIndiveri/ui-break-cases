/**
 * Generated-test template for fixed-footer-overlap.
 *
 * Asserts the HEALTHY layout (the repo's "fixed" variant). Copy this file,
 * then change TARGET.path / selectors / viewport to the page under review.
 *
 * Expected when pointed at this repo's fixtures:
 *   broken  → FAIL
 *   fixed   → PASS
 *
 * Scroll to the end and hit-test BEFORE clicking. A locator click can
 * scrollIntoView and hide the overlap.
 *
 * A control fixture (fixed bar + matching spacer) is valid by design — classify
 * it as no bug instead of treating this test as a defect report.
 */
import { expect, test } from "@playwright/test";
import { FOOTER_ACTION_LABEL } from "../../src/cases.ts";
import {
  GEOM_TOLERANCE_PX,
  boundingRect,
  clickCenter,
  expectInViewport,
  hitTestCenter,
  openFixture,
  overlapHeight,
  readText,
  scrollToDocumentEnd,
} from "../../tests/helpers.ts";

const TARGET = {
  path:
    process.env.UI_BREAK_TARGET_PATH ??
    "fixtures/fixed-footer-overlap/fixed.html",
  viewport: { width: 360, height: 500 },
  selectors: {
    action: "#last-action",
    footer: "#site-footer",
    status: "#action-status",
  },
  copy: FOOTER_ACTION_LABEL,
};

test("fixed-footer-overlap healthy: last action stays above the footer and is hittable", async ({
  page,
}) => {
  await openFixture(page, TARGET.path, TARGET.viewport);

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
  expect(hit.hit?.id).toBe("last-action");
  await clickCenter(page, hit);
  await expect(page.locator(TARGET.selectors.status)).toHaveText(
    "Booking confirmed",
  );
});
