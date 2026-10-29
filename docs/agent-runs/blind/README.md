# Blind fixture set (for a fresh agent)

The recorded Cursor run in `docs/agent-runs/cursor-grok-4.6-2026-10-29.md` was **not** blind.

These runs are **isolated by instruction only**. There is no network-isolated environment.

- **[bc-170139f1](https://cursor.com/agents/bc-170139f1)** on `blind-run` `e17125a` was **isolated by instruction, not blind**: those pages still match `public/fixtures` aside from titles and banners, so the mapping can be decoded from the public files.
- This branch’s history still contains the earlier sets and builders (`37b2f02` mapping, `73fbd4d` disguised set and builder). It does **not** contain the new set. The builder lives outside this repository.
- Keep `score.mjs` and `prompt.md`. Do not commit mapping files. Do not push a replacement `blind-run` while bc-170139f1 is running.

`score.mjs` **does** penalize cross-case false positives when another case is reported with `bug === true`. It does not fail extra matches that only report `bug: false`. Contradictory matches for the same case fail. Broken pages need captured `specOutput` that fails via `expect(received)`; `specFailedViaExpect` is ignored.

```bash
node docs/agent-runs/blind/score.mjs path/to/mapping.json path/to/results.json
```
