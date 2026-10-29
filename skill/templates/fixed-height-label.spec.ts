/**
 * Generated-test template for fixed-height-label.
 *
 * Asserts the HEALTHY layout (the repo's "fixed" variant). Copy this file,
 * then change TARGET.path / selectors / viewport to the page under review.
 *
 * Expected when pointed at this repo's fixtures:
 *   broken  → FAIL
 *   fixed   → PASS
 * Do not run this as a bug report against a control (clip + expand button).
 */
import { expect, test } from "@playwright/test";
import { CLIP_LABEL_TEXT } from "../../src/cases.ts";
import {
  GEOM_TOLERANCE_PX,
  boundingRect,
  openFixture,
  overflowIsHidden,
  readText,
  textRangeClip,
} from "../../tests/helpers.ts";

const TARGET = {
  path:
    process.env.UI_BREAK_TARGET_PATH ??
    "fixtures/fixed-height-label/fixed.html",
  viewport: { width: 390, height: 640 },
  selectors: {
    label: "#label",
    next: "#next-content",
  },
  copy: CLIP_LABEL_TEXT,
};

test("fixed-height-label healthy: full sentence paints and the next block is clear", async ({
  page,
}) => {
  await openFixture(page, TARGET.path, TARGET.viewport);

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
