import { expect, test } from "@playwright/test";
import { cases } from "../src/cases.ts";
import { classifyFixture } from "../skill/verify/classify.ts";
import type { Resembles } from "../skill/verify/classify.ts";

/**
 * Mechanical detection for the skill rules in skill/SKILL.md.
 * This is not an LLM run. Each fixture must classify as the variant it is.
 */
const expected: Record<string, Record<string, { resembles: Resembles; bug: boolean }>> =
  {
    "flex-long-text": {
      broken: { resembles: "broken", bug: true },
      fixed: { resembles: "fixed", bug: false },
      control: { resembles: "control", bug: false },
    },
    "fixed-height-label": {
      broken: { resembles: "broken", bug: true },
      fixed: { resembles: "fixed", bug: false },
      control: { resembles: "control", bug: false },
    },
    "fixed-footer-overlap": {
      broken: { resembles: "broken", bug: true },
      fixed: { resembles: "fixed", bug: false },
      control: { resembles: "control", bug: false },
    },
  };

test.describe("agent-skill detection", () => {
  for (const item of cases) {
    for (const variant of ["broken", "fixed", "control"] as const) {
      const want = expected[item.id]?.[variant];
      if (!want) {
        throw new Error(`missing skill expectation for ${item.id} ${variant}`);
      }
      test(`${item.id} ${variant}: resembles ${want.resembles}, bug=${want.bug}`, async ({
        page,
      }) => {
        const result = await classifyFixture(
          page,
          item.variants[variant].path,
          item.viewport,
        );
        expect(result.caseId).toBe(item.id);
        expect(result.resembles).toBe(want.resembles);
        expect(result.bug).toBe(want.bug);
      });
    }
  }
});
