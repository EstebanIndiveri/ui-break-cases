#!/usr/bin/env node
/**
 * Fail if skill/SKILL.md and its install copies drift.
 * Source of truth: skill/SKILL.md
 * Copies: .agents/skills/ui-break-cases/SKILL.md (Cursor + Codex)
 *         skill/install/claude.SKILL.md (Claude Code paste target)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "skill/SKILL.md";
const COPIES = [
  ".agents/skills/ui-break-cases/SKILL.md",
  "skill/install/claude.SKILL.md",
];

const source = await readFile(path.join(ROOT, SOURCE), "utf8");
let failed = 0;
for (const rel of COPIES) {
  let copy;
  try {
    copy = await readFile(path.join(ROOT, rel), "utf8");
  } catch (error) {
    console.error(`MISSING  ${rel}`);
    failed += 1;
    continue;
  }
  if (copy === source) {
    console.log(`OK       ${rel} matches ${SOURCE}`);
  } else {
    console.error(`DRIFT    ${rel} differs from ${SOURCE}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(
    `\nCopy ${SOURCE} onto the install paths (or run: cp skill/SKILL.md .agents/skills/ui-break-cases/SKILL.md && cp skill/SKILL.md skill/install/claude.SKILL.md)`,
  );
  process.exit(1);
}
console.log(`\n${COPIES.length} skill copies match ${SOURCE}`);
