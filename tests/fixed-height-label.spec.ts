import { expect, test } from "@playwright/test";
import { CLIP_LABEL_TEXT, getCase } from "../src/cases.ts";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  openFixture,
  overflowIsHidden,
  readText,
  textRangeClip,
} from "./helpers.ts";

const spec = getCase("fixed-height-label");
if (!spec) {
  throw new Error("fixed-height-label is missing from the manifest");
}

test.describe("fixed-height-label", () => {
  test("broken: the sentence is clipped and nothing restores it", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.broken.path, spec.viewport);

    await expect(readText(page.locator("#label"))).resolves.toBe(CLIP_LABEL_TEXT);

    const clip = await textRangeClip(page, "#label");
    expect(clip.rects.length).toBeGreaterThan(1);
    expect(overflowIsHidden(clip)).toBe(true);
    expect(clip.clippedBottom).toBeGreaterThan(CLEAR_DEFECT_PX);
    await expect(page.locator("#expand-toggle")).toHaveCount(0);
  });

  test("fixed: the full sentence is readable and the next block does not overlap", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.fixed.path, spec.viewport);

    await expect(readText(page.locator("#label"))).resolves.toBe(CLIP_LABEL_TEXT);

    const clip = await textRangeClip(page, "#label");
    expect(overflowIsHidden(clip)).toBe(false);
    expect(clip.clippedBottom).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(clip.clippedRight).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);

    const label = await boundingRect(page, "#label");
    const next = await boundingRect(page, "#next-content");
    expect(next.top).toBeGreaterThanOrEqual(label.bottom - GEOM_TOLERANCE_PX);
  });

  test("control: collapsed clip plus explicit expand; expanded shows the full sentence", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.control.path, spec.viewport);

    await expect(readText(page.locator("#label"))).resolves.toBe(CLIP_LABEL_TEXT);

    const collapsed = await textRangeClip(page, "#label");
    expect(overflowIsHidden(collapsed)).toBe(true);
    expect(collapsed.clippedBottom).toBeGreaterThan(CLEAR_DEFECT_PX);
    await expect(page.locator("#label")).not.toHaveAttribute("title", /.+/);
    await expect(page.locator("#expand-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.locator("#expand-toggle").click();

    await expect(page.locator("#expand-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(readText(page.locator("#label"))).resolves.toBe(CLIP_LABEL_TEXT);

    const expanded = await textRangeClip(page, "#label");
    expect(overflowIsHidden(expanded)).toBe(false);
    expect(expanded.clippedBottom).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
  });
});
