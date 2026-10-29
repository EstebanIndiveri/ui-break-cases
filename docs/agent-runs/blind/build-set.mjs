#!/usr/bin/env node
/**
 * Rebuilds docs/agent-runs/blind/set/ from public/fixtures with a new
 * random p01–p09 order. Mapping is written OUTSIDE the repo
 * (default /tmp/ubc-blind-mapping.json). Never commit that file.
 *
 * Usage: node docs/agent-runs/blind/build-set.mjs
 *        UBC_BLIND_MAPPING=/tmp/ubc-blind-mapping.json node docs/agent-runs/blind/build-set.mjs
 */
import { randomInt } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SET = path.join(ROOT, "docs/agent-runs/blind/set");
const MAPPING = process.env.UBC_BLIND_MAPPING ?? "/tmp/ubc-blind-mapping.json";

const FIXTURES = [
  { caseId: "flex-long-text", variant: "broken", viewport: { width: 390, height: 640 } },
  { caseId: "flex-long-text", variant: "fixed", viewport: { width: 390, height: 640 } },
  { caseId: "flex-long-text", variant: "control", viewport: { width: 390, height: 640 } },
  { caseId: "fixed-height-label", variant: "broken", viewport: { width: 390, height: 640 } },
  { caseId: "fixed-height-label", variant: "fixed", viewport: { width: 390, height: 640 } },
  { caseId: "fixed-height-label", variant: "control", viewport: { width: 390, height: 640 } },
  { caseId: "fixed-footer-overlap", variant: "broken", viewport: { width: 360, height: 500 } },
  { caseId: "fixed-footer-overlap", variant: "fixed", viewport: { width: 360, height: 500 } },
  { caseId: "fixed-footer-overlap", variant: "control", viewport: { width: 360, height: 500 } },
];

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function neutralize(html, pageId) {
  let out = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>Page ${pageId}</title>`,
  );
  out = out.replace(/<p class="banner">[\s\S]*?<\/p>\s*/g, "");
  out = out.replace(/\s*\.banner\s*\{[\s\S]*?\}\s*/g, "\n");
  out = out.replace(
    /The page stays within the viewport\. Scroll the code block to read the\s+full endpoint token\./g,
    "Use the signed request payload for this event when you retry the webhook.",
  );
  out = out.replace(
    /A fixed status bar is intentional here\. Matching space is reserved at\s+the end of the document so the last control stays usable\./g,
    "This hold expires if you leave without confirming. The last control sits\n        at the end of the page.",
  );
  return out;
}

if (MAPPING.startsWith(ROOT + path.sep) || path.resolve(MAPPING) === ROOT) {
  throw new Error(`mapping path must be outside the repo: ${MAPPING}`);
}

await mkdir(SET, { recursive: true });
for (const name of await readdir(SET)) {
  await rm(path.join(SET, name), { force: true });
}

const pages = shuffle(FIXTURES).map((item, index) => ({
  ...item,
  id: `p${String(index + 1).padStart(2, "0")}`,
}));

const mapping = {};
const index = [];
for (const page of pages) {
  const src = path.join(
    ROOT,
    "public/fixtures",
    page.caseId,
    `${page.variant}.html`,
  );
  const html = neutralize(await readFile(src, "utf8"), page.id);
  const file = `${page.id}.html`;
  await writeFile(path.join(SET, file), html);
  mapping[file] = {
    caseId: page.caseId,
    variant: page.variant,
    resembles: page.variant,
    bug: page.variant === "broken",
    viewport: page.viewport,
  };
  index.push({ file, viewport: page.viewport });
}

await writeFile(
  path.join(SET, "pages.json"),
  `${JSON.stringify(index, null, 2)}\n`,
);
await mkdir(path.dirname(MAPPING), { recursive: true });
await writeFile(MAPPING, `${JSON.stringify(mapping, null, 2)}\n`);
console.log(`wrote ${pages.length} pages to ${path.relative(ROOT, SET)}`);
console.log(`wrote mapping to ${MAPPING}`);
