/**
 * Generated-test template for flex-long-text.
 *
 * Asserts the HEALTHY layout (the repo's "fixed" variant). Copy this file,
 * then change TARGET.path / selectors / viewport to the page under review.
 *
 * Expected when pointed at this repo's fixtures:
 *   broken  → FAIL
 *   fixed   → PASS
 * Do not run this as a bug report against a control (local code-block scroll).
 */
import { expect, test } from "@playwright/test";
import { FLEX_LONG_TEXT } from "../../src/cases.ts";
import {
  boundingRect,
  clickCenter,
  expectInViewport,
  expectInside,
  hitTestCenter,
  openFixture,
  readText,
} from "../../tests/helpers.ts";

const TARGET = {
  path:
    process.env.UI_BREAK_TARGET_PATH ?? "fixtures/flex-long-text/fixed.html",
  viewport: { width: 390, height: 640 },
  selectors: {
    text: "#long-text",
    card: "#card",
    action: "#action",
    status: "#action-status",
  },
  copy: FLEX_LONG_TEXT,
};

test("flex-long-text healthy: token stays in the card and the action is hittable", async ({
  page,
}) => {
  await openFixture(page, TARGET.path, TARGET.viewport);

  await expect(readText(page.locator(TARGET.selectors.text))).resolves.toBe(
    TARGET.copy,
  );

  const card = await boundingRect(page, TARGET.selectors.card);
  const text = await boundingRect(page, TARGET.selectors.text);
  const action = await boundingRect(page, TARGET.selectors.action);

  // 4px slack — GEOM_TOLERANCE_PX in tests/helpers.ts
  expectInside(text, card);
  expectInside(action, card);
  expectInViewport(action, TARGET.viewport);

  const hit = await hitTestCenter(page, TARGET.selectors.action);
  expect(hit.hit?.id).toBe("action");
  await clickCenter(page, hit);
  await expect(page.locator(TARGET.selectors.status)).toHaveText("Copied");
});
