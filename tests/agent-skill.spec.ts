import { expect, test } from "@playwright/test";
import { cases, getCase } from "../src/cases.ts";
import {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  computedOverflowX,
  documentHorizontalOverflow,
  hitTestCenter,
  horizontalOverflow,
  isClearFlexOverflow,
  isPainted,
  openFixture,
  overflowXAllowsScroll,
  overlapHeight,
  scrollMetrics,
  scrollToDocumentEnd,
} from "./helpers.ts";
import {
  overflowIsHidden,
  textRangeClip,
} from "../skill/lib/geometry.ts";
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

  test("N3 label expandPainted dies: display:none expand is not control", async ({
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
    const withSlack = await classifyFlexLongText(page);
    const withZero = await classifyFlexLongText(page, CLEAR_DEFECT_PX, 0);
    expect(GEOM_TOLERANCE_PX).toBe(4);
    expect(withSlack?.resembles).toBe("fixed");
    expect(withZero?.resembles).not.toBe("fixed");
  });

  test("4-16px band dies: 10px of flex overflow is not broken at CLEAR_DEFECT_PX", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    const card = await boundingRect(page, "#card");
    const action = await boundingRect(page, "#action");
    const shift = card.right - action.right + 10;
    await page.locator("#action").evaluate((node, dx) => {
      const el = node as HTMLElement;
      el.style.position = "relative";
      el.style.left = `${dx}px`;
    }, shift);
    const text = await boundingRect(page, "#long-text");
    const moved = await boundingRect(page, "#action");
    const overflow = Math.max(
      horizontalOverflow(text, card),
      horizontalOverflow(moved, card),
    );
    expect(overflow).toBeGreaterThan(GEOM_TOLERANCE_PX);
    expect(overflow).toBeLessThanOrEqual(CLEAR_DEFECT_PX);
    expect(isClearFlexOverflow(overflow, moved.right, card.right)).toBe(false);
    expect(isClearFlexOverflow(overflow, moved.right, card.right, 4)).toBe(true);
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("position:fixed check dies: absolute footer overlap is not this case", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.locator("#site-footer").evaluate((node) => {
      const el = node as HTMLElement;
      el.style.position = "absolute";
    });
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified).toBeNull();
  });

  test("pageContained dies: local scroll plus page overflow is not control", async ({
    page,
  }) => {
    const spec = getCase("flex-long-text");
    if (!spec) {
      throw new Error("flex-long-text missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.evaluate(() => {
      const wide = document.createElement("div");
      wide.style.cssText = "width:2400px;height:1px";
      document.body.append(wide);
    });
    const classified = await classifyFlexLongText(page);
    expect(classified?.resembles).not.toBe("control");
  });

  test("label hidden check dies: visible overflow on a tall sentence is not broken", async ({
    page,
  }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.locator("#label").evaluate((node) => {
      const el = node as HTMLElement;
      el.style.overflow = "visible";
      el.style.height = "24px";
    });
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("label clip threshold dies: 8px of clip is not broken", async ({
    page,
  }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.broken.path, spec.viewport);
    await page.locator("#label").evaluate((node) => {
      const el = node as HTMLElement;
      el.style.height = "auto";
      el.style.overflow = "hidden";
      const full = el.scrollHeight;
      el.style.height = `${Math.max(8, full - 8)}px`;
    });
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("N7 footer 4-16px band dies: 10px overlap with hit on footer is not broken", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.evaluate(() => {
      const main = document.querySelector("main");
      const action = document.getElementById("last-action");
      if (!(main instanceof HTMLElement) || !(action instanceof HTMLElement)) {
        return;
      }
      main.style.paddingBottom = "62px";
      action.style.minHeight = "16px";
      action.style.height = "16px";
      action.style.padding = "0";
    });
    await scrollToDocumentEnd(page);
    const action = await boundingRect(page, "#last-action");
    const footer = await boundingRect(page, "#site-footer");
    const overlap = overlapHeight(action, footer);
    const hit = await hitTestCenter(page, "#last-action");
    expect(overlap).toBeGreaterThan(GEOM_TOLERANCE_PX);
    expect(overlap).toBeLessThanOrEqual(CLEAR_DEFECT_PX);
    expect(hit.hit?.id).toBe("site-footer");
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("N18 footer 4-16px band dies: 10px overlap with hittable action is not fixed", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!(main instanceof HTMLElement)) {
        return;
      }
      main.style.paddingBottom = "62px";
    });
    await scrollToDocumentEnd(page);
    const action = await boundingRect(page, "#last-action");
    const footer = await boundingRect(page, "#site-footer");
    const overlap = overlapHeight(action, footer);
    const hit = await hitTestCenter(page, "#last-action");
    expect(overlap).toBeGreaterThan(GEOM_TOLERANCE_PX);
    expect(overlap).toBeLessThanOrEqual(CLEAR_DEFECT_PX);
    expect(hit.hit?.id).toBe("last-action");
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("fixed");
    expect(classified?.resembles).not.toBe("control");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("N5 footer clear without hit-test dies: overlay on a reserved-space action is not fixed", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await scrollToDocumentEnd(page);
    await page.evaluate(() => {
      const action = document.getElementById("last-action");
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
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("fixed");
    expect(classified?.resembles).not.toBe("control");
  });

  test("N18 footer clear without bottom check dies: action below a top-fixed bar is not fixed", async ({
    page,
  }) => {
    const spec = getCase("fixed-footer-overlap");
    if (!spec) {
      throw new Error("fixed-footer-overlap missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.evaluate(() => {
      const footer = document.getElementById("site-footer");
      if (!(footer instanceof HTMLElement)) {
        return;
      }
      footer.style.bottom = "auto";
      footer.style.top = "0";
    });
    await scrollToDocumentEnd(page);
    const action = await boundingRect(page, "#last-action");
    const footer = await boundingRect(page, "#site-footer");
    const overlap = overlapHeight(action, footer);
    const hit = await hitTestCenter(page, "#last-action");
    expect(overlap).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(action.bottom).toBeGreaterThan(footer.top + GEOM_TOLERANCE_PX);
    expect(hit.hit?.id).toBe("last-action");
    const classified = await classifyFixedFooterOverlap(page);
    expect(classified?.resembles).not.toBe("fixed");
    expect(classified?.resembles).not.toBe("control");
  });

  test("painted expand without clip is not control", async ({ page }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#label").evaluate((node) => {
      const el = node as HTMLElement;
      el.classList.remove("is-collapsed");
      el.style.height = "auto";
      el.style.overflow = "visible";
    });
    expect(await isPainted(page, "#expand-toggle")).toBe(true);
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("control");
  });

  test("N4 label hidden check dies: overflow visible with 47px spill is not control", async ({
    page,
  }) => {
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.control.path, spec.viewport);
    await page.locator("#label").evaluate((node) => {
      const el = node as HTMLElement;
      el.classList.remove("is-collapsed");
      el.style.overflow = "visible";
      el.style.height = "auto";
    });
    const natural = await page.locator("#label").evaluate((node) => {
      return node.getBoundingClientRect().height;
    });
    await page.locator("#label").evaluate((node, height) => {
      (node as HTMLElement).style.height = `${height}px`;
    }, natural - 47);
    const clip = await textRangeClip(page, "#label");
    expect(overflowIsHidden(clip)).toBe(false);
    expect(clip.clippedBottom).toBeGreaterThan(CLEAR_DEFECT_PX);
    expect(clip.clippedBottom).toBeGreaterThan(40);
    expect(clip.clippedBottom).toBeLessThan(55);
    expect(await isPainted(page, "#expand-toggle")).toBe(true);
    const classified = await classifyFixedHeightLabel(page);
    // Original returns null. Removing `hidden &&` at the control gate
    // would label this "control".
    expect(classified).toBeNull();
  });

  test("clipped label with painted expand and no aria is not broken", async ({
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
    expect(await isPainted(page, "#expand-toggle")).toBe(true);
    const classified = await classifyFixedHeightLabel(page);
    expect(classified?.resembles).not.toBe("broken");
    expect(classified?.bug ?? false).toBe(false);
  });

  test("N12 hidden overflow with fitting text is not fixed", async ({
    page,
  }) => {
    // skill/cases/fixed-height-label.md: fixed requires overflow is not hidden.
    // A clipping box that currently holds the string is unclassified, not the
    // recovery path. Removing `!hidden &&` would return "fixed".
    const spec = getCase("fixed-height-label");
    if (!spec) {
      throw new Error("fixed-height-label missing");
    }
    await openFixture(page, spec.variants.fixed.path, spec.viewport);
    await page.locator("#label").evaluate((node) => {
      const el = node as HTMLElement;
      el.style.overflow = "hidden";
      el.style.height = "auto";
    });
    const clip = await textRangeClip(page, "#label");
    expect(overflowIsHidden(clip)).toBe(true);
    expect(clip.clippedBottom).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(clip.clippedRight).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    const classified = await classifyFixedHeightLabel(page);
    expect(classified).toBeNull();
  });
});
