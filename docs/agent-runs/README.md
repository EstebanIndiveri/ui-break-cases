# Agent runs

Issue #2 asks for a real coding-agent run against the fixtures, not only the mechanical classifier.

| Agent | Ran? | Notes |
| --- | --- | --- |
| Cursor Grok 4.6 | Yes | [cursor-grok-4.6-2026-10-29.md](cursor-grok-4.6-2026-10-29.md) — all nine fixtures |
| Claude Code | No | Not executed in this repo |
| Codex | No | Not executed in this repo |

Install outside this repository is recorded in [temp-project.md](temp-project.md).

## Blind re-run

A **blind** re-run (neutral filenames, no banners) is prepared for a **fresh** agent. Do not have the skill-authoring agent take that run.

Give that agent the `blind-run` branch only (`prompt.md` + `set/` at the top level). Score later with [blind/score.mjs](blind/score.mjs) against a mapping file that is **not** in the repo:

```bash
node docs/agent-runs/blind/build-set.mjs
# writes pages into docs/agent-runs/blind/set/
# writes answers to /tmp/ubc-blind-mapping.json (or $UBC_BLIND_MAPPING)

node docs/agent-runs/blind/score.mjs /tmp/ubc-blind-mapping.json path/to/results.json
```

### Limitations (plain)

- An earlier commit on this branch (`37b2f02`) still contains `docs/agent-runs/blind/mapping.json`. Anyone who can read this branch’s history can recover that old p01–p09 mapping. Deleting the file from HEAD does not erase it.
- Putting the pages on the orphan `blind-run` branch is **instruction-based isolation**, not a hard guarantee. A determined agent can still fetch other refs, walk history, or match HTML against `public/fixtures`. Do not treat “we told it not to look” as cryptographic blindness.
- Rebuilds shuffle p01–p09 again. Keep the mapping that matches the pages you actually shipped; do not commit it.
