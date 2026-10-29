#!/usr/bin/env node
/**
 * Rebuilds docs/agent-runs/blind/set/ as original pages that keep only the
 * bug geometry from public/fixtures. Copy, colors, ids, classes, wrappers,
 * and section order are all different so `diff` cannot recover the mapping.
 *
 * Mapping is written OUTSIDE the repo (default /tmp/ubc-blind-mapping.json).
 *
 * Similarity: 12-gram Jaccard on whitespace-normalized HTML.
 * A page fails the build if its similarity to ANY public fixture is >= 0.35.
 *
 * Usage: node docs/agent-runs/blind/build-set.mjs
 */
import { randomInt } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SET = path.join(ROOT, "docs/agent-runs/blind/set");
const PUBLIC = path.join(ROOT, "public/fixtures");
const MAPPING = process.env.UBC_BLIND_MAPPING ?? "/tmp/ubc-blind-mapping.json";
/** Fail the build if a generated page is this similar (or more) to a public fixture. */
const SIMILARITY_MAX = 0.35;
const SHINGLE = 12;

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

function shingles(text, n = SHINGLE) {
  const s = text.replace(/\s+/g, " ").trim();
  const out = new Set();
  if (s.length < n) {
    out.add(s);
    return out;
  }
  for (let i = 0; i <= s.length - n; i += 1) {
    out.add(s.slice(i, i + n));
  }
  return out;
}

/** 0 = unrelated, 1 = identical. Documented threshold: SIMILARITY_MAX. */
function similarity(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 && B.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const gram of A) {
    if (B.has(gram)) {
      inter += 1;
    }
  }
  return inter / (A.size + B.size - inter);
}

function flexPage(variant) {
  const wrap = variant === "fixed";
  const bodyMin = wrap ? "min-width:0;" : "";
  const tokenWrap = wrap ? "overflow-wrap:anywhere;" : "white-space:nowrap;";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${variant === "broken" ? "draft" : variant === "fixed" ? "ready" : "snippet"}</title>
    <style>
      body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: Georgia, serif; }
      header { padding: 20px 24px 8px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #94a3b8; }
      .stage { padding: 8px 24px 32px; }
      #panel {
        display: flex; align-items: center; gap: 10px;
        width: 240px; box-sizing: border-box; padding: 14px 12px;
        background: #1e293b; border: 2px dashed #38bdf8; border-radius: 2px;
      }
      .cluster { flex: 1 1 auto; ${bodyMin} }
      #payload { margin: 0; font: 12px/1.45 "Courier New", monospace; color: #7dd3fc; ${tokenWrap} }
      #go {
        flex: 0 0 auto; padding: 10px 12px; background: #f97316; color: #111;
        font: 700 12px/1 Verdana, sans-serif; text-decoration: none; white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <header>Accounts payable · batch 17</header>
    <div class="stage">
      <aside id="panel">
        <div class="cluster">
          <p id="payload">acct:99-omega/ref=very-long-unbroken-settlement-token-88421</p>
        </div>
        <a id="go" href="#dup">Duplicate</a>
      </aside>
      <p id="note" hidden>Duplicated</p>
    </div>
    <script>
      document.getElementById("go").addEventListener("click", (event) => {
        event.preventDefault();
        document.getElementById("note").hidden = false;
      });
    </script>
  </body>
</html>
`;
}

function flexControl() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trace viewer</title>
    <style>
      body { margin: 0; background: #14532d; color: #dcfce7; font-family: "Palatino Linotype", Palatino, serif; }
      .frame { padding: 28px; max-width: 100%; box-sizing: border-box; min-width: 0; }
      .kicker { margin: 0 0 14px; font-size: 13px; }
      #scrollbox {
        margin: 0; padding: 10px 14px; width: 200px; max-width: 100%;
        box-sizing: border-box; background: #052e16; color: #86efac;
        overflow-x: auto; white-space: nowrap; font: 12px/1.5 Consolas, monospace;
      }
      #payload { white-space: nowrap; }
    </style>
  </head>
  <body>
    <div class="frame">
      <p class="kicker">Span attributes stay in this pane. Use the gutter to read the rest of the id.</p>
      <pre id="scrollbox"><code id="payload">acct:99-omega/ref=very-long-unbroken-settlement-token-88421</code></pre>
    </div>
  </body>
</html>
`;
}

function labelPage(variant) {
  const height =
    variant === "fixed"
      ? "height:auto;overflow:visible;"
      : variant === "control"
        ? "height:auto;overflow:visible;"
        : "height:24px;overflow:hidden;";
  const toggle =
    variant === "control"
      ? `<button id="more" type="button" aria-expanded="false">Open remainder</button>
        <script>
          const label = document.getElementById("headline");
          const btn = document.getElementById("more");
          btn.addEventListener("click", () => {
            const open = btn.getAttribute("aria-expanded") === "true";
            btn.setAttribute("aria-expanded", open ? "false" : "true");
            label.classList.toggle("shut", open);
          });
        </script>`
      : "";
  const shut = variant === "control" ? " class=\"shut\"" : "";
  const extra =
    variant === "control"
      ? `#headline.shut { height: 24px; overflow: hidden; }
         #more { margin-top: 8px; padding: 8px 10px; background: #fde68a; border: 0; font: 600 13px Verdana, sans-serif; }`
      : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kitchen ticket</title>
    <style>
      body { margin: 0; background: #fff7ed; color: #7c2d12; font-family: "Trebuchet MS", sans-serif; }
      .sheet { margin: 24px; padding: 18px; background: #ffedd5; border: 4px solid #ea580c; }
      h2 { margin: 0 0 10px; font-size: 15px; }
      #headline { margin: 0; font-size: 16px; line-height: 24px; ${height} }
      #follow { margin: 18px 0 0; font-size: 13px; color: #9a3412; }
      ${extra}
    </style>
  </head>
  <body>
    <div class="sheet">
      <h2>Pass 4 · grill</h2>
      <p id="headline"${shut}>Allergen note: this plate includes toasted sesame, aged soy, and a reduced brown-butter glaze that must stay on the ticket</p>
      ${toggle}
      <p id="follow">Runner window closes at 19:40. Do not fire dessert until this ticket is bumped.</p>
    </div>
  </body>
</html>
`;
}

function footerPage(variant) {
  const reserved =
    variant === "fixed"
      ? "padding: 18px 18px 96px;"
      : variant === "control"
        ? "padding: 18px;"
        : "padding: 18px 18px 36px;";
  const spacer =
    variant === "control"
      ? '<div class="gap" aria-hidden="true"></div>'
      : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Library hold</title>
    <style>
      body { margin: 0; background: #fdf4ff; color: #581c87; font-family: "Gill Sans", "Gill Sans MT", sans-serif; }
      .page {
        box-sizing: border-box; min-height: 100vh; display: flex; flex-direction: column;
        ${reserved}
      }
      h2 { margin: 0 0 12px; font-size: 22px; }
      .blurb { margin: 0 0 10px; line-height: 1.45; }
      #finish {
        display: block; width: 100%; box-sizing: border-box; margin-top: auto;
        min-height: 44px; border: 0; border-radius: 0;
        background: #6d28d9; color: #faf5ff; font: 700 15px/1.2 inherit;
      }
      .gap { height: 64px; }
      #dock {
        position: fixed; left: 0; right: 0; bottom: 0; height: 64px;
        display: flex; align-items: center; justify-content: center;
        background: #2e1065; color: #f5d0fe; font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <h2>Hold expires tonight</h2>
      <p class="blurb">Volume 3 of the coastal atlas is waiting at desk B. Bring the card that matches the name on the slip.</p>
      <p class="blurb">Quiet-floor rules apply after 18:00. Bags stay in the lobby lockers.</p>
      <p class="blurb">If you skip pickup the next patron on the list is notified at 21:00 sharp.</p>
      <button id="finish" type="button">Take the hold</button>
      <p id="done" hidden>Hold taken</p>
      ${spacer}
    </div>
    <div id="dock">Desk B · ask for slip 441</div>
    <script>
      document.getElementById("finish").addEventListener("click", () => {
        document.getElementById("done").hidden = false;
      });
    </script>
  </body>
</html>
`;
}

function pageHtml(caseId, variant) {
  if (caseId === "flex-long-text") {
    return variant === "control" ? flexControl() : flexPage(variant);
  }
  if (caseId === "fixed-height-label") {
    return labelPage(variant);
  }
  return footerPage(variant);
}

if (MAPPING.startsWith(ROOT + path.sep) || path.resolve(MAPPING) === ROOT) {
  throw new Error(`mapping path must be outside the repo: ${MAPPING}`);
}

const publicHtml = [];
for (const item of FIXTURES) {
  const rel = path.join(item.caseId, `${item.variant}.html`);
  publicHtml.push({
    rel,
    html: await readFile(path.join(PUBLIC, rel), "utf8"),
  });
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
const similarities = [];
let worst = { file: "", vs: "", score: 0 };

for (const page of pages) {
  const html = pageHtml(page.caseId, page.variant);
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

  let pageWorst = 0;
  let pageVs = "";
  for (const pub of publicHtml) {
    const score = similarity(html, pub.html);
    if (score > pageWorst) {
      pageWorst = score;
      pageVs = pub.rel;
    }
  }
  similarities.push({ file, vs: pageVs, score: pageWorst });
  if (pageWorst > worst.score) {
    worst = { file, vs: pageVs, score: pageWorst };
  }
}

await writeFile(
  path.join(SET, "pages.json"),
  `${JSON.stringify(index, null, 2)}\n`,
);
await mkdir(path.dirname(MAPPING), { recursive: true });
await writeFile(MAPPING, `${JSON.stringify(mapping, null, 2)}\n`);

console.log(`wrote ${pages.length} pages to ${path.relative(ROOT, SET)}`);
console.log(`wrote mapping to ${MAPPING}`);
console.log(
  `\nSimilarity vs public/fixtures (12-gram Jaccard; fail if >= ${SIMILARITY_MAX}):`,
);
for (const row of similarities) {
  console.log(
    `  ${row.file}  max ${row.score.toFixed(3)}  vs ${row.vs}`,
  );
}
console.log(`  worst: ${worst.file} ${worst.score.toFixed(3)} vs ${worst.vs}`);

const over = similarities.filter((row) => row.score >= SIMILARITY_MAX);
if (over.length > 0) {
  throw new Error(
    `similarity ${over.map((row) => `${row.file}=${row.score.toFixed(3)}`).join(", ")} >= ${SIMILARITY_MAX}`,
  );
}
