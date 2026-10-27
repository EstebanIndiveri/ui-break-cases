import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { cases } from "../src/cases.ts";
import { openFixture, scrollToDocumentEnd } from "./helpers.ts";
import type { VariantId } from "../src/types.ts";

const VARIANTS: VariantId[] = ["broken", "fixed", "control"];
const outDir = path.join(process.cwd(), "artifacts", "screenshots");

test.describe("evidence screenshots", () => {
  test("capture gallery and all nine variants", async ({ page }) => {
    await mkdir(outDir, { recursive: true });

    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("./?case=flex-long-text&variant=broken");
    await page.screenshot({
      path: path.join(outDir, "gallery-desktop.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("./?case=fixed-footer-overlap&variant=broken");
    await page.screenshot({
      path: path.join(outDir, "gallery-small.png"),
      fullPage: true,
    });

    for (const item of cases) {
      for (const variant of VARIANTS) {
        await openFixture(page, item.variants[variant].path, item.viewport);
        if (item.id === "fixed-footer-overlap") {
          await scrollToDocumentEnd(page);
        }
        await page.screenshot({
          path: path.join(outDir, `${item.id}-${variant}.png`),
          fullPage: false,
        });
      }
    }
  });
});
