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

`score.mjs` **does** penalize cross-case false positives: an extra `matches[]` entry with `bug === true` fails that page. Extra matches with `bug: false` (another case reported as fixed or control) are not penalized. Broken pages also need a fix and spec output that fails via `expect(received)` (timeouts / `Rejected to value` do not count).

```bash
node docs/agent-runs/blind/score.mjs path/to/mapping.json path/to/results.json
```

The builder is no longer in this repository. Do not commit mapping files.
