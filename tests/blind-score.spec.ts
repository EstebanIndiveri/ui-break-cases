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
            specFailedViaExpect: true,
            specOutput: "",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/missing spec that fails via expect/);
  });

  test("captured specOutput with Error: expect(received) passes", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          {
            caseId: "flex-long-text",
            resembles: "broken",
            bug: true,
            fix: "min-width:0",
            specFailedViaExpect: false,
            specOutput:
              "Error: expect(received).toBeLessThanOrEqual(expected)\nReceived: 80",
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^PASS/m);
  });

  test("timeout specOutput is not FAIL via expect() even if specFailedViaExpect is true", async () => {
    const { mappingPath, resultsPath } = await writePair({
      "p01.html": {
        matches: [
          {
            caseId: "flex-long-text",
            resembles: "broken",
            bug: true,
            fix: "min-width:0",
            specFailedViaExpect: true,
            specOutput:
              "Test timeout of 8000ms exceeded.\nError: expect(received).resolves.toBe\nRejected to value: Error: locator.innerText",
          },
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
          {
            caseId: "flex-long-text",
            resembles: "broken",
            bug: true,
            fix: "min-width:0",
            specOutput:
              "Error: expect(received).toBeLessThanOrEqual(expected)",
          },
          {
            caseId: "flex-long-text",
            resembles: "fixed",
            bug: false,
            fix: null,
          },
        ],
      },
    });
    const result = await runScore(mappingPath, resultsPath);
    expect(result.code).not.toBe(0);
    expect(result.stdout).toMatch(/contradictory matches/);
  });
});
