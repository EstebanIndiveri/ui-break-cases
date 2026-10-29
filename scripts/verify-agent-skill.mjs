#!/usr/bin/env node
/**
 * Mechanical verification of the v0.2 agent skill.
 *
 * What this proves:
 *   - Detection rules in skill/verify/classify.ts label each of the nine
 *     fixtures as broken / fixed / control (control ⇒ no bug).
 *   - skill/templates/<id>.spec.ts, pointed at a fixture, FAILS on broken
 *     and PASSES on fixed.
 *
 * What this does not prove:
 *   - That a coding agent (Cursor, Claude Code, Codex) will follow the skill.
 *   - That the templates work on a page that is not one of these fixtures.
 *
 * Usage: npm run verify:skill
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

async function detection() {
  console.log("\n# Detection (skill/verify/classify.ts via tests/agent-skill.spec.ts)\n");
  const result = await run(["tests/agent-skill.spec.ts", "--reporter=list"]);
  printOutput("detection", result);
  const parsed = parseListResults(result.stdout);
  for (const item of CASES) {
    for (const variant of ["broken", "fixed", "control"]) {
      const match = parsed.find((entry) =>
        entry.title.includes(`${item.id} ${variant}`),
      );
      const bug = variant === "broken";
      const ok = result.code === 0 && Boolean(match?.ok);
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
            : `playwright exited ${result.code} (no matching test line)`,
      });
    }
  }
}

async function templates() {
  console.log("\n# Generated templates (skill/templates, UI_BREAK_TARGET_PATH)\n");
  for (const item of CASES) {
    const spec = path.join("skill/templates", `${item.id}.spec.ts`);
    for (const variant of ["broken", "fixed"]) {
      const fixturePath = item.variants[variant];
      const result = await run(
        ["-c", "playwright.skill.config.ts", spec, "--reporter=list"],
        { UI_BREAK_TARGET_PATH: fixturePath },
      );
      printOutput(`${item.id} ${variant}`, result);
      const wantFail = variant === "broken";
      const failed = result.code !== 0;
      const ok = wantFail ? failed : !failed;
      record({
        caseId: item.id,
        variant,
        check: "generated-test",
        ok,
        detail: wantFail
          ? failed
            ? "FAIL on broken (expected)"
            : "unexpected PASS on broken"
          : failed
            ? "unexpected FAIL on fixed"
            : "PASS on fixed (expected)",
      });
    }
    record({
      caseId: item.id,
      variant: "control",
      check: "generated-test",
      ok: true,
      detail: "not applied — control is classified as no bug",
    });
  }
}

async function main() {
  await detection();
  await templates();

  console.log("\n# Per-fixture counts\n");
  const byFixture = new Map();
  for (const row of rows) {
    const key = `${row.caseId}/${row.variant}`;
    const current = byFixture.get(key) ?? { ok: 0, fail: 0 };
    if (row.ok) {
      current.ok += 1;
    } else {
      current.fail += 1;
    }
    byFixture.set(key, current);
  }
  for (const [key, counts] of byFixture) {
    console.log(`${key.padEnd(36)} pass=${counts.ok} fail=${counts.fail}`);
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
