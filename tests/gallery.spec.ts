import { expect, test } from "@playwright/test";
import { cases } from "../src/cases.ts";
import type { VariantId } from "../src/types.ts";

const VARIANTS: VariantId[] = ["broken", "fixed", "control"];

test.describe("gallery", () => {
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
