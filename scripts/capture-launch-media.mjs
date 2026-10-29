#!/usr/bin/env node
/**
 * Capture launch media from the real fixtures (Playwright) plus a real
 * `npx playwright test` transcript. Nothing is hand-drawn.
 *
 *   node scripts/capture-launch-media.mjs
 *
 * Writes:
 *   docs/media/launch-ubc.mp4
 *   docs/media/launch-ubc-1080.mp4
 *   docs/media/launch-ubc.gif
 *   docs/media/spec-hit-test.png
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "docs", "media");
const W = 1200;
const H = 675;
const BG = "#f4f1ea";
const INK = "#1c1917";
const FONT_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf";
const FONT_REGULAR = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf";
const FONT_MONO = "/usr/share/fonts/truetype/macos/JetBrainsMono-Regular.ttf";
const FONT_MONO_BOLD = "/usr/share/fonts/truetype/macos/JetBrainsMono-Bold.ttf";

const CASES = [
  {
    id: "flex-long-text",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 260 },
    outline: "#card",
    scrollToEnd: false,
    fixedCaption: "min-width: 0; overflow-wrap: anywhere",
  },
  {
    id: "fixed-height-label",
    viewport: { width: 390, height: 640 },
    clip: { x: 0, y: 0, width: 390, height: 320 },
    outline: "#label",
    scrollToEnd: false,
    fixedCaption: "height: auto; overflow: visible",
  },
  {
    id: "fixed-footer-overlap",
    viewport: { width: 360, height: 500 },
    clip: { x: 0, y: 220, width: 360, height: 280 },
    outline: "#last-action",
    scrollToEnd: true,
    fixedCaption: "padding-bottom reserves the footer",
  },
];

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...opts });
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

function runCapture(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "1" },
      ...opts,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function injectOverlay(page, item, labelText, caption) {
  await page.evaluate(
    ({ selector, label, clip, captionText }) => {
      const target = document.querySelector(selector);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const outline = document.createElement("div");
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
      badge.textContent = label;
      badge.style.cssText = [
        "position:fixed",
        `left:${clip.x + 8}px`,
        `top:${clip.y + 8}px`,
        "padding:8px 12px",
        "background:#111827",
        "color:#fff",
        "font:700 22px/1 system-ui, sans-serif",
        "letter-spacing:0.06em",
        "border-radius:8px",
        "pointer-events:none",
        "z-index:2147483647",
      ].join(";");
      document.documentElement.append(badge);

      if (captionText) {
        const cap = document.createElement("div");
        cap.textContent = captionText;
        cap.style.cssText = [
          "position:fixed",
          `left:${clip.x + 8}px`,
          `top:${clip.y + 44}px`,
          "padding:6px 10px",
          "background:#047857",
          "color:#ecfdf3",
          "font:600 14px/1.3 ui-monospace, monospace",
          "border-radius:6px",
          "pointer-events:none",
          "z-index:2147483647",
          "max-width:340px",
        ].join(";");
        document.documentElement.append(cap);
      }
    },
    {
      selector: item.outline,
      label: labelText,
      clip: item.clip,
      captionText: caption ?? "",
    },
  );
}

async function captureVariant(page, item, variant, dest) {
  const file = path.join(ROOT, "public", "fixtures", item.id, `${variant}.html`);
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
  const label = variant === "broken" ? "BROKEN" : "FIXED";
  const caption = variant === "fixed" ? item.fixedCaption : "";
  await injectOverlay(page, item, label, caption);
  await page.screenshot({ path: dest, clip: item.clip });
}

async function screenshotHtml(page, htmlPath, dest, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.screenshot({
    path: dest,
    clip: { x: 0, y: 0, width, height },
  });
}

async function writeCard(page, tmp, name, title, subtitle) {
  const html = path.join(tmp, `${name}.html`);
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: InterB; src: url("file://${FONT_BOLD}"); font-weight: 700; }
      @font-face { font-family: InterR; src: url("file://${FONT_REGULAR}"); font-weight: 400; }
      html, body {
        margin: 0; width: ${W}px; height: ${H}px;
        background: ${BG}; color: ${INK};
      }
      .wrap {
        box-sizing: border-box; width: ${W}px; height: ${H}px;
        display: flex; flex-direction: column; justify-content: center;
        align-items: center; padding: 64px; text-align: center; gap: 18px;
      }
      h1 {
        margin: 0; font: 700 52px/1.1 InterB, system-ui, sans-serif;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0; font: 400 26px/1.35 InterR, system-ui, sans-serif;
        color: #44403c; max-width: 920px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
  </body>
</html>`,
  );
  const dest = path.join(tmp, `${name}.png`);
  await screenshotHtml(page, html, dest, W, H);
  return dest;
}

async function padToFrame(src, dest) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    src,
    "-vf",
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea`,
    dest,
  ]);
}

async function writeTerminalFrame(page, tmp, transcript) {
  const escaped = transcript
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = path.join(tmp, "terminal.html");
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: Mono; src: url("file://${FONT_MONO}"); }
      @font-face { font-family: MonoB; src: url("file://${FONT_MONO_BOLD}"); font-weight: 700; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: #111827; color: #e5e7eb; }
      .bar {
        height: 36px; background: #1f2937; color: #9ca3af;
        font: 700 16px/36px MonoB, ui-monospace, monospace;
        padding: 0 16px;
      }
      pre {
        margin: 0; padding: 16px 20px;
        font: 20px/1.35 Mono, ui-monospace, monospace;
        white-space: pre; overflow: hidden;
        height: ${H - 36}px; box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div class="bar">$ npx playwright test</div>
    <pre>${escaped}</pre>
  </body>
</html>`,
  );
  const dest = path.join(tmp, "terminal.png");
  await screenshotHtml(page, html, dest, W, H);
  return dest;
}

function specExcerpts() {
  const left = `async function measureAtEnd(page) {
  await scrollToDocumentEnd(page);
  const action = await boundingRect(page, "#last-action");
  const footer = await boundingRect(page, "#site-footer");
  const hit = await hitTestCenter(page, "#last-action");
  return { action, footer, hit };
}

const { action, footer, hit } = await measureAtEnd(page);
expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);
expect(hit.hit?.id).toBe("site-footer");`;

  const right = `export async function hitTestCenter(page, selector) {
  const target = await boundingRect(page, selector);
  const x = target.left + target.width / 2;
  const y = target.top + target.height / 2;
  const hit = await page.evaluate(({ x: px, y: py }) => {
    const node = document.elementFromPoint(px, py);
    if (!node || !(node instanceof HTMLElement)) {
      return null;
    }
    return { id: node.id, tag: node.tagName.toLowerCase() };
  }, { x, y });
  return { x, y, hit, target };
}`;
  return { left, right };
}

async function writeSpecPng(page) {
  const { left, right } = specExcerpts();
  const html = path.join(os.tmpdir(), `ubc-spec-${Date.now()}.html`);
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: Mono; src: url("file://${FONT_MONO}"); }
      @font-face { font-family: MonoB; src: url("file://${FONT_MONO_BOLD}"); font-weight: 700; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: #111827; color: #e5e7eb; }
      .row { display: flex; height: ${H}px; }
      .pane {
        flex: 1; min-width: 0; box-sizing: border-box;
        padding: 16px 18px 14px; border-right: 1px solid #374151;
      }
      .pane:last-child { border-right: 0; }
      h2 {
        margin: 0 0 10px; font: 700 18px/1.2 MonoB, ui-monospace, monospace;
        color: #93c5fd; letter-spacing: 0;
      }
      pre {
        margin: 0; font: 20px/1.36 Mono, ui-monospace, monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .hi { color: #fbbf24; }
    </style>
  </head>
  <body>
    <div class="row">
      <div class="pane">
        <h2>tests/fixed-footer-overlap.spec.ts</h2>
        <pre>${left.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
      </div>
      <div class="pane">
        <h2>tests/helpers.ts · hitTestCenter()</h2>
        <pre>${right.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
      </div>
    </div>
  </body>
</html>`,
  );
  const dest = path.join(MEDIA, "spec-hit-test.png");
  await screenshotHtml(page, html, dest, W, H);
  await rm(html, { force: true });
  return dest;
}

function concatList(entries) {
  const lines = [];
  for (const item of entries) {
    lines.push(`file '${item.file}'`);
    lines.push(`duration ${item.duration}`);
  }
  lines.push(`file '${entries[entries.length - 1].file}'`);
  return lines.join("\n");
}

async function encodeMp4(listPath, dest, sizeFilter) {
  // yuv420p needs even height; 675 is odd, so pad 1px then crop is skipped:
  // scale/pad to requested even canvas (1200x676) after the 1200x675 frames.
  const vf = sizeFilter;
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
    "-r",
    "30",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    dest,
  ]);
}

async function encodeGif(srcMp4, dest) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    srcMp4,
    "-vf",
    "fps=12,scale=800:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=none",
    "-loop",
    "0",
    dest,
  ]);
}

function trimPlaywrightOutput(stdout, stderr) {
  const text = `${stdout}${stderr}`.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .filter((line) => !line.includes("NO_COLOR"))
    .filter((line) => !line.includes("trace-warnings"));
  const start = lines.findIndex((line) => /Running \d+ tests/.test(line));
  const sliced = start >= 0 ? lines.slice(start) : lines;
  const keep = sliced.filter((line) => line.trim().length > 0).slice(-18);
  return keep.join("\n");
}

async function main() {
  await mkdir(MEDIA, { recursive: true });
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ubc-launch-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    const title = await writeCard(
      page,
      tmp,
      "title",
      "ui-break-cases",
      "3 CSS layout bugs · broken / fixed / control + a Playwright test",
    );
    const end = await writeCard(
      page,
      tmp,
      "end",
      "github.com/EstebanIndiveri/ui-break-cases",
      "Reproducible bugs, explained fixes, tests you can reuse.",
    );

    const frames = [];
    for (const item of CASES) {
      for (const variant of ["broken", "fixed"]) {
        const raw = path.join(tmp, `${item.id}-${variant}-raw.png`);
        const framed = path.join(tmp, `${item.id}-${variant}.png`);
        await captureVariant(page, item, variant, raw);
        await padToFrame(raw, framed);
        frames.push({ id: item.id, variant, file: framed });
      }
    }

    console.log("Running npx playwright test for the terminal segment…");
    const testRun = await runCapture("npx", ["playwright", "test", "--reporter=list"]);
    if (testRun.code !== 0) {
      throw new Error(`npx playwright test exited ${testRun.code}\n${testRun.stdout}\n${testRun.stderr}`);
    }
    const transcript = trimPlaywrightOutput(testRun.stdout, testRun.stderr);
    const terminal = await writeTerminalFrame(page, tmp, transcript);

    await writeSpecPng(page);

    const list = path.join(tmp, "frames.txt");
    await writeFile(
      list,
      concatList([
        { file: title, duration: 1.5 },
        { file: frames[0].file, duration: 1.5 },
        { file: frames[1].file, duration: 1.5 },
        { file: frames[2].file, duration: 1.5 },
        { file: frames[3].file, duration: 1.5 },
        { file: frames[4].file, duration: 1.5 },
        { file: frames[5].file, duration: 1.5 },
        { file: terminal, duration: 2.5 },
        { file: end, duration: 2.0 },
      ]),
    );

    const wide = path.join(MEDIA, "launch-ubc.mp4");
    const square = path.join(MEDIA, "launch-ubc-1080.mp4");
    const gif = path.join(MEDIA, "launch-ubc.gif");

    // 1200×675 is odd in height; pad 1 px so H.264 yuv420p is valid.
    await encodeMp4(
      list,
      wide,
      `scale=${W}:${H}:flags=lanczos,pad=${W}:${H + 1}:0:0:color=0xf4f1ea,setsar=1,fps=30`,
    );
    await encodeMp4(
      list,
      square,
      "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea,setsar=1,fps=30",
    );
    await encodeGif(wide, gif);

    for (const dest of [wide, square, gif, path.join(MEDIA, "spec-hit-test.png")]) {
      const info = await stat(dest);
      console.log(`${path.relative(ROOT, dest)} ${info.size} bytes`);
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
