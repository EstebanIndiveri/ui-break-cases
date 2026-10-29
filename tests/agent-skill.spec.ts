import { expect, test } from "@playwright/test";
import { cases, getCase } from "../src/cases.ts";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  computedOverflowX,
  documentHorizontalOverflow,
  horizontalOverflow,
  isClearFlexOverflow,
  isPainted,
  openFixture,
  overflowXAllowsScroll,
  scrollMetrics,
} from "./helpers.ts";
import {
  classifyFixedHeightLabel,
  classifyFixture,
  classifyFlexLongText,
} from "../skill/verify/classify.ts";
import type { Resembles } from "../skill/verify/classify.ts";

/**
 * Mechanical detection for the skill rules in skill/SKILL.md.
 * This is not an LLM run. Each fixture must classify as the variant it is.
 */
const expected: Record<
  string,
  Record<string, { resembles: Resembles; bug: boolean }>
> = {
  "flex-long-text": {
    broken: { resembles: "broken", bug: true },
    fixed: { resembles: "fixed", bug: false },
    control: { resembles: "control", bug: false },
  },
  "fixed-height-label": {
    broken: { resembles: "broken", bug: true },
    fixed: { resembles: "fixed", bug: false },
    control: { resembles: "control", bug: false },
  },
  "fixed-footer-overlap": {
    broken: { resembles: "broken", bug: true },
    fixed: { resembles: "fixed", bug: false },
    control: { resembles: "control", bug: false },
  },
};

test.describe("agent-skill detection", () => {
  for (const item of cases) {
    for (const variant of ["broken", "fixed", "control"] as const) {
      const want = expected[item.id]?.[variant];
      if (!want) {
        throw new Error(`missing skill expectation for ${item.id} ${variant}`);
      }
      test(`${item.id} ${variant}: resembles ${want.resembles}, bug=${want.bug}`, async ({
        page,
      }) => {
        const result = await classifyFixture(
          page,
          item.variants[variant].path,
          item.viewport,
        );
        expect(result.caseId).toBe(item.id);
        expect(result.resembles).toBe(want.resembles);
        expect(result.bug).toBe(want.bug);
      });
    }
  }
});

test.describe("agent-skill control geometry", () => {
  test("flex-long-text control: control-geometry", async ({ page }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    const overflowX = await computedOverflowX(page, "#code-block");
    const pageOverflow = await documentHorizontalOverflow(page);
    const metrics = await scrollMetrics(page, "#code-block");
    expect(overflowXAllowsScroll(overflowX)).toBe(true);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(pageOverflow).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).toBe("control");
    expect(classified?.bug).toBe(false);
  });

  test("fixed-height-label control: control-geometry", async ({ page }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    expect(await isPainted(page, "#expand-toggle")).toBe(true);
    await expect(page.locator("#expand-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).toBe("control");
    expect(classified?.bug).toBe(false);
  });

  test("fixed-footer-overlap control: control-geometry", async ({ page }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    const result = await classifyFixture(
      page,
      spec.variants.control.path,
      spec.viewport,
    );
    expect(result.resembles).toBe("control");
    expect(result.bug).toBe(false);
    expect(await isPainted(page, ".spacer")).toBe(true);
  });
});

test.describe("agent-skill mutations", () => {
  test("flex control with overflow-x:visible is not control", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#code-block").evaluate((node) => {
      (node as HTMLElement).style.overflowX = "visible";
    });
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).not.toBe("control");
  });

  test("label control with display:none expand is not control", async ({
    page,
  }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#expand-toggle").evaluate((node) => {
      (node as HTMLElement).style.display = "none";
    });
    expect(await isPainted(page, "#expand-toggle")).toBe(false);
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("control");
    expect(classified?.resembles).toBe("broken");
    expect(classified?.bug).toBe(true);
  });
});

test.describe("agent-skill flex threshold", () => {
  test("isClearFlexOverflow dies when the threshold is mutated to 99999", async ({
    page,
  }) => {
    expect(isClearFlexOverflow(80, 400, 252, 16)).toBe(true);
    expect(isClearFlexOverflow(80, 400, 252, 99999)).toBe(false);

    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    const card = await boundingRect(page, "#card");
    const text = await boundingRect(page, "#long-text");
    const action = await boundingRect(page, "#action");
    const overflow = Math.max(
      horizontalOverflow(text, card),
      horizontalOverflow(action, card),
    );
    expect(overflow).toBeGreaterThan(CLEAR_DEFECT_PX);
    expect(isClearFlexOverflow(overflow, action.right, card.right)).toBe(true);
    expect(
      isClearFlexOverflow(overflow, action.right, card.right, 99999),
    ).toBe(false);

    const withDefault = await classifyFlexLongText(page);
    expect(withDefault?.resembles).toBe("broken");
    const withMutant = await classifyFlexLongText(page, 99999);
    expect(withMutant?.resembles).not.toBe("broken");
    expect(withMutant?.bug ?? false).toBe(false);
  });
});
