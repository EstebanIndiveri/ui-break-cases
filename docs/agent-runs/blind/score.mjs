#!/usr/bin/env node
/**
 * Score a blind agent run against a mapping file kept outside the repo.
 * Usage: node docs/agent-runs/blind/score.mjs <mapping.json> [results.json]
 *
 * A page fails if:
 *   - the expected case is missing or misclassified
 *   - two matches for the same case disagree (resembles or bug)
 *   - another case is reported as a bug (false positive)
 *   - a broken page has no fix, or no captured specOutput that fails via
 *     expect(received) (timeouts / "Rejected to value" do not count;
 *     specFailedViaExpect is ignored)
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

function expectAssertionFailed(output) {
  if (
    /Timed out \d+ms/i.test(output) ||
    /Timeout \d+ms/i.test(output) ||
    /Test timeout of \d+ms/i.test(output) ||
    /Rejected to value/i.test(output) ||
    /element\(s\) not found/i.test(output)
  ) {
    return false;
  }
  return /Error:\s*expect\(received\)/.test(output);
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
  const hits = matches.filter((item) => item.caseId === want.caseId);
  const extras = matches.filter((item) => item.caseId !== want.caseId);
  const falsePositive = extras.some((item) => item.bug === true);
  const reasons = [];

  if (hits.length === 0) {
    reasons.push("missing expected case");
  }
  if (hits.length > 1) {
    const resembles = new Set(hits.map((item) => item.resembles));
    const bugs = new Set(hits.map((item) => Boolean(item.bug)));
    if (resembles.size > 1 || bugs.size > 1) {
      reasons.push(
        `contradictory matches for ${want.caseId}: ${hits
          .map((item) => `${item.resembles} bug=${item.bug}`)
          .join("; ")}`,
      );
    }
  }

  const hit = hits[0];
  const resembles = hit?.resembles;
  const bug = hit?.bug;

  if (hit && resembles !== want.resembles) {
    reasons.push(`resembles ${resembles} wanted ${want.resembles}`);
  }
  if (hit && bug !== want.bug) {
    reasons.push(`bug=${bug} wanted ${want.bug}`);
  }
  if (falsePositive) {
    reasons.push(
      `false positive: ${extras
        .filter((item) => item.bug)
        .map((item) => item.caseId)
        .join(", ")}`,
    );
  }

  if (want.bug) {
    const fix = hit?.fix ?? got?.fix;
    const hasFix =
      typeof fix === "string" &&
      fix.trim().length > 0 &&
      fix.trim() !== "null";
    const specOutput = String(
      hit?.specOutput ?? got?.specOutput ?? hit?.spec ?? "",
    );
    // Self-reported specFailedViaExpect is not evidence.
    const specOk = expectAssertionFailed(specOutput);
    if (!hasFix) {
      reasons.push("broken page missing fix");
    }
    if (!specOk) {
      reasons.push("broken page missing spec that fails via expect()");
    }
  }

  const ok = reasons.length === 0;
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
    reasons,
  });
}

for (const row of rows) {
  const extra = row.reasons.length ? `  (${row.reasons.join("; ")})` : "";
  console.log(
    `${row.ok ? "PASS" : "FAIL"}  ${row.file.padEnd(10)} want ${row.want}  got ${row.got}${extra}`,
  );
}
console.log(`\n${pass} pass, ${fail} fail (of ${files.length})`);
if (fail > 0 || files.length === 0) {
  process.exit(1);
}
