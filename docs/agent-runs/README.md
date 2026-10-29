# Agent runs

Issue #2 asks for a real coding-agent run against the fixtures, not only the mechanical classifier.

| Agent | Ran? | Notes |
| --- | --- | --- |
| Cursor Grok 4.6 | Yes | [cursor-grok-4.6-2026-10-29.md](cursor-grok-4.6-2026-10-29.md) — all nine fixtures |
| Claude Code | No | Not executed in this repo |
| Codex | No | Not executed in this repo |

Install outside this repository is recorded in [temp-project.md](temp-project.md).

## Isolation (plain)

These runs are **isolated by instruction only**. There is no network-isolated environment, no hidden remote, and nothing that stops an agent from fetching other branches or this repository.

- **[bc-170139f1](https://cursor.com/agents/bc-170139f1)** on `blind-run` `e17125a` was **isolated by instruction, not blind**. Its pages are neutralized copies of `public/fixtures/<case>/<variant>.html` (title and banner). Diffing them against the public fixtures recovers the mapping.
- This branch’s history still contains the earlier sets and builders (`mapping.json` at `37b2f02`; the disguised invoice/kitchen/library set and `build-set.mjs` at `73fbd4d`). It does **not** contain the new set. That set is generated outside this repository.
- Do not have the skill-authoring agent take a scoring run. Do not replace `blind-run` while bc-170139f1 is running.

`score.mjs` **does** penalize cross-case false positives: an extra `matches[]` entry with `bug === true` or `resembles: "broken"` fails that page. Extra matches that only report another case as fixed or control (`bug: false`) are not penalized. Non-boolean `bug` values and fields `prompt.md` does not define fail the page. Two matches for the same case that disagree on `resembles` or `bug` fail. Broken pages also need a fix and `specOutput` **self-reported by the agent; the scorer does not re-run specs**. That string must include Playwright's `N failed` summary with no `N passed` and a real `Error: expect(received)` block (`Expected`/`Received` and `at file:line`). Timeouts / `Rejected to value` do not count. `specFailedViaExpect` is ignored.

```bash
node docs/agent-runs/blind/score.mjs path/to/mapping.json path/to/results.json
```

The builder is no longer in this repository. Do not commit mapping files.

## Second isolated run (`blind-run-2`)

Only one Cursor Cloud Agent run per set has been done. Claude Code and Codex have not been run.

- **Run:** [Cursor Cloud Agent bc-b16130fc-59e2-5f86-a130-58d71f5d494d](https://cursor.com/agents/bc-b16130fc-59e2-5f86-a130-58d71f5d494d). Results are on orphan branch `blind-run-2` at commit [`2225f8a7c23d377a15a60e25ca8ecef944760cc8`](https://github.com/EstebanIndiveri/ui-break-cases/commit/2225f8a7c23d377a15a60e25ca8ecef944760cc8). It started from `03b68c4`.
- **Official score:** 9/9, scored by an independent reviewer with `score.mjs` from `9193531` (which parses `specOutput`) against a private mapping that is not in the repo.
- **Method:** Regenerated set (max 12-gram Jaccard 0.100 against the public fixtures and the previous sets). Isolated by instruction only, no network sandbox. 1 run, 1 model, n=9.
- **p01:** The agent’s reported doubt on `p01`: it classified `p01` as broken from the text clip (`clippedBottom` 68px with overflow hidden and no expand control), not from a box overlap. The 24px box itself does not overlap `#rest`.
