import { expect, test } from "@playwright/test";
import { FLEX_LONG_TEXT, getCase } from "../src/cases.ts";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  clickCenter,
  documentHorizontalOverflow,
  expectInViewport,
  expectInside,
  hitTestCenter,
  horizontalOverflow,
  openFixture,
  readText,
  scrollMetrics,
} from "./helpers.ts";

const spec = getCase("flex-long-text");
if (!spec) {
  throw new Error("flex-long-text is missing from the manifest");
}

test.describe("flex-long-text", () => {
  test("broken: the unbreakable URL overflows the card and pushes the action out", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.broken.path, spec.viewport);

    await expect(readText(page.locator("#long-text"))).resolves.toBe(
      FLEX_LONG_TEXT,
    );

    const card = await boundingRect(page, "#card");
    const text = await boundingRect(page, "#long-text");
    const action = await boundingRect(page, "#action");
    const overflow = Math.max(
      horizontalOverflow(text, card),
      horizontalOverflow(action, card),
    );

    expect(overflow).toBeGreaterThan(CLEAR_DEFECT_PX);
    expect(action.right).toBeGreaterThan(card.right + CLEAR_DEFECT_PX);
    expectInViewport(action, spec.viewport);
  });

  test("fixed: the same URL stays in the card and Copy remains hittable", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.fixed.path, spec.viewport);

    await expect(readText(page.locator("#long-text"))).resolves.toBe(
      FLEX_LONG_TEXT,
    );

    const card = await boundingRect(page, "#card");
    const text = await boundingRect(page, "#long-text");
    const action = await boundingRect(page, "#action");

    expectInside(text, card);
    expectInside(action, card);
    expectInViewport(action, spec.viewport);

    const hit = await hitTestCenter(page, "#action");
    expect(hit.hit?.id).toBe("action");
    await clickCenter(page, hit);
    await expect(page.locator("#action-status")).toHaveText("Copied");
  });

  test("control: page stays contained; the code block scrolls to the full token", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.control.path, spec.viewport);

    await expect(readText(page.locator("#long-text"))).resolves.toBe(
      FLEX_LONG_TEXT,
    );

    const pageOverflow = await documentHorizontalOverflow(page);
    expect(pageOverflow).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);

    const before = await scrollMetrics(page, "#code-block");
    expect(before.scrollWidth).toBeGreaterThan(
      before.clientWidth + CLEAR_DEFECT_PX,
    );

    await page.locator("#code-block").evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });

    const after = await scrollMetrics(page, "#code-block");
    expect(after.scrollLeft + after.clientWidth).toBeGreaterThanOrEqual(
      after.scrollWidth - GEOM_TOLERANCE_PX,
    );
    expect(await documentHorizontalOverflow(page)).toBeLessThanOrEqual(
      GEOM_TOLERANCE_PX,
    );
  });
});
