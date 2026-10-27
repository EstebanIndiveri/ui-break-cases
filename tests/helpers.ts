import { expect, type Locator, type Page } from "@playwright/test";
import type { Viewport } from "../src/types.ts";

/**
 * Geometric slack for these fixtures only.
 * Defects are built to exceed CLEAR_DEFECT_PX so a 1px font difference cannot flip the result.
 */
export const GEOM_TOLERANCE_PX = 4;
export const CLEAR_DEFECT_PX = 16;

export type DomRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type Hit = {
  id: string;
  tag: string;
};

export async function openFixture(
  page: Page,
  fixturePath: string,
  viewport: Viewport,
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(fixturePath, { waitUntil: "load" });
}

export async function readText(locator: Locator): Promise<string> {
  const text = await locator.innerText();
  return text.replace(/\s+/g, " ").trim();
}

export async function boundingRect(
  page: Page,
  selector: string,
): Promise<DomRect> {
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  });
}

export function overlapHeight(a: DomRect, b: DomRect): number {
  return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

export function horizontalOverflow(inner: DomRect, outer: DomRect): number {
  return Math.max(0, inner.right - outer.right, outer.left - inner.left);
}

export async function documentHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
}

export async function scrollMetrics(
  page: Page,
  selector: string,
): Promise<{ scrollWidth: number; clientWidth: number; scrollLeft: number }> {
  return page.locator(selector).evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    scrollLeft: node.scrollLeft,
  }));
}

export async function textRangeClip(page: Page, selector: string): Promise<{
  overflowX: string;
  overflowY: string;
  overflow: string;
  box: DomRect;
  rects: DomRect[];
  clippedBottom: number;
  clippedRight: number;
}> {
  return page.locator(selector).evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    }));
    const box = node.getBoundingClientRect();
    const mappedBox = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
    };
    const style = getComputedStyle(node);
    const clippedBottom = rects.reduce(
      (max, rect) => Math.max(max, rect.bottom - mappedBox.bottom),
      0,
    );
    const clippedRight = rects.reduce(
      (max, rect) => Math.max(max, rect.right - mappedBox.right),
      0,
    );
    return {
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      overflow: style.overflow,
      box: mappedBox,
      rects,
      clippedBottom,
      clippedRight,
    };
  });
}

export function overflowIsHidden(clip: {
  overflow: string;
  overflowX: string;
  overflowY: string;
}): boolean {
  const values = [clip.overflow, clip.overflowX, clip.overflowY];
  return values.some((value) => value === "hidden" || value === "clip");
}

/**
 * Click the already-measured center. Do not use locator.click — that can
 * scrollIntoView and hide an overlap or overflow defect.
 */
export async function clickCenter(
  page: Page,
  point: { x: number; y: number },
): Promise<void> {
  await page.mouse.click(point.x, point.y);
}

/**
 * Hit-test the center of an element before any click that could scroll it into view.
 */
export async function hitTestCenter(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number; hit: Hit | null; target: DomRect }> {
  const target = await boundingRect(page, selector);
  const x = target.left + target.width / 2;
  const y = target.top + target.height / 2;
  const hit = await page.evaluate(
    ({ x: px, y: py }) => {
      const node = document.elementFromPoint(px, py);
      if (!node || !(node instanceof HTMLElement)) {
        return null;
      }
      return { id: node.id, tag: node.tagName.toLowerCase() };
    },
    { x, y },
  );
  return { x, y, hit, target };
}

export async function scrollToDocumentEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    const top = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    window.scrollTo({ top, left: 0, behavior: "instant" });
  });
}

export function expectInside(
  inner: DomRect,
  outer: DomRect,
  tolerance = GEOM_TOLERANCE_PX,
): void {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance);
}

export function expectInViewport(
  rect: DomRect,
  viewport: Viewport,
  tolerance = GEOM_TOLERANCE_PX,
): void {
  expect(rect.left).toBeGreaterThanOrEqual(-tolerance);
  expect(rect.top).toBeGreaterThanOrEqual(-tolerance);
  expect(rect.right).toBeLessThanOrEqual(viewport.width + tolerance);
  expect(rect.bottom).toBeLessThanOrEqual(viewport.height + tolerance);
}
