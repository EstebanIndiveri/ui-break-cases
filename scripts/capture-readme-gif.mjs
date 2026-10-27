#!/usr/bin/env node
/**
 * Capture broken/fixed screenshots of the three fixtures with Playwright,
 * draw capture-only overlays (never written into fixture CSS), compose a
 * side-by-side GIF, then encode with ffmpeg (system binary).
 *
 * Usage (from repo root, after `npm ci` and Playwright Chromium install):
 *   node scripts/capture-readme-gif.mjs
 *
 * Output: docs/media/broken-vs-fixed.gif
 *
 * Overlays are injected at capture time only: a red outline on the card,
 * clipped label, or last action, plus a large BROKEN/FIXED label. Fixture
 * layout, tests, and gallery geometry are unchanged.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "media", "broken-vs-fixed.gif");
const PANEL_WIDTH = 390;
const BG = "0xf4f1ea";

const CASES = [
  {
    id: "flex-long-text",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 210 },
    outline: "#card",
    scrollToEnd: false,
  },
  {
    id: "fixed-height-label",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 280 },
    outline: "#label",
    scrollToEnd: false,
  },
  {
    id: "fixed-footer-overlap",
    viewport: { width: 360, height: 500 },
    clip: { x: 0, y: 260, width: 360, height: 240 },
    outline: "#last-action",
    scrollToEnd: true,
  },
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
      }
    });
  });
}

async function injectCaptureOverlay(page, item, variant) {
  await page.evaluate(
    ({ selector, label, clip }) => {
      const target = document.querySelector(selector);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const outline = document.createElement("div");
      outline.setAttribute("data-capture-overlay", "outline");
      outline.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        "border:3px solid #ef4444",
        "box-sizing:border-box",
        "pointer-events:none",
        "z-index:2147483646",
      ].join(";");
      document.documentElement.append(outline);

      const badge = document.createElement("div");
      badge.setAttribute("data-capture-overlay", "label");
      badge.textContent = label;
      badge.style.cssText = [
        "position:fixed",
        `left:${clip.x + 8}px`,
        `top:${clip.y + 8}px`,
        "padding:8px 12px",
        "background:#111827",
        "color:#fff",
        "font:700 28px/1 system-ui, sans-serif",
        "letter-spacing:0.06em",
        "border-radius:8px",
        "pointer-events:none",
        "z-index:2147483647",
      ].join(";");
      document.documentElement.append(badge);
    },
    {
      selector: item.outline,
      label: variant === "broken" ? "BROKEN" : "FIXED",
      clip: item.clip,
    },
  );
}

async function captureVariant(page, item, variant, dest) {
  const file = path.join(
    ROOT,
    "public",
    "fixtures",
    item.id,
    `${variant}.html`,
  );
  await page.setViewportSize(item.viewport);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  if (item.scrollToEnd) {
    await page.evaluate(() => {
      const top = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      window.scrollTo({ top, left: 0, behavior: "instant" });
    });
  }
  await injectCaptureOverlay(page, item, variant);
  await page.screenshot({ path: dest, clip: item.clip });
}

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ubc-gif-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    for (const item of CASES) {
      for (const variant of ["broken", "fixed"]) {
        const dest = path.join(tmp, `${item.id}-${variant}.png`);
        await captureVariant(page, item, variant, dest);
      }
    }
  } finally {
    await browser.close();
  }

  for (const item of CASES) {
    for (const variant of ["broken", "fixed"]) {
      const src = path.join(tmp, `${item.id}-${variant}.png`);
      const dest = path.join(tmp, `${item.id}-${variant}-p.png`);
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        src,
        "-vf",
        `pad=${PANEL_WIDTH}:${item.clip.height}:(ow-iw)/2:0:${BG}`,
        dest,
      ]);
    }
  }

  const colGap = path.join(tmp, "col-gap.png");
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${BG}:s=8x8`,
    "-frames:v",
    "1",
    colGap,
  ]);

  const rows = [];
  for (const item of CASES) {
    const row = path.join(tmp, `row-${item.id}.png`);
    const gap = path.join(tmp, `gap-${item.id}.png`);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      colGap,
      "-vf",
      `scale=8:${item.clip.height}`,
      gap,
    ]);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(tmp, `${item.id}-broken-p.png`),
      "-i",
      gap,
      "-i",
      path.join(tmp, `${item.id}-fixed-p.png`),
      "-filter_complex",
      "hstack=inputs=3",
      row,
    ]);
    rows.push(row);
  }

  const rowGap = path.join(tmp, "row-gap.png");
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${BG}:s=${PANEL_WIDTH * 2 + 8}x8`,
    "-frames:v",
    "1",
    rowGap,
  ]);

  const composite = path.join(tmp, "composite.png");
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    rows[0],
    "-i",
    rowGap,
    "-i",
    rows[1],
    "-i",
    rowGap,
    "-i",
    rows[2],
    "-filter_complex",
    "vstack=inputs=5",
    composite,
  ]);

  const list = path.join(tmp, "frames.txt");
  await writeFile(
    list,
    [
      `file '${composite}'`,
      "duration 2.0",
      `file '${composite}'`,
      "duration 2.0",
      `file '${composite}'`,
    ].join("\n"),
  );

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-filter_complex",
    "fps=2,split[s0][s1];[s0]palettegen=max_colors=64:stats_mode=single[p];[s1][p]paletteuse=dither=none",
    "-loop",
    "0",
    OUT,
  ]);

  const info = await stat(OUT);
  console.log(`${path.relative(ROOT, OUT)} ${info.size} bytes`);
  await rm(tmp, { recursive: true, force: true });
  if (info.size >= 2_000_000) {
    throw new Error(`GIF is ${info.size} bytes; keep it under 2 MB`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
