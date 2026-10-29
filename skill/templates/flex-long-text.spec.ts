/**
 * Generated-test template for flex-long-text.
 *
 * Asserts the HEALTHY layout (the "fixed" variant). Copy this file and
 * `skill/lib/geometry.ts`. Set TARGET.url / selectors / viewport / copy
 * to the page under review. Do not import from ../../src or ../../tests.
 *
 * Expected when pointed at this repo's fixtures:
 *   broken  → FAIL (an expect assertion, not a crash)
 *   fixed   → PASS
 * Do not run this as a bug report against a control (local code-block scroll).
 */
import { expect, test } from "@playwright/test";
import {
  boundingRect,
  clickCenter,
  expectInViewport,
  expectInside,
  hitTestCenter,
  openPage,
  readText,
} from "../lib/geometry.ts";

const TARGET = {
  url: process.env.UI_BREAK_TARGET_URL ?? "",
  viewport: { width: 390, height: 640 },
  selectors: {
    text: "#long-text",
    card: "#card",
    action: "#action",
    status: "#action-status",
  },
  copy: "https://api.example.test/evt_9f3c2a",
  copied: "Copied",
};

function actionId(): string {
  return TARGET.selectors.action.replace(/^#/, "");
}

test("flex-long-text healthy: token stays in the card and the action is hittable", async ({
  page,
}) => {
  expect(TARGET.url.length, "Set TARGET.url or UI_BREAK_TARGET_URL").toBeGreaterThan(
    0,
  );
  await openPage(page, TARGET.url, TARGET.viewport);

  await expect(readText(page.locator(TARGET.selectors.text))).resolves.toBe(
    TARGET.copy,
  );

  const card = await boundingRect(page, TARGET.selectors.card);
  const text = await boundingRect(page, TARGET.selectors.text);
  const action = await boundingRect(page, TARGET.selectors.action);

  // 4px slack — GEOM_TOLERANCE_PX in skill/lib/geometry.ts
  expectInside(text, card);
  expectInside(action, card);
  expectInViewport(action, TARGET.viewport);

  const hit = await hitTestCenter(page, TARGET.selectors.action);
  expect(hit.hit?.id).toBe(actionId());
  await clickCenter(page, hit);
  await expect(page.locator(TARGET.selectors.status)).toHaveText(TARGET.copied);
});
