#!/usr/bin/env node
/**
 * Capture launch media from the real fixtures (Playwright) plus a real
 * `npx playwright test` transcript. Nothing is hand-drawn.
 *
 *   node scripts/capture-launch-media.mjs
 *
 * Fonts: DejaVu / Liberation (common on Linux), then optional macOS Inter /
 * JetBrains Mono if those files exist. Override with UI_BREAK_FONT_SANS_BOLD,
 * UI_BREAK_FONT_SANS, UI_BREAK_FONT_MONO, UI_BREAK_FONT_MONO_BOLD.
 *
 * Writes:
 *   docs/media/launch-ubc.mp4
 *   docs/media/launch-ubc-1080.mp4
 *   docs/media/launch-ubc.gif
 *   docs/media/spec-hit-test.png
 */
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "docs", "media");
const W = 1200;
const H = 675;
const BAR = 64;
const BG = "#f4f1ea";
const INK = "#1c1917";
const OUTLINE_BROKEN = "#ef4444";
const OUTLINE_FIXED = "#16a34a";

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
    outline: "#site-footer",
    scrollToEnd: true,
    fixedCaption: "padding-bottom reserves the footer",
  },
];

function fontCandidates(envKey, fallbacks) {
  return [process.env[envKey], ...fallbacks].filter(Boolean);
}

const FONT_CANDIDATES = {
  sansBold: fontCandidates("UI_BREAK_FONT_SANS_BOLD", [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/macos/Inter-Bold.ttf",
  ]),
  sans: fontCandidates("UI_BREAK_FONT_SANS", [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
  ]),
  mono: fontCandidates("UI_BREAK_FONT_MONO", [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf",
    "/usr/share/fonts/truetype/macos/JetBrainsMono-Regular.ttf",
  ]),
  monoBold: fontCandidates("UI_BREAK_FONT_MONO_BOLD", [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
    "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf",
    "/usr/share/fonts/truetype/macos/JetBrainsMono-Bold.ttf",
  ]),
};

async function firstReadable(paths, label) {
  for (const file of paths) {
    try {
      await access(file, constants.R_OK);
      return file;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    `No ${label} font found. Tried:\n${paths.join("\n")}\nSet UI_BREAK_FONT_* to TTF paths.`,
  );
}

async function resolveFonts() {
  const fonts = {
    sansBold: await firstReadable(FONT_CANDIDATES.sansBold, "sans bold"),
    sans: await firstReadable(FONT_CANDIDATES.sans, "sans"),
    mono: await firstReadable(FONT_CANDIDATES.mono, "mono"),
    monoBold: await firstReadable(FONT_CANDIDATES.monoBold, "mono bold"),
  };
  console.log("Fonts:");
  for (const [key, file] of Object.entries(fonts)) {
    console.log(`  ${key}: ${file}`);
  }
  return fonts;
}

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

async function injectOutline(page, selector, color) {
  await page.evaluate(
    ({ sel, outlineColor }) => {
      const target = document.querySelector(sel);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const pad = 8;
      const border = 3;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const flush = 1;

      let left = rect.left - pad;
      let top = rect.top - pad;
      let right = rect.right + pad;
      let bottom = rect.bottom + pad;

      // If a side sits on the viewport edge, pad=8 would clip the border
      // (a full-width fixed footer loses left/right/bottom and leaves only a
      // line through the overlap strip). Inset on those sides so the 3px
      // stroke stays visible inside the viewport and on the element.
      if (rect.left <= flush) {
        left = rect.left + border;
      }
      if (rect.top <= flush) {
        top = rect.top + border;
      }
      if (vw - rect.right <= flush) {
        right = rect.right - border;
      }
      if (vh - rect.bottom <= flush) {
        bottom = rect.bottom - border;
        // Bottom-flush bar: do not draw above the element — that covers the
        // overlap that proves the bug.
        top = rect.top + border;
      }

      left = Math.max(0, left);
      top = Math.max(0, top);
      right = Math.min(vw, right);
      bottom = Math.min(vh, bottom);

      const outline = document.createElement("div");
      outline.style.cssText = [
        "position:fixed",
        `left:${left}px`,
        `top:${top}px`,
        `width:${Math.max(border * 2, right - left)}px`,
        `height:${Math.max(border * 2, bottom - top)}px`,
        `border:${border}px solid ${outlineColor}`,
        "box-sizing:border-box",
        "pointer-events:none",
        "z-index:2147483646",
      ].join(";");
      document.documentElement.append(outline);
    },
    { sel: selector, outlineColor: color },
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
  const color = variant === "fixed" ? OUTLINE_FIXED : OUTLINE_BROKEN;
  await injectOutline(page, item.outline, color);
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

async function writeCard(page, tmp, name, title, subtitle, fonts) {
  const html = path.join(tmp, `${name}.html`);
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: InterB; src: url("${pathToFileURL(fonts.sansBold).href}"); font-weight: 700; }
      @font-face { font-family: InterR; src: url("${pathToFileURL(fonts.sans).href}"); font-weight: 400; }
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
        margin: 0; font: 700 44px/1.15 InterB, system-ui, sans-serif;
        letter-spacing: -0.03em;
        max-width: 1100px;
      }
      h1 .line {
        display: block;
        white-space: nowrap;
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

async function composeFixtureFrame(page, tmp, rawPng, variant, caption, fonts) {
  const html = path.join(tmp, `${path.basename(rawPng, ".png")}-frame.html`);
  const broken = variant === "broken";
  const barBg = broken ? "#7f1d1d" : "#14532d";
  const barFg = broken ? "#fff7ed" : "#ecfdf3";
  const label = broken ? "BROKEN" : "FIXED";
  const cap = !broken && caption ? caption : "";
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: InterB; src: url("${pathToFileURL(fonts.sansBold).href}"); font-weight: 700; }
      @font-face { font-family: Mono; src: url("${pathToFileURL(fonts.mono).href}"); }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: ${BG}; }
      .frame {
        width: ${W}px; height: ${H}px; display: flex; flex-direction: column;
      }
      .bar {
        height: ${BAR}px; box-sizing: border-box;
        padding: 0 24px; display: flex; align-items: center; gap: 12px;
        background: ${barBg}; color: ${barFg};
        white-space: nowrap; overflow: hidden;
      }
      .bar .kind {
        font: 700 22px/1.2 InterB, system-ui, sans-serif;
        letter-spacing: 0.06em;
        flex: 0 0 auto;
      }
      .bar .cap {
        font: 600 16px/1.3 Mono, ui-monospace, monospace;
        letter-spacing: 0;
        opacity: 0.95;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .stage {
        flex: 1; display: flex; align-items: center; justify-content: center;
        padding: 16px 24px 24px;
      }
      img {
        height: ${H - BAR - 48}px;
        width: auto;
        max-width: 1100px;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="bar"><span class="kind">${label}</span>${
        cap ? `<span class="cap">${cap.trim()}</span>` : ""
      }</div>
      <div class="stage"><img alt="" src="${pathToFileURL(rawPng).href}" /></div>
    </div>
  </body>
</html>`,
  );
  const dest = path.join(tmp, `${path.basename(rawPng, ".png")}-frame.png`);
  await screenshotHtml(page, html, dest, W, H);
  return dest;
}

async function writeTerminalFrame(page, tmp, name, transcript, fonts, size) {
  const escaped = transcript
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = path.join(tmp, `${name}.html`);
  const barH = size.barH;
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: Mono; src: url("${pathToFileURL(fonts.mono).href}"); }
      @font-face { font-family: MonoB; src: url("${pathToFileURL(fonts.monoBold).href}"); font-weight: 700; }
      html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; background: #111827; color: #e5e7eb; }
      .bar {
        height: ${barH}px; background: #1f2937; color: #9ca3af;
        font: 700 ${size.barFont}px/${barH}px MonoB, ui-monospace, monospace;
        padding: 0 ${size.pad}px;
      }
      pre {
        margin: 0; padding: ${size.pad}px;
        font: ${size.font}px/${size.lineHeight} Mono, ui-monospace, monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        height: ${size.height - barH}px; box-sizing: border-box; overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="bar">$ npx playwright test</div>
    <pre>${escaped}</pre>
  </body>
</html>`,
  );
  const dest = path.join(tmp, `${name}.png`);
  await screenshotHtml(page, html, dest, size.width, size.height);
  return dest;
}

/** Max lines in an excerpt, including the start line. hitTestCenter is 19. */
const EXCERPT_MAX_LINES = 24;

function extractIndentedBlock(
  text,
  startRe,
  { maxLines = EXCERPT_MAX_LINES, label = "excerpt" } = {},
) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) {
    return "";
  }
  const indent = lines[start].match(/^(\s*)/)[1];
  const closers = new Set([
    `${indent}}`,
    `${indent}});`,
    `${indent}})`,
    `${indent}},`,
  ]);
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length && out.length < maxLines; i += 1) {
    const line = lines[i];
    if (
      i > start &&
      indent === "" &&
      /^(export\s+)?(async\s+)?function\b/.test(line)
    ) {
      throw new Error(`${label} excerpt is unterminated`);
    }
    out.push(line);
    if (closers.has(line)) {
      return out.join("\n");
    }
  }
  if (out.length >= maxLines) {
    throw new Error(`${label} excerpt exceeded cap`);
  }
  throw new Error(`${label} excerpt is unterminated`);
}

function dedentBlock(block) {
  const lines = block.split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^(\s*)/)[1].length);
  const shift = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(shift)).join("\n");
}

function finalReturnLine(block) {
  const lines = block.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^\s*return\b/.test(lines[i])) {
      return lines[i].trim();
    }
  }
  return "";
}

async function readSource(rel) {
  return readFile(path.join(ROOT, rel), "utf8");
}

function extractFromTo(text, startRe, endRe, { maxLines = EXCERPT_MAX_LINES, label = "excerpt" } = {}) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) {
    return "";
  }
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length && out.length < maxLines; i += 1) {
    out.push(lines[i]);
    if (endRe.test(lines[i])) {
      return out.join("\n");
    }
  }
  if (out.length >= maxLines) {
    throw new Error(`${label} excerpt exceeded cap`);
  }
  throw new Error(`${label} excerpt is unterminated`);
}

async function specExcerpts() {
  const specRel = "tests/fixed-footer-overlap.spec.ts";
  const specText = await readSource(specRel);
  // Assertion block only — the full test() title is too long to set at a
  // social-readable size. This is still copied from the spec.
  const testBody = extractFromTo(
    specText,
    /const \{ action, footer, hit, position \}/,
    /expect\(hit\.hit\?\.id\)\.toBe\("site-footer"\)/,
    { label: specRel },
  );
  if (testBody.trim().length === 0) {
    throw new Error(
      `spec excerpt empty: no broken-test assertions in ${specRel}`,
    );
  }
  if (!testBody.includes("expect(")) {
    throw new Error(
      `spec excerpt for ${specRel} is missing an assertion`,
    );
  }

  const helperFiles = ["tests/helpers.ts", "skill/lib/geometry.ts"];
  let helperRel = "";
  let helperBody = "";
  for (const rel of helperFiles) {
    try {
      const text = await readSource(rel);
      const body = extractIndentedBlock(text, /function hitTestCenter\b/, {
        label: "hitTestCenter",
      });
      if (body.trim().length > 0) {
        helperRel = rel;
        helperBody = body;
        break;
      }
    } catch {
      // File may not exist on this branch (skill/lib is v0.2).
    }
  }
  if (helperBody.trim().length === 0) {
    throw new Error(
      "hitTestCenter excerpt is empty (searched tests/helpers.ts and skill/lib/geometry.ts)",
    );
  }
  const lastReturn = finalReturnLine(helperBody);
  if (!/^return\s*\{\s*x,\s*y,\s*hit,\s*target\s*\}\s*;?\s*$/.test(lastReturn)) {
    throw new Error(
      `hitTestCenter excerpt is missing its final return (last return was: ${lastReturn || "(none)"})`,
    );
  }

  return {
    left: { title: `${specRel} (excerpt)`, body: dedentBlock(testBody) },
    right: { title: `${helperRel} (excerpt)`, body: dedentBlock(helperBody) },
  };
}

async function assertSpecPanesDoNotWrap(page) {
  const panes = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.querySelectorAll("pre")].map((pre, index) => {
      const text = pre.textContent ?? "";
      const lines = text.split("\n");
      const cs = getComputedStyle(pre);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("canvas 2d unavailable");
      }
      ctx.font = cs.font;
      const overflowing = [];
      for (const line of lines) {
        const width = ctx.measureText(line).width;
        if (width > pre.clientWidth + 0.5) {
          overflowing.push({ line, width });
        }
      }
      return {
        index,
        scrollWidth: pre.scrollWidth,
        clientWidth: pre.clientWidth,
        scrollHeight: pre.scrollHeight,
        clientHeight: pre.clientHeight,
        overflowing,
        longest: Math.max(0, ...lines.map((line) => line.length)),
      };
    });
  });
  if (panes.length === 0) {
    throw new Error("spec-hit-test.png has no <pre> panes to measure");
  }
  for (const pane of panes) {
    if (pane.overflowing.length > 0) {
      const first = pane.overflowing[0];
      throw new Error(
        `spec-hit-test pane ${pane.index} line overflows (${first.width.toFixed(1)}px > ${pane.clientWidth}px): ${first.line}`,
      );
    }
    if (pane.scrollWidth > pane.clientWidth + 1) {
      throw new Error(
        `spec-hit-test pane ${pane.index} overflows horizontally (${pane.scrollWidth} > ${pane.clientWidth}; longest line ${pane.longest} chars)`,
      );
    }
    if (pane.scrollHeight > pane.clientHeight + 1) {
      throw new Error(
        `spec-hit-test pane ${pane.index} overflows vertically (${pane.scrollHeight} > ${pane.clientHeight})`,
      );
    }
  }
}

async function writeSpecPng(page, fonts) {
  const { left, right } = await specExcerpts();
  const html = path.join(os.tmpdir(), `ubc-spec-${Date.now()}.html`);
  const esc = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await writeFile(
    html,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: Mono; src: url("${pathToFileURL(fonts.mono).href}"); }
      @font-face { font-family: MonoB; src: url("${pathToFileURL(fonts.monoBold).href}"); font-weight: 700; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: #111827; color: #e5e7eb; }
      .col {
        display: flex; flex-direction: column;
        width: ${W}px; height: ${H}px;
      }
      .pane {
        flex: 1 1 0; min-height: 0; min-width: 0;
        box-sizing: border-box;
        padding: 14px 28px 10px;
        border-bottom: 1px solid #374151;
        display: flex; flex-direction: column;
      }
      .pane:last-child { border-bottom: 0; flex: 1.35 1 0; }
      h2 {
        margin: 0 0 8px; font: 700 18px/1.2 MonoB, ui-monospace, monospace;
        color: #93c5fd; letter-spacing: 0;
        flex: 0 0 auto;
      }
      pre {
        margin: 0;
        flex: 1 1 auto;
        min-height: 0;
        font: 18px/1.28 Mono, ui-monospace, monospace;
        white-space: pre;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="col">
      <div class="pane">
        <h2>${esc(left.title)}</h2>
        <pre>${esc(left.body)}</pre>
      </div>
      <div class="pane">
        <h2>${esc(right.title)}</h2>
        <pre>${esc(right.body)}</pre>
      </div>
    </div>
  </body>
</html>`,
  );
  const dest = path.join(MEDIA, "spec-hit-test.png");
  await page.setViewportSize({ width: W, height: H });
  await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pres = [...document.querySelectorAll("pre")];
    const min = 15;
    let size = 22;
    const fits = (px) => {
      for (const pre of pres) {
        pre.style.fontSize = `${px}px`;
        pre.style.lineHeight = "1.22";
      }
      for (const pre of pres) {
        const cs = getComputedStyle(pre);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("canvas 2d unavailable");
        }
        ctx.font = cs.font;
        for (const line of (pre.textContent ?? "").split("\n")) {
          if (ctx.measureText(line).width > pre.clientWidth + 0.5) {
            return false;
          }
        }
        if (pre.scrollWidth > pre.clientWidth + 1) {
          return false;
        }
        if (pre.scrollHeight > pre.clientHeight + 1) {
          return false;
        }
      }
      return true;
    };
    while (size > min && !fits(size)) {
      size -= 1;
    }
    if (!fits(size)) {
      throw new Error(`spec excerpt does not fit at ${min}px without wrapping`);
    }
  });
  await assertSpecPanesDoNotWrap(page);
  await page.screenshot({
    path: dest,
    clip: { x: 0, y: 0, width: W, height: H },
  });
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
    "-t",
    "15",
    "-r",
    "30",
    "-vf",
    sizeFilter,
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

async function padToSquare(src, dest) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    src,
    "-vf",
    "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4f1ea",
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

const CASE_SPECS = [
  "flex-long-text.spec.ts",
  "fixed-height-label.spec.ts",
  "fixed-footer-overlap.spec.ts",
];

function specIndex(line) {
  return CASE_SPECS.findIndex((spec) => line.includes(spec));
}

function trimPlaywrightOutput(stdout, stderr) {
  const text = `${stdout}${stderr}`.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""))
    .filter((line) => !line.includes("NO_COLOR"))
    .filter((line) => !line.includes("trace-warnings"))
    .filter((line) => line.trim().length > 0);

  const header = lines.find((line) => /Running \d+ tests/.test(line));
  if (!header) {
    throw new Error("Playwright transcript is missing the Running N tests header");
  }
  const summary = [...lines]
    .reverse()
    .find((line) => /\d+ passed/.test(line) && !line.includes("›"));

  const tests = lines.filter((line) => specIndex(line) >= 0);

  for (const spec of CASE_SPECS) {
    if (!tests.some((line) => line.includes(spec))) {
      throw new Error(`Playwright transcript is missing tests for ${spec}`);
    }
  }

  return [header, ...tests, summary].filter(Boolean).join("\n");
}

async function main() {
  const fonts = await resolveFonts();
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
      fonts,
    );
    const end = await writeCard(
      page,
      tmp,
      "end",
      '<span class="line">github.com/EstebanIndiveri/</span><span class="line">ui-break-cases</span>',
      "Reproducible bugs, explained fixes, tests you can reuse.",
      fonts,
    );

    const frames = [];
    for (const item of CASES) {
      for (const variant of ["broken", "fixed"]) {
        const raw = path.join(tmp, `${item.id}-${variant}-raw.png`);
        await captureVariant(page, item, variant, raw);
        const framed = await composeFixtureFrame(
          page,
          tmp,
          raw,
          variant,
          item.fixedCaption,
          fonts,
        );
        frames.push({ id: item.id, variant, file: framed });
      }
    }

    console.log("Running npx playwright test for the terminal segment…");
    const testRun = await runCapture("npx", [
      "playwright",
      "test",
      "tests/flex-long-text.spec.ts",
      "tests/fixed-height-label.spec.ts",
      "tests/fixed-footer-overlap.spec.ts",
      "--reporter=list",
      "--workers=1",
    ]);
    if (testRun.code !== 0) {
      throw new Error(
        `npx playwright test exited ${testRun.code}\n${testRun.stdout}\n${testRun.stderr}`,
      );
    }
    const transcript = trimPlaywrightOutput(testRun.stdout, testRun.stderr);
    console.log("Terminal transcript:\n" + transcript);
    const terminalWide = await writeTerminalFrame(
      page,
      tmp,
      "terminal-wide",
      transcript,
      fonts,
      {
        width: W,
        height: H,
        barH: 36,
        barFont: 16,
        font: 18,
        lineHeight: 1.4,
        pad: 20,
      },
    );
    const terminalSquare = await writeTerminalFrame(
      page,
      tmp,
      "terminal-square",
      transcript,
      fonts,
      {
        width: 1080,
        height: 1080,
        barH: 48,
        barFont: 22,
        font: 22,
        lineHeight: 1.35,
        pad: 28,
      },
    );

    await writeSpecPng(page, fonts);

    const wideEntries = [
      { file: title, duration: 1.5 },
      { file: frames[0].file, duration: 1.5 },
      { file: frames[1].file, duration: 1.5 },
      { file: frames[2].file, duration: 1.5 },
      { file: frames[3].file, duration: 1.5 },
      { file: frames[4].file, duration: 1.5 },
      { file: frames[5].file, duration: 1.5 },
      { file: terminalWide, duration: 2.5 },
      { file: end, duration: 2.0 },
    ];
    const list = path.join(tmp, "frames.txt");
    await writeFile(list, concatList(wideEntries));

    const squareEntries = [];
    for (const item of wideEntries) {
      if (item.file === terminalWide) {
        squareEntries.push({ file: terminalSquare, duration: item.duration });
        continue;
      }
      const dest = path.join(tmp, `${path.basename(item.file, ".png")}-1080.png`);
      await padToSquare(item.file, dest);
      squareEntries.push({ file: dest, duration: item.duration });
    }
    const squareList = path.join(tmp, "frames-1080.txt");
    await writeFile(squareList, concatList(squareEntries));

    const wide = path.join(MEDIA, "launch-ubc.mp4");
    const square = path.join(MEDIA, "launch-ubc-1080.mp4");
    const gif = path.join(MEDIA, "launch-ubc.gif");

    await encodeMp4(
      list,
      wide,
      `scale=${W}:${H}:flags=lanczos,pad=${W}:${H + 1}:0:0:color=0xf4f1ea,setsar=1,fps=30`,
    );
    await encodeMp4(squareList, square, "scale=1080:1080:flags=lanczos,setsar=1,fps=30");
    await encodeGif(wide, gif);

    for (const dest of [
      wide,
      square,
      gif,
      path.join(MEDIA, "spec-hit-test.png"),
    ]) {
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
