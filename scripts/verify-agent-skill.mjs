#!/usr/bin/env node
/**
 * Mechanical verification of the v0.2 agent skill.
 *
 * What this proves:
 *   - Detection rules in skill/verify/classify.ts label each of the nine
 *     fixtures as broken / fixed / control (control ⇒ no bug).
 *   - skill/templates/<id>.spec.ts, pointed at a fixture URL, FAILS on broken
 *     via an expect() assertion and PASSES on fixed.
 *   - Control fixtures have real geometry checks (not hardcoded ok).
 *   - skill/SKILL.md copies have not drifted.
 *
 * What this does not prove:
 *   - That a coding agent (Cursor, Claude Code, Codex) will follow the skill.
 *     See docs/agent-runs/ for a recorded Cursor run.
 *
 * Usage: npm run verify:skill
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW = "http://127.0.0.1:4173";

const CASES = [
  {
    id: "flex-long-text",
    variants: {
      broken: "fixtures/flex-long-text/broken.html",
      fixed: "fixtures/flex-long-text/fixed.html",
      control: "fixtures/flex-long-text/control.html",
    },
  },
  {
    id: "fixed-height-label",
    variants: {
      broken: "fixtures/fixed-height-label/broken.html",
      fixed: "fixtures/fixed-height-label/fixed.html",
      control: "fixtures/fixed-height-label/control.html",
    },
  },
  {
    id: "fixed-footer-overlap",
    variants: {
      broken: "fixtures/fixed-footer-overlap/broken.html",
      fixed: "fixtures/fixed-footer-overlap/fixed.html",
      control: "fixtures/fixed-footer-overlap/control.html",
    },
  },
];

function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["playwright", "test", ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function runNode(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function printOutput(label, result) {
  const text = `${result.stdout}${result.stderr}`.trim();
  if (text.length === 0) {
    return;
  }
  console.log(`--- ${label} ---`);
  console.log(text);
}

const rows = [];
let failures = 0;

function record(row) {
  rows.push(row);
  const ok = row.ok ? "OK  " : "FAIL";
  if (!row.ok) {
    failures += 1;
  }
  console.log(
    `${ok}  ${row.caseId.padEnd(22)} ${row.variant.padEnd(8)} ${row.check.padEnd(18)} ${row.detail}`,
  );
}

function parseListResults(output) {
  const results = [];
  for (const line of output.split("\n")) {
    const passed = line.match(/✓.*›\s+(.+?)\s+\(/);
    const failed = line.match(/[✘×x].*›\s+(.+?)\s+\(/i);
    if (passed) {
      results.push({ title: passed[1].trim(), ok: true });
    } else if (failed) {
      results.push({ title: failed[1].trim(), ok: false });
    }
  }
  return results;
}

function expectAssertionFailed(output) {
  if (
    /Timed out \d+ms/i.test(output) ||
    /Timeout \d+ms/i.test(output) ||
    /element\(s\) not found/i.test(output)
  ) {
    return false;
  }
  return /Error:\s*expect\(received\)/.test(output);
}

async function copies() {
  console.log("\n# Skill copies (scripts/check-skill-copies.mjs)\n");
  const result = await runNode(path.join("scripts", "check-skill-copies.mjs"));
  printOutput("skill-copies", result);
  record({
    caseId: "skill-copies",
    variant: "n/a",
    check: "drift",
    ok: result.code === 0,
    detail:
      result.code === 0
        ? "skill/SKILL.md matches .agents and skill/install/claude"
        : "skill copies drifted or missing",
  });
}

async function detection() {
  console.log("\n# Detection (skill/verify/classify.ts via tests/agent-skill.spec.ts)\n");
  const result = await run(["tests/agent-skill.spec.ts", "--reporter=list"]);
  printOutput("detection", result);
  const parsed = parseListResults(result.stdout);

  for (const item of CASES) {
    for (const variant of ["broken", "fixed", "control"]) {
      const match = parsed.find(
        (entry) =>
          entry.title.includes(`${item.id} ${variant}`) &&
          entry.title.includes("resembles"),
      );
      const bug = variant === "broken";
      const ok = Boolean(match?.ok);
      record({
        caseId: item.id,
        variant,
        check: "detect",
        ok,
        detail: ok
          ? bug
            ? "bug=yes resembles=broken"
            : `bug=no resembles=${variant}`
          : match
            ? "classifier assertion failed"
            : "no matching test line (reported separately from other rows)",
      });
    }
  }

  for (const item of CASES) {
    const match = parsed.find(
      (entry) =>
        entry.title.includes(`${item.id} control`) &&
        entry.title.includes("control-geometry"),
    );
    record({
      caseId: item.id,
      variant: "control",
      check: "control-geometry",
      ok: Boolean(match?.ok),
      detail: match?.ok
        ? "geometry: local scroll / painted expand / matching spacer"
        : match
          ? "control geometry assertion failed"
          : "no control-geometry test line",
    });
  }

  const mutations = parsed.filter((entry) =>
    /overflow-x:visible|display:none expand/.test(entry.title),
  );
  record({
    caseId: "mutations",
    variant: "n/a",
    check: "not-control",
    ok: mutations.length === 2 && mutations.every((entry) => entry.ok),
    detail:
      mutations.length === 2 && mutations.every((entry) => entry.ok)
        ? "overflow-x:visible and hidden expand are not control"
        : `mutation tests parsed=${mutations.length}`,
  });

  const threshold = parsed.find((entry) => entry.title.includes("99999"));
  record({
    caseId: "flex-threshold",
    variant: "n/a",
    check: "99999-mutant",
    ok: Boolean(threshold?.ok),
    detail: threshold?.ok
      ? "isClearFlexOverflow(…, 99999) is false on the broken fixture"
      : "threshold mutant test missing or failed",
  });
}

async function templates() {
  console.log("\n# Generated templates (skill/templates, UI_BREAK_TARGET_URL)\n");
  for (const item of CASES) {
    const spec = path.join("skill/templates", `${item.id}.spec.ts`);
    for (const variant of ["broken", "fixed"]) {
      const fixturePath = item.variants[variant];
      const result = await run(
        ["-c", "playwright.skill.config.ts", spec, "--reporter=list"],
        { UI_BREAK_TARGET_URL: `${PREVIEW}/${fixturePath}` },
      );
      printOutput(`${item.id} ${variant}`, result);
      const wantFail = variant === "broken";
      const failed = result.code !== 0;
      const expectFail = expectAssertionFailed(`${result.stdout}\n${result.stderr}`);
      const ok = wantFail ? failed && expectFail : !failed;
      record({
        caseId: item.id,
        variant,
        check: "generated-test",
        ok,
        detail: wantFail
          ? failed && expectFail
            ? "FAIL on broken via expect()"
            : failed
              ? "FAIL on broken but not an expect() assertion"
              : "unexpected PASS on broken"
          : failed
            ? "unexpected FAIL on fixed"
            : "PASS on fixed (expected)",
      });
    }
  }
}

async function main() {
  await copies();
  await detection();
  await templates();

  console.log("\n# Per-check counts\n");
  for (const row of rows) {
    const key = `${row.caseId}/${row.variant}/${row.check}`;
    console.log(`${key.padEnd(52)} ${row.ok ? "pass" : "fail"}  ${row.detail}`);
  }

  console.log(
    `\nTotals: ${rows.filter((row) => row.ok).length} pass, ${failures} fail (of ${rows.length} checks)`,
  );
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
