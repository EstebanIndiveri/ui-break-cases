#!/usr/bin/env node
/**
 * Score a blind agent run against a mapping file kept outside the repo.
 * Usage: node docs/agent-runs/blind/score.mjs <mapping.json> [results.json]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mappingPath = process.argv[2];
const resultsPath = path.resolve(
  process.argv[3] ?? path.join(ROOT, "docs/agent-runs/blind/results.json"),
);

if (!mappingPath) {
  console.error(
    "Usage: node docs/agent-runs/blind/score.mjs <mapping.json> [results.json]",
  );
  process.exit(2);
}

let mapping;
try {
  mapping = JSON.parse(await readFile(path.resolve(mappingPath), "utf8"));
} catch (error) {
  console.error(`Cannot read mapping: ${mappingPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

let results;
try {
  results = JSON.parse(await readFile(resultsPath, "utf8"));
} catch (error) {
  console.error(`Cannot read results: ${resultsPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

const files = Object.keys(mapping).sort();
let pass = 0;
let fail = 0;
const rows = [];

for (const file of files) {
  const want = mapping[file];
  const got = results[file];
  const matches = Array.isArray(got?.matches) ? got.matches : [];
  const hit = matches.find((item) => item.caseId === want.caseId);
  const resembles = hit?.resembles;
  const bug = hit?.bug;
  const ok =
    resembles === want.resembles &&
    bug === want.bug &&
    (want.bug ? matches.some((item) => item.bug === true) : true);
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
  }
  rows.push({
    file,
    ok,
    want: `${want.caseId} ${want.resembles} bug=${want.bug}`,
    got: hit
      ? `${hit.caseId} ${hit.resembles} bug=${hit.bug}`
      : matches.length
        ? JSON.stringify(matches)
        : "no result",
  });
}

for (const row of rows) {
  console.log(
    `${row.ok ? "PASS" : "FAIL"}  ${row.file.padEnd(10)} want ${row.want}  got ${row.got}`,
  );
}
console.log(`\n${pass} pass, ${fail} fail (of ${files.length})`);
if (fail > 0 || files.length === 0) {
  process.exit(1);
}
