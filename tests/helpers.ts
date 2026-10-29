import type { Page } from "@playwright/test";
import { openPage, type Viewport } from "../skill/lib/geometry.ts";

/**
 * Re-export the portable geometry helpers. Fixture tests in this repo keep
 * importing from here; generated skill tests import `skill/lib/geometry.ts`
 * so they do not need `../../src` or `../../tests`.
 */
export {
  CLEAR_DEFECT_PX,
  GEOM_TOLERANCE_PX,
  boundingRect,
  clickCenter,
  computedOverflowX,
  documentHorizontalOverflow,
  expectInViewport,
  expectInside,
  hitTestCenter,
  horizontalOverflow,
  isClearFlexOverflow,
  isPainted,
  openPage,
  overflowIsHidden,
  overflowXAllowsScroll,
  overlapHeight,
  readText,
  scrollMetrics,
  scrollToDocumentEnd,
  textRangeClip,
} from "../skill/lib/geometry.ts";
export type { DomRect, Hit, Viewport } from "../skill/lib/geometry.ts";

export async function openFixture(
  page: Page,
  fixturePath: string,
  viewport: Viewport,
): Promise<void> {
  await openPage(page, fixturePath, viewport);
}
