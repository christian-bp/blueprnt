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

### Overrides to the vendored shadcn skill

`.agents/skills/shadcn/` is vendored skill content, updated by the shadcn CLI, so it is not edited locally. Where it disagrees with this repo, the rule below and `CLAUDE.md` win.

- **Toasts do not use `sonner`.** That dependency is removed. The skill's `import { toast } from "sonner"` no longer resolves. Toasts go through `@/lib/toast` (the app's `success`/`error` API) over the Base UI toast in `@workspace/ui/components/toast`, whose `<Toaster>` is mounted in `providers.tsx`. See the toast convention in `CLAUDE.md`.
