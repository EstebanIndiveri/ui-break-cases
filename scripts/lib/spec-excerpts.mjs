/** Max lines in an excerpt, including the start line. hitTestCenter is 19. */
export const EXCERPT_MAX_LINES = 24;

const BROKEN_TEST_START = /test\(\s*(['"`])broken:/;
const BROKEN_TEST_TITLE = /test\(\s*(["'`])(broken:[\s\S]*?)\1/;
const OVERLAP_EXPECT = /expect\(\s*overlapHeight\b/;
const HIT_FOOTER_EXPECT = /expect\(\s*hit\.hit\?\.id\)\.toBe\(\s*(['"])site-footer\1\s*\)/;

/**
 * Strip // and /* *\/ comments so a commented-out expect is not an anchor.
 * Strings are left intact; these excerpts are test source, not a full parser.
 */
export function stripJsComments(source) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    if (state === "code") {
      if (c === "/" && n === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && n === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"') {
        state = c === "'" ? "squote" : "dquote";
        out += c;
        i += 1;
        continue;
      }
      if (c === "`") {
        state = "template";
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && n === "/") {
        state = "code";
        i += 2;
        continue;
      }
      if (c === "\n") {
        out += c;
      }
      i += 1;
      continue;
    }
    out += c;
    if (c === "\\" && i + 1 < source.length) {
      out += source[i + 1];
      i += 2;
      continue;
    }
    if (
      (state === "squote" && c === "'") ||
      (state === "dquote" && c === '"') ||
      (state === "template" && c === "`")
    ) {
      state = "code";
    }
    i += 1;
  }
  return out;
}

function hasActiveMatch(source, re) {
  return re.test(stripJsComments(source));
}

export function extractIndentedBlock(
  text,
  startRe,
  { maxLines = EXCERPT_MAX_LINES, label = "excerpt" } = {},
) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) {
    return "";
  }
  const indent = lines[start].match(/^(\s*)/)[1];
  const closers = new Set([
    `${indent}}`,
    `${indent}});`,
    `${indent}})`,
    `${indent}},`,
  ]);
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length && out.length < maxLines; i += 1) {
    const line = lines[i];
    if (
      i > start &&
      indent === "" &&
      /^(export\s+)?(async\s+)?function\b/.test(line)
    ) {
      throw new Error(`${label} excerpt is unterminated`);
    }
    out.push(line);
    if (closers.has(line)) {
      return out.join("\n");
    }
  }
  if (out.length >= maxLines) {
    throw new Error(`${label} excerpt exceeded cap`);
  }
  throw new Error(`${label} excerpt is unterminated`);
}

export function extractFromTo(
  text,
  startRe,
  endRe,
  { maxLines = EXCERPT_MAX_LINES, label = "excerpt" } = {},
) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) {
    return "";
  }
  const rest = lines.slice(start).join("\n");
  if (!hasActiveMatch(rest, endRe)) {
    const expectHint = /expect\(/.test(String(endRe))
      ? `missing the closing expect (${endRe})`
      : `missing the excerpt end (${endRe})`;
    throw new Error(`${label} excerpt ${expectHint}`);
  }
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length && out.length < maxLines; i += 1) {
    out.push(lines[i]);
    if (endRe.test(stripJsComments(lines[i]))) {
      return out.join("\n");
    }
  }
  if (out.length >= maxLines) {
    throw new Error(`${label} excerpt exceeded cap`);
  }
  throw new Error(`${label} excerpt is unterminated`);
}

export function dedentBlock(block) {
  const lines = block.split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^(\s*)/)[1].length);
  const shift = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(shift)).join("\n");
}

export function finalReturnLine(block) {
  const lines = block.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^\s*return\b/.test(lines[i])) {
      return lines[i].trim();
    }
  }
  return "";
}

/**
 * Pull the broken Playwright test out of a spec. The title is kept; the
 * assertion slice is taken from inside that test only so a reordered file
 * cannot mix in the fixed/control bodies.
 */
export function extractBrokenTest(specText, specRel = "spec") {
  const titleMatch = specText.match(BROKEN_TEST_TITLE);
  if (!titleMatch) {
    throw new Error(
      `spec excerpt empty: no test("broken: …") in ${specRel}`,
    );
  }
  const title = titleMatch[2].replace(/\s+/g, " ").trim();

  const block = extractIndentedBlock(specText, BROKEN_TEST_START, {
    label: `${specRel} broken test`,
    // Large enough to close the test so a missing expect is reported
    // as missing, not as "exceeded cap".
    maxLines: 200,
  });
  if (!block.trim()) {
    throw new Error(
      `spec excerpt empty: no test("broken: …") in ${specRel}`,
    );
  }
  if (!hasActiveMatch(block, OVERLAP_EXPECT)) {
    throw new Error(
      `spec excerpt for ${specRel} is missing expect(overlapHeight…) in the broken test`,
    );
  }
  if (!hasActiveMatch(block, HIT_FOOTER_EXPECT)) {
    throw new Error(
      `spec excerpt for ${specRel} is missing expect(hit.hit?.id).toBe("site-footer") in the broken test`,
    );
  }

  const assertionBlock = extractFromTo(
    block,
    /const \{ action, footer, hit, position \}/,
    HIT_FOOTER_EXPECT,
    { label: specRel },
  );
  if (!assertionBlock.trim()) {
    throw new Error(
      `spec excerpt empty: no broken-test assertions in ${specRel}`,
    );
  }
  if (!hasActiveMatch(assertionBlock, OVERLAP_EXPECT)) {
    throw new Error(
      `spec excerpt for ${specRel} is missing expect(overlapHeight…) in the broken test`,
    );
  }
  return { title, assertionBlock };
}

export const SKILL_GEOMETRY_REL = "skill/lib/geometry.ts";

export function extractHitTestCenter(text, { label = "hitTestCenter" } = {}) {
  return extractIndentedBlock(text, /function hitTestCenter\b/, { label });
}

export function specExcerptsFromTexts({ specRel, specText, helpers }) {
  const { title, assertionBlock } = extractBrokenTest(specText, specRel);
  const geometry = helpers.find((item) => item.rel === SKILL_GEOMETRY_REL);
  if (!geometry || geometry.text == null) {
    throw new Error(
      `hitTestCenter excerpt is empty (searched ${SKILL_GEOMETRY_REL})`,
    );
  }
  const helperBody = extractHitTestCenter(geometry.text);
  const helperRel = SKILL_GEOMETRY_REL;
  if (helperBody.trim().length === 0) {
    throw new Error(
      `hitTestCenter excerpt is empty (searched ${SKILL_GEOMETRY_REL})`,
    );
  }
  const lastReturn = finalReturnLine(helperBody);
  if (!/^return\s*\{\s*x,\s*y,\s*hit,\s*target\s*\}\s*;?\s*$/.test(lastReturn)) {
    throw new Error(
      `hitTestCenter excerpt is missing its final return (last return was: ${lastReturn || "(none)"})`,
    );
  }

  return {
    left: {
      title: `${specRel} (broken)`,
      body: `${title}\n\n${dedentBlock(assertionBlock)}`,
    },
    right: {
      title: `${helperRel} (excerpt)`,
      body: dedentBlock(helperBody),
    },
  };
}

/** flex-grow is the line count so pane height tracks the excerpt, not a fixed 1.35. */
export function paneFlex(lineCount, { minPx = 15, lineHeight = 1.22, chromePx = 54 } = {}) {
  const lines = Math.max(1, lineCount);
  const basis = chromePx + Math.ceil(lines * minPx * lineHeight);
  return `${lines} 0 ${basis}px`;
}
