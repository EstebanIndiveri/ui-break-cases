# Blind fixture set (for a fresh agent)

The recorded Cursor run in `docs/agent-runs/cursor-grok-4.6-2026-10-29.md` was **not** blind.

The in-progress run [bc-170139f1](https://cursor.com/agents/bc-170139f1) on `blind-run` `e17125a` is **isolated by instruction, not blind**: those pages still match `public/fixtures` aside from titles and banners.

This folder’s **builder** rewrites each page so only the bug geometry remains. Mapping stays at `/tmp/ubc-blind-mapping.json`. Do not commit it. Do not push a new `blind-run` while bc-170139f1 is running.

Similarity gate: 12-gram Jaccard vs every file in `public/fixtures` must be **&lt; 0.35**.

```bash
node docs/agent-runs/blind/build-set.mjs
node docs/agent-runs/blind/score.mjs /tmp/ubc-blind-mapping.json path/to/results.json
```
