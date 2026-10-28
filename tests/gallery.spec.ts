import { expect, test } from "@playwright/test";
import { cases } from "../src/cases.ts";
import type { VariantId } from "../src/types.ts";

const VARIANTS: VariantId[] = ["broken", "fixed", "control"];

test.describe("gallery", () => {
  test("selecting a case keeps keyboard focus on its navigation button", async ({ page }) => {
    await page.goto("./");
    const nextCase = page.getByRole("button", { name: cases[1].title });
    await nextCase.focus();
    await page.keyboard.press("Enter");

    await expect(nextCase).toBeFocused();
    await expect(nextCase).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("heading", { level: 2, name: cases[1].title })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: cases[2].title })).toBeFocused();
  });

  test("keyboard can move across variants and the iframe keeps the fixture path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./");

    const flex = cases[0];
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "ui-break-cases",
    );
    await expect(page.getByRole("button", { name: flex.title })).toHaveAttribute(
      "aria-current",
      "true",
    );

    const broken = page.getByRole("tab", { name: "Broken" });
    await broken.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("tab", { name: "Fixed" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/case=flex-long-text/);
    await expect(page).toHaveURL(/variant=fixed/);

    const iframe = page.locator("iframe[data-preview]");
    await expect(iframe).toHaveAttribute(
      "src",
      new RegExp(`${flex.variants.fixed.path}$`),
    );
    await expect(iframe).toHaveAttribute("width", String(flex.viewport.width));
    await expect(iframe).toHaveAttribute("height", String(flex.viewport.height));

    const panel = page.getByRole("tabpanel");
    await expect(panel).toHaveAttribute("id", "preview");
    await expect(panel).toHaveAttribute("aria-labelledby", "tab-fixed");
    await expect(page.getByRole("tab", { name: "Fixed" })).toHaveAttribute(
      "aria-controls",
      "preview",
    );
    await expect(page.locator(".panel")).not.toHaveAttribute("aria-live");
  });

  test("Home and End move to the first and last variant tabs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./?case=flex-long-text&variant=fixed");

    const flex = cases[0];
    await page.getByRole("tab", { name: "Fixed" }).focus();
    await page.keyboard.press("End");

    await expect(page.getByRole("tab", { name: "Control" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/variant=control/);
    await expect(page.locator("iframe[data-preview]")).toHaveAttribute(
      "src",
      new RegExp(`${flex.variants.control.path}$`),
    );

    await page.keyboard.press("Home");

    await expect(page.getByRole("tab", { name: "Broken" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/variant=broken/);
    await expect(page.locator("iframe[data-preview]")).toHaveAttribute(
      "src",
      new RegExp(`${flex.variants.broken.path}$`),
    );
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "tab-broken",
    );
  });

  test("gallery lists provenance sources and further-reading links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./?case=flex-long-text&variant=broken");

    const spec = cases[0];
    for (const source of spec.provenance.sources) {
      await expect(page.getByRole("link", { name: source.label })).toHaveAttribute(
        "href",
        source.href,
      );
    }
    for (const item of spec.links) {
      await expect(page.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  test("footer preview stays at the declared height instead of growing with content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("./?case=fixed-footer-overlap&variant=broken");

    const footerCase = cases.find((item) => item.id === "fixed-footer-overlap");
    if (!footerCase) {
      throw new Error("missing footer case");
    }

    const iframe = page.locator("iframe[data-preview]");
    await expect(iframe).toHaveAttribute(
      "src",
      new RegExp(`${footerCase.variants.broken.path}$`),
    );
    await expect(iframe).toHaveAttribute(
      "height",
      String(footerCase.viewport.height),
    );
    const height = await iframe.evaluate((node) => {
      return (node as HTMLIFrameElement).getAttribute("height");
    });
    expect(height).toBe("500");
  });

  test("production server exposes every standalone fixture path", async ({
    request,
  }) => {
    for (const item of cases) {
      for (const variant of VARIANTS) {
        const path = item.variants[variant].path;
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        const body = await response.text();
        expect(body.toLowerCase()).toContain("<!doctype html>");
        expect(body.replace(/\s+/g, " ")).toContain(item.sharedContent);
      }
    }
  });
});
