# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**This repo is multi-context.** A `CONTEXT-MAP.md` at the root points at one `CONTEXT.md` per bounded context. System-wide ADRs live in `docs/adr/`; context-scoped ADRs live alongside each context. The map and the per-context `CONTEXT.md` files are created lazily by `/grill-with-docs` as terms and decisions are resolved — they may not all exist yet.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`CONTEXT.md`** at the repo root, if a stray single-context file exists.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check `<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo uses the multi-context layout (signalled by `CONTEXT-MAP.md` at the root):

```
/
├── CONTEXT-MAP.md                     ← map of bounded contexts → their CONTEXT.md
├── docs/adr/                          ← system-wide decisions
└── <context dirs>/
    ├── <context>/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── ...
```

Context directories will be established during domain modelling. Until then, the map records the intended bounded contexts and where their `CONTEXT.md` will live.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
