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
  classifyFixedFooterOverlap,
  classifyFixedHeightLabel,
  classifyFixture,
  classifyFlexLongText,
  classifyOpenPage,
  matchFor,
  reportHasBug,
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
        const report = await classifyFixture(
          page,
          item.variants[variant].path,
          item.viewport,
        );
        const result = matchFor(
          report,
          item.id as "flex-long-text" | "fixed-height-label" | "fixed-footer-overlap",
        );
        expect(result, `missing ${item.id} in ${JSON.stringify(report.matches)}`).toBeTruthy();
        expect(result?.caseId).toBe(item.id);
        expect(result?.resembles).toBe(want.resembles);
        expect(result?.bug).toBe(want.bug);
        expect(reportHasBug(report)).toBe(want.bug);
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
    const report = await classifyFixture(
      page,
      spec.variants.control.path,
      spec.viewport,
    );
    const result = matchFor(report, "fixed-footer-overlap");
    expect(result?.resembles).toBe("control");
    expect(result?.bug).toBe(false);
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

test.describe("agent-skill control is per-case", () => {
  test("flex control on a broken footer does not hide the footer bug", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.evaluate(() => {
      const pre = document.createElement("pre");
      pre.id = "code-block";
      pre.style.cssText = [
        "position:fixed",
        "top:8px",
        "left:8px",
        "z-index:1",
        "width:220px",
        "overflow-x:auto",
        "white-space:nowrap",
        "font:13px/1.4 ui-monospace,monospace",
        "padding:12px",
        "background:#1c1917",
        "color:#f5f5f4",
      ].join(";");
      const code = document.createElement("code");
      code.id = "long-text";
      code.style.whiteSpace = "nowrap";
      code.textContent = "https://api.example.test/evt_9f3c2a";
      pre.append(code);
      document.body.append(pre);
    });

    const report = await classifyOpenPage(page);
    const flex = matchFor(report, "flex-long-text");
    const footer = matchFor(report, "fixed-footer-overlap");
    expect(flex?.resembles).toBe("control");
    expect(flex?.bug).toBe(false);
    expect(footer?.resembles).toBe("broken");
    expect(footer?.bug).toBe(true);
    expect(reportHasBug(report)).toBe(true);
  });
});

test.describe("agent-skill surviving mutants", () => {
  test("invert bug/control ordering: mixed page still reports the footer bug", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.evaluate(() => {
      const pre = document.createElement("pre");
      pre.id = "code-block";
      pre.style.cssText =
        "position:fixed;top:8px;left:8px;z-index:1;width:220px;overflow-x:auto;white-space:nowrap;font:13px ui-monospace,monospace;padding:12px;background:#1c1917;color:#fff";
      const code = document.createElement("code");
      code.id = "long-text";
      code.textContent = "https://api.example.test/evt_9f3c2a";
      pre.append(code);
      document.body.append(pre);
    });
    const report = await classifyOpenPage(page);
    expect(reportHasBug(report)).toBe(true);
    expect(matchFor(report, "fixed-footer-overlap")?.bug).toBe(true);
  });

  test("accept any spacer height dies: tiny spacer on a clear footer is not control", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.className = "spacer";
      spacer.style.height = "8px";
      document.querySelector("main")?.append(spacer);
    });
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("control");
    expect(classified?.resembles).toBe("fixed");
  });

  test("remove localScroll dies: overflow-x auto without overflow is not control", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#long-text").evaluate((node) => {
      node.textContent = "ok";
    });
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).not.toBe("control");
  });

  test("remove aria check dies: painted expand without aria-expanded is not control", async ({
    page,
  }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#expand-toggle").evaluate((node) => {
      node.removeAttribute("aria-expanded");
    });
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("control");
  });

  test("footer without hit-test dies: overlap with pointer-events none is not broken", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.locator("#site-footer").evaluate((node) => {
      (node as HTMLElement).style.pointerEvents = "none";
    });
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("flex-fixed without hit-test dies: overlay on the action is not fixed", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.evaluate(() => {
      const action = document.getElementById("action");
      if (!(action instanceof HTMLElement)) {
        return;
      }
      const rect = action.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        "background:#000",
        "z-index:2147483646",
      ].join(";");
      document.documentElement.append(overlay);
    });
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).not.toBe("fixed");
  });

  test("tolerance 0 dies: 2px of slack is still fixed at 4px, not at 0", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    const card = await boundingRect(page, "#card");
    const action = await boundingRect(page, "#action");
    const shift = card.right - action.right + 2;
    await page.locator("#action").evaluate((node, dx) => {
      const el = node as HTMLElement;
      el.style.position = "relative";
      el.style.left = `${dx}px`;
    }, shift);
    const withSlack = await classifyFlexLongText(page, CLEAR_DEFECT_PX, 4);
    const withZero = await classifyFlexLongText(page, CLEAR_DEFECT_PX, 0);
    expect(withSlack?.resembles).toBe("fixed");
    expect(withZero?.resembles).not.toBe("fixed");
  });
});
