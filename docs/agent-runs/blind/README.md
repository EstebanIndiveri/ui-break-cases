# Blind fixture set (for a fresh agent)

The recorded Cursor run in `docs/agent-runs/cursor-grok-4.6-2026-10-29.md` was **not** blind: URLs, titles, and banners named the variant, and the same agent wrote the skill.

Do **not** have that agent (or this one) score itself on this set. Launch a **new** agent that only receives:

1. The skill package (`skill/` and `.agents/skills/ui-break-cases/`)
2. [`prompt.md`](prompt.md)
3. The pages in [`set/`](set/) (`pages.json` + `p01.html`…`p09.html`)

Keep these **out** of that agent’s context:

- [`mapping.json`](mapping.json) — answers
- [`score.mjs`](score.mjs) — scorer
- [`build-set.mjs`](build-set.mjs) — regenerates the set from `public/fixtures`

## After the run

The agent should write `docs/agent-runs/blind/results.json`. Score it:

```bash
node docs/agent-runs/blind/score.mjs
# or: node docs/agent-runs/blind/score.mjs path/to/results.json
```

Rebuild the HTML (does not belong in a blind prompt):

```bash
node docs/agent-runs/blind/build-set.mjs
```
