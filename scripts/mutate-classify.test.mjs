import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyRun } from "./mutate-classify.mjs";

describe("classifyRun", () => {
  it("does not treat a failure that merely mentions 'timed out' as a timeout", () => {
    const result = classifyRun({
      code: 1,
      stdout: `Running 3 tests using 1 worker
Error: notes said the animation timed out the layout
  1 failed
  2 passed
`,
      stderr: "",
    });
    assert.equal(result.status, "killed");
    assert.match(result.detail, /1 failed/);
  });

  it("still classifies Playwright 'Test timeout of Nms' as timeout", () => {
    const result = classifyRun({
      code: 1,
      stdout: `Running 1 tests using 1 worker
  1) tests/agent-skill.spec.ts:10:3 › example
    Test timeout of 30000ms exceeded.
  1 failed
`,
      stderr: "",
    });
    assert.equal(result.status, "timeout");
  });

  it("still classifies 'Timeout of Nms exceeded' as timeout", () => {
    const result = classifyRun({
      code: 1,
      stdout: `Running 1 tests using 1 worker
    Timeout of 5000ms exceeded.
  1 failed
`,
      stderr: "",
    });
    assert.equal(result.status, "timeout");
  });

  it("still classifies a Playwright (timed out) suffix as timeout", () => {
    const result = classifyRun({
      code: 1,
      stdout: `Running 1 tests using 1 worker
  1) tests/agent-skill.spec.ts:10:3 › example (timed out)
  1 failed
`,
      stderr: "",
    });
    assert.equal(result.status, "timeout");
  });

  it("prefers killed when expect(received) appears next to a timeout phrase", () => {
    const result = classifyRun({
      code: 1,
      stdout: `Running 1 tests using 1 worker
    Error: expect(received).toBe(expected)
    Test timeout of 30000ms exceeded.
  1 failed
`,
      stderr: "",
    });
    assert.equal(result.status, "killed");
  });
});
