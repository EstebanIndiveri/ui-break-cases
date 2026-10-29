# Blind fixture set (for a fresh agent)

The recorded Cursor run in `docs/agent-runs/cursor-grok-4.6-2026-10-29.md` was **not** blind: URLs, titles, and banners named the variant, and the same agent wrote the skill.

Do **not** have that agent (or this one) score itself. Launch a **new** agent against the `blind-run` branch (`prompt.md` + `set/` only).

Keep the answers **out** of git. The builder writes them to `/tmp/ubc-blind-mapping.json` (override with `UBC_BLIND_MAPPING`). `score.mjs` takes that path as an argument. `mapping.json` is gitignored and must not be committed.

## Limitations

The old mapping from commit `37b2f02` is still in this branch’s history. Isolation on `blind-run` is instruction-based, not a hard guarantee.

## After the run

Score a `results.json` the agent wrote:

```bash
node docs/agent-runs/blind/score.mjs /tmp/ubc-blind-mapping.json path/to/results.json
```

Rebuild (new random order; updates `/tmp/ubc-blind-mapping.json`):

```bash
node docs/agent-runs/blind/build-set.mjs
```
