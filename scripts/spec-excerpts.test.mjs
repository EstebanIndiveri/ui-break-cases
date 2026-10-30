import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractBrokenTest,
  paneFlex,
  SKILL_GEOMETRY_REL,
  specExcerptsFromTexts,
} from "./lib/spec-excerpts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_REL = "tests/fixed-footer-overlap.spec.ts";

const BROKEN_TEST = `  test("broken: at end of scroll the footer covers Confirm booking", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.broken.path, spec.viewport);

    await expect(readText(page.locator("#last-action"))).resolves.toBe(
      FOOTER_ACTION_LABEL,
    );

    const { action, footer, hit, position } = await measureAtEnd(page);
    expect(position).toBe("fixed");
    expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);
    expect(hit.hit?.id).toBe("site-footer");
  });`;

const FIXED_TEST = `  test("fixed: reserved space keeps the last control hittable at end of scroll", async ({
    page,
  }) => {
    await openFixture(page, spec.variants.fixed.path, spec.viewport);

    await expect(readText(page.locator("#last-action"))).resolves.toBe(
      FOOTER_ACTION_LABEL,
    );

    const { action, footer, hit, position } = await measureAtEnd(page);
    expect(position).toBe("fixed");
    expect(overlapHeight(action, footer)).toBeLessThanOrEqual(GEOM_TOLERANCE_PX);
    expect(action.bottom).toBeLessThanOrEqual(footer.top + GEOM_TOLERANCE_PX);
    expectInViewport(action, spec.viewport);
    expect(hit.hit?.id).toBe("last-action");
    await clickCenter(page, hit);
    await expect(page.locator("#action-status")).toHaveText("Booking confirmed");
  });`;

const HIT_TEST_CENTER = `export async function hitTestCenter(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number; hit: Hit | null; target: DomRect }> {
  const target = await boundingRect(page, selector);
  const x = target.left + target.width / 2;
  const y = target.top + target.height / 2;
  const hit = await page.evaluate(
    ({ x: px, y: py }) => {
      const node = document.elementFromPoint(px, py);
      if (!node || !(node instanceof HTMLElement)) {
        return null;
      }
      return { id: node.id, tag: node.tagName.toLowerCase() };
    },
    { x, y },
  );
  return { x, y, hit, target };
}
`;

function specWith(...tests) {
  return `test.describe("fixed-footer-overlap", () => {\n${tests.join("\n\n")}\n});\n`;
}

function excerpts(specText, helpers) {
  return specExcerptsFromTexts({
    specRel: SPEC_REL,
    specText,
    helpers: helpers ?? [{ rel: SKILL_GEOMETRY_REL, text: HIT_TEST_CENTER }],
  });
}

describe("extractBrokenTest", () => {
  it("keeps the broken test title and overlapHeight assertion from the real spec", async () => {
    const specText = await readFile(path.join(ROOT, SPEC_REL), "utf8");
    const { title, assertionBlock } = extractBrokenTest(specText, SPEC_REL);
    assert.equal(
      title,
      "broken: at end of scroll the footer covers Confirm booking",
    );
    assert.match(assertionBlock, /expect\(\s*overlapHeight/);
    assert.match(assertionBlock, /site-footer/);
    assert.doesNotMatch(assertionBlock, /Booking confirmed/);
    assert.doesNotMatch(assertionBlock, /last-action/);
  });

  it("fails loudly when the broken: title is renamed", () => {
    const specText = specWith(
      BROKEN_TEST.replace("broken:", "regression:"),
      FIXED_TEST,
    );
    assert.throws(
      () => extractBrokenTest(specText, SPEC_REL),
      /no test\("broken:/,
    );
  });

  it("still extracts only the broken test when the fixed test is first", () => {
    const specText = specWith(FIXED_TEST, BROKEN_TEST);
    const { title, assertionBlock } = extractBrokenTest(specText, SPEC_REL);
    assert.equal(
      title,
      "broken: at end of scroll the footer covers Confirm booking",
    );
    assert.match(assertionBlock, /CLEAR_DEFECT_PX/);
    assert.doesNotMatch(assertionBlock, /Booking confirmed/);
    assert.doesNotMatch(assertionBlock, /last-action/);
    const excerptsResult = excerpts(specText);
    assert.doesNotMatch(excerptsResult.left.body, /Booking confirmed/);
    assert.match(excerptsResult.left.title, /\(broken\)/);
    assert.match(excerptsResult.left.body, /^broken:/);
  });

  it("fails when expect(overlapHeight…) is missing from the broken test", () => {
    const specText = specWith(
      BROKEN_TEST.replace(
        "    expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);\n",
        "",
      ),
    );
    assert.throws(
      () => extractBrokenTest(specText, SPEC_REL),
      /missing expect\(overlapHeight/,
    );
  });

  it("ignores a line-commented expect(overlapHeight…)", () => {
    const specText = specWith(
      BROKEN_TEST.replace(
        "    expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);\n",
        "    // expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);\n",
      ),
    );
    assert.throws(
      () => extractBrokenTest(specText, SPEC_REL),
      /missing expect\(overlapHeight/,
    );
  });

  it("ignores a block-commented expect(overlapHeight…)", () => {
    const specText = specWith(
      BROKEN_TEST.replace(
        "    expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX);\n",
        "    /* expect(overlapHeight(action, footer)).toBeGreaterThan(CLEAR_DEFECT_PX); */\n",
      ),
    );
    assert.throws(
      () => extractBrokenTest(specText, SPEC_REL),
      /missing expect\(overlapHeight/,
    );
  });

  it("says the hit expect is missing instead of exceeded cap", () => {
    const padding = Array.from(
      { length: 30 },
      (_, i) => `    const pad${i} = ${i};`,
    ).join("\n");
    const specText = specWith(
      BROKEN_TEST.replace(
        '    expect(hit.hit?.id).toBe("site-footer");\n',
        `${padding}\n`,
      ),
    );
    assert.throws(
      () => extractBrokenTest(specText, SPEC_REL),
      (error) => {
        assert.match(
          String(error.message),
          /missing expect\(hit\.hit\?\.id\)\.toBe\("site-footer"\)/,
        );
        assert.doesNotMatch(String(error.message), /exceeded cap/);
        return true;
      },
    );
  });
});

describe("hitTestCenter excerpt errors", () => {
  it("rethrows exceeded cap instead of reporting an empty excerpt", () => {
    const lines = ["function hitTestCenter() {"];
    for (let i = 0; i < 30; i += 1) {
      lines.push(`  const x${i} = ${i};`);
    }
    lines.push("  return { x, y, hit, target };");
    lines.push("}");
    const helpers = [{ rel: SKILL_GEOMETRY_REL, text: lines.join("\n") }];
    assert.throws(
      () => excerpts(specWith(BROKEN_TEST), helpers),
      (error) => {
        assert.match(String(error.message), /exceeded cap/);
        assert.doesNotMatch(String(error.message), /excerpt is empty/);
        return true;
      },
    );
  });

  it("rethrows unterminated instead of reporting an empty excerpt", () => {
    const helpers = [
      {
        rel: SKILL_GEOMETRY_REL,
        text: `function hitTestCenter() {\n  return { x, y, hit, target };\n`,
      },
    ];
    assert.throws(
      () => excerpts(specWith(BROKEN_TEST), helpers),
      (error) => {
        assert.match(String(error.message), /unterminated/);
        assert.doesNotMatch(String(error.message), /excerpt is empty/);
        return true;
      },
    );
  });

  it("fails if skill/lib/geometry.ts is missing even when tests/helpers.ts has the function", () => {
    assert.throws(
      () =>
        excerpts(specWith(BROKEN_TEST), [
          { rel: "tests/helpers.ts", text: HIT_TEST_CENTER },
          { rel: SKILL_GEOMETRY_REL, text: null },
        ]),
      /searched skill\/lib\/geometry\.ts/,
    );
  });

  it("uses skill/lib/geometry.ts even when tests/helpers.ts is listed first", async () => {
    const geometry = await readFile(
      path.join(ROOT, SKILL_GEOMETRY_REL),
      "utf8",
    );
    const result = excerpts(specWith(BROKEN_TEST), [
      { rel: "tests/helpers.ts", text: HIT_TEST_CENTER },
      { rel: SKILL_GEOMETRY_REL, text: geometry },
    ]);
    assert.equal(result.right.title, "skill/lib/geometry.ts (excerpt)");
    assert.match(result.right.body, /elementFromPoint/);
    assert.match(result.right.body, /Hit \| null/);
  });
});

describe("paneFlex", () => {
  it("weights height by line count instead of a fixed 1.35", () => {
    assert.equal(paneFlex(4), "4 0 128px");
    assert.equal(paneFlex(19), "19 0 402px");
  });
});
