#!/usr/bin/env node
/**
 * Score a blind agent run against a mapping file kept outside the repo.
 * Usage: node docs/agent-runs/blind/score.mjs <mapping.json> [results.json]
 *
 * The scorer does not re-run specs. specOutput is self-reported.
 *
 * A page fails if:
 *   - the expected case is missing or misclassified
 *   - two matches for the same case disagree (resembles or bug)
 *   - another case is reported as a bug, or resembles "broken"
 *   - a match has a non-boolean bug value
 *   - a match or page object has fields prompt.md does not define
 *   - a broken page has no fix, or no specOutput that looks like a real
 *     Playwright failure: `N failed` with no `N passed`, plus
 *     Error: expect(received) with Expected/Received and an `at file:line`
 *     frame (timeouts / "Rejected to value" do not count;
 *     specFailedViaExpect is ignored). ANSI color codes are stripped
 *     before those checks (prompt.md asks for NO_COLOR=1).
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

const CASE_IDS = new Set([
  "flex-long-text",
  "fixed-height-label",
  "fixed-footer-overlap",
]);
const RESEMBLES = new Set(["broken", "fixed", "control"]);
const MATCH_KEYS = new Set([
  "caseId",
  "resembles",
  "bug",
  "fix",
  "specOutput",
  "notes",
]);
const PAGE_KEYS = new Set(["matches"]);

function unknownKeys(value, allowed) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/** Strip CSI / SGR color codes so Playwright's colored reporter still parses. */
function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*[ -/]*[@-~]/g, "");
}

function expectAssertionFailed(output) {
  if (typeof output !== "string" || output.trim().length === 0) {
    return false;
  }
  output = stripAnsi(output);
  if (
    /Timed out \d+ms/i.test(output) ||
    /Timeout \d+ms/i.test(output) ||
    /Test timeout of \d+ms/i.test(output) ||
    /Rejected to value/i.test(output) ||
    /element\(s\) not found/i.test(output)
  ) {
    return false;
  }
  const failed = output.match(/(?:^|\n)\s*(\d+) failed\b/);
  const passed = output.match(/(?:^|\n)\s*(\d+) passed\b/);
  if (!failed || Number(failed[1]) < 1) {
    return false;
  }
  if (passed && Number(passed[1]) > 0) {
    return false;
  }
  if (
    !/^ *Error:\s*expect\(received\).*$/m.test(output) ||
    !/^ *Expected:/m.test(output) ||
    !/^ *Received:/m.test(output) ||
    !/\bat\s+.+:\d+:\d+/.test(output)
  ) {
    return false;
  }
  return true;
}

function matchProblems(item, index) {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return [`matches[${index}] is not an object`];
  }
  const problems = [];
  const unknown = unknownKeys(item, MATCH_KEYS);
  if (unknown.length > 0) {
    problems.push(`unknown field ${unknown.join(", ")}`);
  }
  if (!CASE_IDS.has(item.caseId)) {
    problems.push(`invalid caseId ${JSON.stringify(item.caseId)}`);
  }
  if (!RESEMBLES.has(item.resembles)) {
    problems.push(`invalid resembles ${JSON.stringify(item.resembles)}`);
  }
  if (typeof item.bug !== "boolean") {
    problems.push(`bug must be boolean, got ${JSON.stringify(item.bug)}`);
  }
  return problems;
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
  const hits = matches.filter((item) => item && item.caseId === want.caseId);
  const extras = matches.filter((item) => item && item.caseId !== want.caseId);
  const reasons = [];

  if (got != null) {
    const pageUnknown = unknownKeys(got, PAGE_KEYS);
    if (pageUnknown.length > 0) {
      reasons.push(`unknown field ${pageUnknown.join(", ")}`);
    }
  }

  matches.forEach((item, index) => {
    reasons.push(...matchProblems(item, index));
  });

  if (hits.length === 0) {
    reasons.push("missing expected case");
  }
  if (hits.length > 1) {
    const resembles = new Set(hits.map((item) => item.resembles));
    const bugs = new Set(hits.map((item) => item.bug));
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
  if (hit && typeof bug === "boolean" && bug !== want.bug) {
    reasons.push(`bug=${bug} wanted ${want.bug}`);
  }

  const extraBugs = extras.filter((item) => item.bug === true);
  if (extraBugs.length > 0) {
    reasons.push(
      `false positive: ${extraBugs.map((item) => item.caseId).join(", ")}`,
    );
  }
  const extraBroken = extras.filter((item) => item.resembles === "broken");
  if (extraBroken.length > 0) {
    reasons.push(
      `false positive: extra broken match for ${extraBroken
        .map((item) => item.caseId)
        .join(", ")}`,
    );
  }

  if (want.bug) {
    const fix = hit?.fix;
    const hasFix =
      typeof fix === "string" &&
      fix.trim().length > 0 &&
      fix.trim() !== "null";
    const specOutput = typeof hit?.specOutput === "string" ? hit.specOutput : "";
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
