#!/usr/bin/env node
/**
 * Rebuilds docs/agent-runs/blind/set/ from public/fixtures.
 * Mapping stays in docs/agent-runs/blind/mapping.json (outside the set).
 * A blind agent must not be pointed at this file or the mapping.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SET = path.join(ROOT, "docs/agent-runs/blind/set");
const MAPPING = path.join(ROOT, "docs/agent-runs/blind/mapping.json");

/** Neutral filenames; order is not broken/fixed/control and not grouped by case. */
const PAGES = [
  { id: "p01", caseId: "fixed-height-label", variant: "fixed", viewport: { width: 390, height: 640 } },
  { id: "p02", caseId: "fixed-footer-overlap", variant: "broken", viewport: { width: 360, height: 500 } },
  { id: "p03", caseId: "flex-long-text", variant: "control", viewport: { width: 390, height: 640 } },
  { id: "p04", caseId: "fixed-footer-overlap", variant: "control", viewport: { width: 360, height: 500 } },
  { id: "p05", caseId: "flex-long-text", variant: "broken", viewport: { width: 390, height: 640 } },
  { id: "p06", caseId: "fixed-height-label", variant: "control", viewport: { width: 390, height: 640 } },
  { id: "p07", caseId: "fixed-footer-overlap", variant: "fixed", viewport: { width: 360, height: 500 } },
  { id: "p08", caseId: "flex-long-text", variant: "fixed", viewport: { width: 390, height: 640 } },
  { id: "p09", caseId: "fixed-height-label", variant: "broken", viewport: { width: 390, height: 640 } },
];

function neutralize(html, pageId) {
  let out = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>Page ${pageId}</title>`,
  );
  out = out.replace(/<p class="banner">[\s\S]*?<\/p>\s*/g, "");
  out = out.replace(/\s*\.banner\s*\{[\s\S]*?\}\s*/g, "\n");
  return out;
}

await mkdir(SET, { recursive: true });
for (const name of await readdir(SET)) {
  await rm(path.join(SET, name), { force: true });
}

const mapping = {};
const index = [];
for (const page of PAGES) {
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
await writeFile(MAPPING, `${JSON.stringify(mapping, null, 2)}\n`);
console.log(`wrote ${PAGES.length} pages to ${path.relative(ROOT, SET)}`);
console.log(`wrote mapping to ${path.relative(ROOT, MAPPING)}`);
