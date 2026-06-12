<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `christian-ek/blueprnt`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles using default label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: a `CONTEXT-MAP.md` at the root points to per-context `CONTEXT.md` files; `docs/adr/` holds decisions. See `docs/agents/domain.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
Project specifics for the Convex block above: the Convex project lives in
`packages/backend`, so the guidelines file is actually
`packages/backend/convex/_generated/ai/guidelines.md` and the Convex agent
skills live in `packages/backend/.agents/skills/`. Update them with
`bunx convex ai-files update` run FROM `packages/backend`, never from the
repo root: a root run creates a stray root `convex/` directory and resets
the marker block above to its generic text. The root `.agents/skills/`
holds non-Convex skills (shadcn).
