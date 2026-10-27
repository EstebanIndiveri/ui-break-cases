import { expect, test } from "@playwright/test";
import { FOOTER_ACTION_LABEL, getCase } from "../src/cases.ts";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  clickCenter,
  expectInViewport,
  hitTestCenter,
  openFixture,
  overlapHeight,
  readText,
  scrollToDocumentEnd,
} from "./helpers.ts";

const spec = getCase("fixed-footer-overlap");
if (!spec) {
  throw new Error("fixed-footer-overlap is missing from the manifest");
}

async function measureAtEnd(page: Parameters<typeof openFixture>[0]) {
  await scrollToDocumentEnd(page);
  const action = await boundingRect(page, "#last-action");
  const footer = await boundingRect(page, "#site-footer");
  const hit = await hitTestCenter(page, "#last-action");
  const position = await page.locator("#site-footer").evaluate((node) => {
    return getComputedStyle(node).position;
  });
  return { action, footer, hit, position };
}

test.describe("fixed-footer-overlap", () => {
  test("broken: at end of scroll the footer covers Confirm booking", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.broken.path, spec.viewport);

    await expect(readText(page.locator("#last-action"))).resolves.toBe(
      FOOTER_ACTION_LABEL,
    );

    const { action, footer, hit, position } = await measureAtEnd(page);
    expect(position).toBe("fixed");
    expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);
    expect(hit.hit?.id).toBe("site-footer");
  });

  test("fixed: reserved space keeps the last control hittable at end of scroll", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.fixed.path, spec.viewport);

    await expect(readText(page.locator("#last-action"))).resolves.toBe(
      FOOTER_ACTION_LABEL,
    );

    const { action, footer, hit, position } = await measureAtEnd(page);
    expect(position).toBe("fixed");
    expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
    expectInViewport(action, spec.viewport);
    expect(hit.hit?.id).toBe("last-action");
    await clickCenter(page, hit);
    await expect(page.locator("#action-status")).toHaveText("Booking confirmed");
  });

  test("control: a fixed bar with a spacer leaves the last control usable", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.control.path, spec.viewport);

    await expect(readText(page.locator("#last-action"))).resolves.toBe(
      FOOTER_ACTION_LABEL,
    );

    const { action, footer, hit, position } = await measureAtEnd(page);
    expect(position).toBe("fixed");
    expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
    expectInViewport(action, spec.viewport);
    expect(hit.hit?.id).toBe("last-action");
    await expect(page.locator("#save-status")).toHaveText("Draft saved");
  });
});
