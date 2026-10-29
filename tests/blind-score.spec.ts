import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCORE = path.join(ROOT, "docs/agent-runs/blind/score.mjs");

const mapping = {
  "p01.html": {
    caseId: "flex-long-text",
    variant: "broken",
    resembles: "broken",
    bug: true,
    viewport: { width: 390, height: 640 },
  },
};

/** Real Playwright failure: N failed, no N passed, expect() block, at file:line. */
const VALID_SPEC_OUTPUT = `    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 4
    Received:    80

        at /tmp/flex-long-text.spec.ts:42:22

  1 failed
`;

function runScore(mappingPath: string, resultsPath: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(process.execPath, [SCORE, mappingPath, resultsPath], {
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
    },
  );
}

async function writePair(results: unknown) {
  const dir = await mkdtemp(path.join(tmpdir(), "ubc-score-"));
  const mappingPath = path.join(dir, "mapping.json");
  const resultsPath = path.join(dir, "results.json");
  await writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
  await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  return { mappingPath, resultsPath };
}

function brokenMatch(overrides: Record<string, unknown> = {}) {
  return {
    caseId: "flex-long-text",
    resembles: "broken",
    bug: true,
    fix: "min-width:0",
    specOutput: VALID_SPEC_OUTPUT,
    notes: "overflow 80px",
    ...overrides,
  };
}

test.describe("blind score.mjs", () => {
  test("specFailedViaExpect alone does not pass a broken page", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          {
            caseId: "flex-long-text",
            resembles: "broken",
            bug: true,
            fix: "min-width:0",
            specOutput: "",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/missing spec that fails via expect/);
  });

  test("Playwright N failed + expect() block + at file:line passes", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [brokenMatch()],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^PASS/m);
  });

  test("forged specOutput 'Error: expect(received)' does not pass", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [brokenMatch({ specOutput: "Error: expect(received)" })],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/missing spec that fails via expect/);
  });

  test("forged specOutput mentioning Error: expect(received) plus 1 passed does not pass", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          brokenMatch({
            specOutput: "no Error: expect(received) seen\n 1 passed",
          }),
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/missing spec that fails via expect/);
  });

  test("timeout specOutput is not FAIL via expect() even with a forged Error line", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          brokenMatch({
            specOutput:
              "Test timeout of 8000ms exceeded.\nError: expect(received).resolves.toBe\nRejected to value: Error: locator.innerText",
          }),
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/missing spec that fails via expect/);
  });

  test("two contradictory matches for the same case FAIL", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          brokenMatch(),
          {
            caseId: "flex-long-text",
            resembles: "fixed",
            bug: false,
            fix: null,
            specOutput: null,
            notes: "disagree",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/contradictory matches/);
  });

  test("non-boolean bug string is rejected", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [brokenMatch({ bug: "true" })],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/bug must be boolean/);
  });

  test("non-boolean bug 1 on an extra match is rejected", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          brokenMatch(),
          {
            caseId: "fixed-height-label",
            resembles: "control",
            bug: 1,
            fix: null,
            specOutput: null,
            notes: "forged",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/bug must be boolean/);
  });

  test("extra match resembling broken with bug false is a false positive", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          brokenMatch(),
          {
            caseId: "fixed-footer-overlap",
            resembles: "broken",
            bug: false,
            fix: null,
            specOutput: null,
            notes: "extra",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/extra broken match/);
  });

  test("unknown match field is rejected", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [brokenMatch({ specFailedViaExpect: true })],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/unknown field specFailedViaExpect/);
  });

  test("unknown page field specOutput is rejected", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [brokenMatch()],
        specOutput: VALID_SPEC_OUTPUT,
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/unknown field specOutput/);
  });
});
