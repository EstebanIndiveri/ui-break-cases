#!/usr/bin/env node
/**
 * Capture broken/fixed screenshots of the three fixtures with Playwright,
 * then encode a two-frame looping GIF with ffmpeg (system binary).
 *
 * Usage (from repo root, after `npm ci` and Playwright Chromium install):
 *   node scripts/capture-readme-gif.mjs
 *
 * Output: docs/media/broken-vs-fixed.gif
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "media", "broken-vs-fixed.gif");
const PANEL_WIDTH = 320;

const CASES = [
  {
    id: "flex-long-text",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 200 },
    scrollToEnd: false,
  },
  {
    id: "fixed-height-label",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 240 },
    scrollToEnd: false,
  },
  {
    id: "fixed-footer-overlap",
    viewport: { width: 360, height: 500 },
    clip: { x: 0, y: 280, width: 360, height: 220 },
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
      const dest = path.join(tmp, `${item.id}-${variant}-w.png`);
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        src,
        "-vf",
        `scale=${PANEL_WIDTH}:-1`,
        dest,
      ]);
    }
  }

  const spacer = path.join(tmp, "spacer.png");
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0xf4f1ea:s=${PANEL_WIDTH}x4`,
    "-frames:v",
    "1",
    spacer,
  ]);

  for (const variant of ["broken", "fixed"]) {
    const stack = path.join(tmp, `stack-${variant}.png`);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(tmp, `flex-long-text-${variant}-w.png`),
      "-i",
      spacer,
      "-i",
      path.join(tmp, `fixed-height-label-${variant}-w.png`),
      "-i",
      spacer,
      "-i",
      path.join(tmp, `fixed-footer-overlap-${variant}-w.png`),
      "-filter_complex",
      "vstack=inputs=5",
      stack,
    ]);
  }

  const list = path.join(tmp, "frames.txt");
  await writeFile(
    list,
    [
      `file '${path.join(tmp, "stack-broken.png")}'`,
      "duration 1.6",
      `file '${path.join(tmp, "stack-fixed.png")}'`,
      "duration 1.6",
      `file '${path.join(tmp, "stack-fixed.png")}'`,
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
    "fps=5,split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=single[p];[s1][p]paletteuse=dither=none",
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
