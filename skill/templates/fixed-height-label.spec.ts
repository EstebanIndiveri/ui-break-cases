/**
 * Generated-test template for fixed-height-label.
 *
 * Asserts the HEALTHY layout (the "fixed" variant). Copy this file and
 * `skill/lib/geometry.ts`. Set TARGET.url / selectors / viewport / copy
 * to the page under review. Do not import from ../../src or ../../tests.
 *
 * Expected when pointed at this repo's fixtures:
 *   broken  → FAIL (an expect assertion, not a crash)
 *   fixed   → PASS
 * Do not run this as a bug report against a control (clip + expand button).
 */
import { expect, test } from "@playwright/test";
import {
  GEOM_TOLERANCE_PX,
  boundingRect,
  openPage,
  overflowIsHidden,
  readText,
  textRangeClip,
} from "../lib/geometry.ts";

const TARGET = {
  url: process.env.UI_BREAK_TARGET_URL ?? "",
  viewport: { width: 390, height: 640 },
  selectors: {
    label: "#label",
    next: "#next-content",
  },
  copy: "Delayed at the distribution hub because the outbound scan failed validation for carton NW-4418",
};

test("fixed-height-label healthy: full sentence paints and the next block is clear", async ({
  page,
}) => {
  expect(TARGET.url.length, "Set TARGET.url or UI_BREAK_TARGET_URL").toBeGreaterThan(
    0,
  );
  await openPage(page, TARGET.url, TARGET.viewport);

  await expect(readText(page.locator(TARGET.selectors.label))).resolves.toBe(
    TARGET.copy,
  );

  const clip = await textRangeClip(page, TARGET.selectors.label);
  expect(overflowIsHidden(clip)).toBe(false);
  // 4px slack — GEOM_TOLERANCE_PX
  expect(clip.clippedBottom).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
  expect(clip.clippedRight).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);

  const label = await boundingRect(page, TARGET.selectors.label);
  const next = await boundingRect(page, TARGET.selectors.next);
  expect(next.top).toBeGreaterThanOrEqual(label.bottom - GEOM_TOLERANCE_PX);
});
