#!/usr/bin/env node
/**
 * Capture broken/fixed screenshots of the fixtures with Playwright,
 * draw capture-only overlays (never written into fixture CSS), then encode
 * with ffmpeg (system binary).
 *
 * Usage (from repo root, after `npm ci` and Playwright Chromium install):
 *   node scripts/capture-readme-gif.mjs
 *   node scripts/capture-readme-gif.mjs --per-case
 *   node scripts/capture-readme-gif.mjs --social
 *
 * Outputs:
 *   docs/media/broken-vs-fixed.gif          (default)
 *   docs/media/<case-id>.gif                (--per-case)
 *   docs/media/social-preview.png           (--social) 1280×640
 *
 * Overlays are injected at capture time only. Fixture layout, tests, and
 * gallery geometry are unchanged.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "docs", "media");
const COMPOSITE_OUT = path.join(MEDIA, "broken-vs-fixed.gif");
const SOCIAL_OUT = path.join(MEDIA, "social-preview.png");
const PANEL_WIDTH = 390;
const BG = "0xf4f1ea";
const TAGLINE =
  "Reproducible UI bugs, explained fixes, and tests you can reuse.";
const FONT_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf";
const FONT_REGULAR = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf";

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

async function injectCaptureOverlay(page, item, variant, labelText) {
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

      if (label) {
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
      }
    },
    {
      selector: item.outline,
      label: labelText,
      clip: item.clip,
    },
  );
}

async function captureVariant(page, item, variant, dest, labelText, clip = item.clip) {
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
  await injectCaptureOverlay(page, item, variant, labelText);
  await page.screenshot({ path: dest, clip });
}

async function encodeGif(listPath, dest, maxBytes) {
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
    listPath,
    "-filter_complex",
    "fps=2,split[s0][s1];[s0]palettegen=max_colors=64:stats_mode=single[p];[s1][p]paletteuse=dither=none",
    "-loop",
    "0",
    dest,
  ]);
  const info = await stat(dest);
  console.log(`${path.relative(ROOT, dest)} ${info.size} bytes`);
  if (info.size >= maxBytes) {
    throw new Error(`GIF is ${info.size} bytes; keep it under ${maxBytes}`);
  }
}

async function writeComposite(tmp) {
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
  await encodeGif(list, COMPOSITE_OUT, 2_000_000);
}

async function writePerCase(tmp) {
  for (const item of CASES) {
    const broken = path.join(tmp, `${item.id}-broken-p.png`);
    const fixed = path.join(tmp, `${item.id}-fixed-p.png`);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(tmp, `${item.id}-broken.png`),
      "-vf",
      `pad=${PANEL_WIDTH}:${item.clip.height}:(ow-iw)/2:0:${BG}`,
      broken,
    ]);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(tmp, `${item.id}-fixed.png`),
      "-vf",
      `pad=${PANEL_WIDTH}:${item.clip.height}:(ow-iw)/2:0:${BG}`,
      fixed,
    ]);
    const list = path.join(tmp, `frames-${item.id}.txt`);
    await writeFile(
      list,
      [
        `file '${broken}'`,
        "duration 1.5",
        `file '${fixed}'`,
        "duration 1.5",
        `file '${fixed}'`,
      ].join("\n"),
    );
    const dest = path.join(MEDIA, `${item.id}.gif`);
    await encodeGif(list, dest, 1_000_000);
  }
}

async function writeSocial(page, tmp) {
  const flex = CASES[0];
  const socialClip = { x: 0, y: 0, width: 390, height: 260 };
  const brokenSrc = path.join(tmp, "social-flex-broken.png");
  const fixedSrc = path.join(tmp, "social-flex-fixed.png");
  const hi = await page.context().browser().newPage({ deviceScaleFactor: 2 });
  try {
    await captureVariant(hi, flex, "broken", brokenSrc, "", socialClip);
    await captureVariant(hi, flex, "fixed", fixedSrc, "", socialClip);
  } finally {
    await hi.close();
  }
  const html = path.join(tmp, "social.html");
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: InterCapture;
        src: url("file://${FONT_BOLD}");
        font-weight: 700;
      }
      @font-face {
        font-family: InterCapture;
        src: url("file://${FONT_REGULAR}");
        font-weight: 400;
      }
      html, body {
        margin: 0;
        width: 1280px;
        height: 640px;
        background: #f4f1ea;
        color: #1c1917;
        font-family: InterCapture, system-ui, sans-serif;
      }
      .wrap {
        box-sizing: border-box;
        width: 1280px;
        height: 640px;
        padding: 40px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      header { text-align: center; }
      h1 {
        margin: 0;
        font-size: 52px;
        line-height: 1.05;
        letter-spacing: -0.04em;
        font-weight: 700;
      }
      .tagline {
        margin: 8px 0 0;
        font-size: 22px;
        line-height: 1.3;
        font-weight: 400;
        color: #44403c;
      }
      .row {
        display: flex;
        gap: 20px;
        justify-content: center;
        flex: 1;
        min-height: 0;
      }
      figure {
        margin: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        min-height: 0;
      }
      figcaption {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .broken { color: #9f1239; }
      .fixed { color: #047857; }
      .frame {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
        border: 1px solid #d6d3d1;
        border-radius: 12px;
        background: #fff;
      }
      .frame img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        display: block;
      }
      .sub {
        margin: 0;
        text-align: center;
        font-size: 16px;
        line-height: 1.3;
        font-weight: 400;
        color: #57534e;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>ui-break-cases</h1>
        <p class="tagline">${TAGLINE}</p>
      </header>
      <div class="row">
        <figure>
          <figcaption class="broken">BROKEN</figcaption>
          <div class="frame"><img src="${pathToFileURL(brokenSrc).href}" alt="" /></div>
        </figure>
        <figure>
          <figcaption class="fixed">FIXED</figcaption>
          <div class="frame"><img src="${pathToFileURL(fixedSrc).href}" alt="" /></div>
        </figure>
      </div>
      <p class="sub">flexbox overflow · clipped text · fixed footer overlap — Playwright tests</p>
    </div>
  </body>
</html>
`,
  );
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await page.screenshot({ path: SOCIAL_OUT, clip: { x: 0, y: 0, width: 1280, height: 640 } });
  const info = await stat(SOCIAL_OUT);
  console.log(`${path.relative(ROOT, SOCIAL_OUT)} ${info.size} bytes`);
  if (info.size >= 1_000_000) {
    throw new Error(`social preview is ${info.size} bytes; keep it under 1 MB`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const perCase = args.includes("--per-case");
  const social = args.includes("--social");
  const composite = args.includes("--composite") || (!perCase && !social);

  await mkdir(MEDIA, { recursive: true });
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ubc-gif-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    for (const item of CASES) {
      for (const variant of ["broken", "fixed"]) {
        const dest = path.join(tmp, `${item.id}-${variant}.png`);
        const label = variant === "broken" ? "BROKEN" : "FIXED";
        await captureVariant(page, item, variant, dest, label);
      }
    }
    if (composite) {
      await writeComposite(tmp);
    }
    if (perCase) {
      await writePerCase(tmp);
    }
    if (social) {
      await writeSocial(page, tmp);
    }
  } finally {
    await browser.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
