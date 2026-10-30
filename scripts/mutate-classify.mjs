#!/usr/bin/env node
/**
 * Apply the issue #8 classify.ts mutants one at a time and run
 * tests/agent-skill.spec.ts. Prints killed / alive / timeout / error.
 *
 * Usage: node scripts/mutate-classify.mjs
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "skill/verify/classify.ts");

/**
 * Mutants named in issue #8. Each `find` must occur exactly once.
 * "alive" means agent-skill.spec.ts still passes after the edit.
 * "killed" means Playwright ran and a test assertion failed.
 * "timeout" means Playwright ran and failed only on test timeouts.
 * "error" means the suite did not run (build / spawn / other).
 */
export const MUTANTS = [
  {
    id: "N10",
    name: "nextClear bottom tolerance 0",
    find: "label.bottom - GEOM_TOLERANCE_PX",
    replace: "label.bottom - 0",
  },
  {
    id: "N13",
    name: "clippedBottom fixed tolerance 0",
    find: "clip.clippedBottom <= GEOM_TOLERANCE_PX &&",
    replace: "clip.clippedBottom <= 0 &&",
  },
  {
    id: "N14",
    name: "clippedRight fixed tolerance 0",
    find: "clip.clippedRight <= GEOM_TOLERANCE_PX &&",
    replace: "clip.clippedRight <= 0 &&",
  },
  {
    id: "N15",
    name: "footer bottom tolerance 0",
    find: "action.bottom <= footer.top + GEOM_TOLERANCE_PX &&",
    replace: "action.bottom <= footer.top + 0 &&",
  },
  {
    id: "N16",
    name: "spacer height tolerance 0",
    find: "spacer.height + GEOM_TOLERANCE_PX >= footer.height",
    replace: "spacer.height + 0 >= footer.height",
  },
  {
    id: "N20",
    name: "control clippedBottom tolerance 0",
    find: "hidden && clip.clippedBottom > CLEAR_DEFECT_PX && aria !== null",
    replace: "hidden && clip.clippedBottom > 0 && aria !== null",
  },
  {
    id: "N23",
    name: "broken clippedBottom tolerance 0",
    find: "clip.clippedBottom > CLEAR_DEFECT_PX &&\n    !expandPainted",
    replace: "clip.clippedBottom > 0 &&\n    !expandPainted",
  },
  {
    id: "nextClear",
    name: "drop nextClear from the fixed gate",
    find: `    clip.clippedBottom <= GEOM_TOLERANCE_PX &&
    clip.clippedRight <= GEOM_TOLERANCE_PX &&
    nextClear`,
    replace: `    clip.clippedBottom <= GEOM_TOLERANCE_PX &&
    clip.clippedRight <= GEOM_TOLERANCE_PX`,
  },
  {
    id: "action.right",
    name: "drop action.right from isClearFlexOverflow (broken)",
    find: "isClearFlexOverflow(overflow, action.right, card.right, threshold)",
    replace: "isClearFlexOverflow(overflow, card.right, card.right, threshold)",
  },
  {
    id: "rects",
    name: "drop clip.rects.length > 1 from broken label",
    find: `    clip.rects.length > 1 &&
    hidden &&
    clip.clippedBottom > CLEAR_DEFECT_PX &&
    !expandPainted`,
    replace: `    hidden &&
    clip.clippedBottom > CLEAR_DEFECT_PX &&
    !expandPainted`,
  },
  {
    id: "clip",
    name: "drop clippedBottom from the fixed label gate",
    find: `    !hidden &&
    clip.clippedBottom <= GEOM_TOLERANCE_PX &&
    clip.clippedRight <= GEOM_TOLERANCE_PX &&
    nextClear`,
    replace: `    !hidden &&
    clip.clippedRight <= GEOM_TOLERANCE_PX &&
    nextClear`,
  },
  {
    id: "localScroll",
    name: "drop localScroll from flex control",
    find: `      overflowXAllowsScroll(overflowX) &&
      localScroll &&
      pageContained`,
    replace: `      overflowXAllowsScroll(overflowX) &&
      pageContained`,
  },
  {
    id: "localScroll-threshold",
    name: "localScroll CLEAR_DEFECT_PX → 0",
    find: "metrics.scrollWidth > metrics.clientWidth + CLEAR_DEFECT_PX",
    replace: "metrics.scrollWidth > metrics.clientWidth + 0",
  },
  {
    id: "next-content",
    name: "missing #next-content is not nextClear",
    find: `  const nextClear = nextExists
    ? (await boundingRect(page, "#next-content")).top >=
      label.bottom - GEOM_TOLERANCE_PX
    : true;`,
    replace: `  const nextClear = nextExists
    ? (await boundingRect(page, "#next-content")).top >=
      label.bottom - GEOM_TOLERANCE_PX
    : false;`,
  },
];

let originalSource = null;

function restoreSync() {
  if (originalSource == null) {
    return;
  }
  try {
    writeFileSync(TARGET, originalSource);
  } catch (error) {
    console.error("Failed to restore skill/verify/classify.ts");
    console.error(error instanceof Error ? error.message : error);
  }
}

function applyMutant(source, mutant) {
  const count = source.split(mutant.find).length - 1;
  if (count !== 1) {
    throw new Error(
      `${mutant.id}: find matched ${count} times (want 1): ${JSON.stringify(mutant.find)}`,
    );
  }
  return source.replace(mutant.find, mutant.replace);
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      [
        "playwright",
        "test",
        "tests/agent-skill.spec.ts",
        "--reporter=line",
      ],
      {
        cwd: ROOT,
        env: { ...process.env, NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : error}`,
      });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function firstUsefulLine(text) {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "non-zero exit"
  );
}

function classifyRun(result) {
  const text = `${result.stdout}\n${result.stderr}`;
  const failedMatch = text.match(/(\d+) failed/);
  const passedMatch = text.match(/(\d+) passed/);
  const failed = failedMatch ? Number(failedMatch[1]) : 0;
  const passed = passedMatch ? Number(passedMatch[1]) : 0;
  const ran =
    /Running \d+ tests/.test(text) || failedMatch != null || passedMatch != null;
  const timedOut =
    /Test timeout of \d+ms/i.test(text) ||
    /Timeout of \d+ms exceeded/i.test(text) ||
    /timed out/i.test(text);
  const assertionFail = /Error:\s*expect\(received\)/.test(text);

  if (result.code === 0) {
    return {
      status: "ALIVE",
      detail: `${passed} passed`,
      passed,
      failed,
    };
  }
  if (!ran) {
    return {
      status: "error",
      detail: firstUsefulLine(text).slice(0, 200),
      passed,
      failed,
    };
  }
  if (timedOut && !assertionFail) {
    return {
      status: "timeout",
      detail: `${failed} failed, ${passed} passed (timeout)`,
      passed,
      failed,
    };
  }
  if (failed > 0 || assertionFail) {
    return {
      status: "killed",
      detail: `${failed} failed, ${passed} passed`,
      passed,
      failed,
    };
  }
  return {
    status: "error",
    detail: `exit ${result.code}: ${firstUsefulLine(text).slice(0, 180)}`,
    passed,
    failed,
  };
}

async function main() {
  originalSource = await readFile(TARGET, "utf8");
  const rows = [];
  try {
    for (const mutant of MUTANTS) {
      process.stdout.write(`${mutant.id.padEnd(22)} ${mutant.name} … `);
      let source;
      try {
        source = applyMutant(originalSource, mutant);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`ERROR  ${message}`);
        rows.push({
          id: mutant.id,
          name: mutant.name,
          status: "error",
          detail: message,
          equivalent: Boolean(mutant.equivalent),
        });
        continue;
      }
      await writeFile(TARGET, source);
      const result = await runPlaywright();
      await writeFile(TARGET, originalSource);
      const summary = classifyRun(result);
      let status = summary.status;
      let detail = summary.detail;
      if (result.code === 0 && mutant.equivalent) {
        status = "equiv";
        detail = mutant.equivalent;
      } else if (mutant.equivalent && status !== "ALIVE") {
        console.log(
          `FAIL   declared equivalent but ${status}: ${detail}`,
        );
        rows.push({
          id: mutant.id,
          name: mutant.name,
          status: "error",
          detail: `declared equivalent but ${status}: ${detail}`,
          equivalent: true,
        });
        continue;
      }
      console.log(`${status.padEnd(6)} ${detail}`);
      rows.push({
        id: mutant.id,
        name: mutant.name,
        status,
        detail,
        equivalent: Boolean(mutant.equivalent),
      });
    }
  } finally {
    restoreSync();
  }

  const alive = rows.filter((row) => row.status === "ALIVE");
  const equiv = rows.filter((row) => row.status === "equiv");
  const killed = rows.filter((row) => row.status === "killed");
  const timeouts = rows.filter((row) => row.status === "timeout");
  const errors = rows.filter((row) => row.status === "error");
  console.log(
    `\n${killed.length} killed, ${alive.length} alive, ${timeouts.length} timeout, ${errors.length} error, ${equiv.length} equivalent (of ${rows.length})`,
  );
  if (alive.length > 0) {
    console.log("Alive:");
    for (const row of alive) {
      console.log(`  ${row.id}  ${row.name}`);
    }
  }
  if (timeouts.length > 0) {
    console.log("Timeout:");
    for (const row of timeouts) {
      console.log(`  ${row.id}  ${row.detail}`);
    }
  }
  if (errors.length > 0) {
    console.log("Error:");
    for (const row of errors) {
      console.log(`  ${row.id}  ${row.detail}`);
    }
  }
  if (equiv.length > 0) {
    console.log("Equivalent:");
    for (const row of equiv) {
      console.log(`  ${row.id}  ${row.detail}`);
    }
  }
  if (alive.length > 0 || timeouts.length > 0 || errors.length > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isDirectRun) {
  process.on("SIGINT", () => {
    restoreSync();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    restoreSync();
    process.exit(143);
  });
  main().catch((error) => {
    restoreSync();
    console.error(error);
    process.exit(1);
  });
}
