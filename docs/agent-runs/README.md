# Agent runs

Issue #2 asks for a real coding-agent run against the fixtures, not only the mechanical classifier.

| Agent | Ran? | Notes |
| --- | --- | --- |
| Cursor Grok 4.6 | Yes | [cursor-grok-4.6-2026-10-29.md](cursor-grok-4.6-2026-10-29.md) — all nine fixtures |
| Claude Code | No | Not executed in this repo |
| Codex | No | Not executed in this repo |

Install outside this repository is recorded in [temp-project.md](temp-project.md).

## Blind re-run

The run **currently in progress** ([bc-170139f1](https://cursor.com/agents/bc-170139f1) on `blind-run` `e17125a`) is **isolated by instruction, not blind**. The pages on that commit are neutralized copies of `public/fixtures/<case>/<variant>.html` (about 12–16 lines of diff: title and banner). Anyone who diffs them against this repo, or fetches another ref, recovers the mapping. Isolation was “do not look at other branches,” not a rewrite of the HTML.

Do not have the skill-authoring agent take a scoring run. Do not push a replacement `blind-run` while that agent is running.

A builder that **does** rewrite copy, colors, ids, wrappers, and section content lives in [blind/build-set.mjs](blind/build-set.mjs). It writes answers only to `/tmp/ubc-blind-mapping.json` (or `$UBC_BLIND_MAPPING`) and fails if 12-gram Jaccard similarity to any public fixture is ≥ 0.35.

```bash
node docs/agent-runs/blind/build-set.mjs
node docs/agent-runs/blind/score.mjs /tmp/ubc-blind-mapping.json path/to/results.json
```

### Limitations (plain)

- Commit `37b2f02` still contains `docs/agent-runs/blind/mapping.json` in this branch’s history.
- `blind-run` at `e17125a` is instruction-based isolation, not a hard guarantee, and not a geometric rewrite.
- Rebuilds shuffle p01–p09. Keep the mapping that matches the pages you actually shipped; do not commit it.
