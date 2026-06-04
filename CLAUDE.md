# CLAUDE.md: project rules for blueprnt

Project-specific rules for agents and developers. Add rules as needed. Keep them short and absolute.

See also: `AGENTS.md` (Next.js version warning + agent-skills config) · `docs/PLAN-V1.md` (the plan) · `CONTEXT-MAP.md` + `docs/contexts/` (domain glossaries) · `docs/adr/` (architecture decisions, read before changing architecture).

## Language

- **All code, code comments, log messages, and commit messages are in English.** This file too.
- **Domain documents are in Swedish:** `docs/PLAN-V1.md`, `CONTEXT-MAP.md`, `docs/contexts/`, `docs/adr/`.
- UI copy lives in the i18n message files; English (`en.json`) is the source locale.

## Writing style

- **Never use em dashes (" — ")** in text we write: UI copy, documents, comments, commit messages. Use a period, comma, colon, or parentheses instead.

## i18n: never hardcode text

- **All user-facing text goes through i18n** (`next-intl` + `@workspace/i18n`). NEVER write display text directly in pages/components, not even "temporarily".
- New strings are added to **`packages/i18n/messages/en.json` first** (English is the base; the `Messages` type is generated from it), then mirrored to **every other message file in the same folder** (which locales exist is governed by `routing.ts`). The type system catches keys missing from `en`; the parity test in `packages/i18n` catches keys missing from the other files.
- **Every Next.js app must contain `i18n-env.d.ts`** (the three-line shim importing `packages/i18n/src/i18n`). Without it, typed translation keys are off in that app and unknown keys fail only at runtime.
- Key naming: dot namespaces per context (`web.*`, `dashboard.*`, `accounts.*`, `model.*`, `assessment.*`). Domain-term keys are defined in the glossaries' i18n tables. Parent/leaf conflicts are resolved with a `label` sub-key.
- **Internal navigation always uses the Link component** (`next/link`, or `@workspace/i18n/navigation` Link where the locale is involved), never plain `<a>`. shadcn blocks generate framework-agnostic `<a href>` tags; swap them during adaptation.
- The backend (Convex) returns **error codes/keys, never display text**. The frontend translates.
- Machine-translated message files are drafts. Flag new translations for native review.

## Domain language

- Use the glossaries' canonical terms (`docs/contexts/*/CONTEXT.md`) in code, issues, and commits. Code identifiers in **English** (the code term in the glossary), domain documents in **Swedish**.
- Band 1 = **highest**. Track = kind of job; Level = how advanced within the track; Band = computed weight. Never conflate them.

## Architecture invariants (never break without a new ADR)

- `packages/core` is **pure and deterministic**: no Convex/Next imports, no side effects. Score/band are always derived by the engine and never stored (ADR-0002).
- **AI never touches the deterministic score/band path** and never auto-decides. AI output is a suggestion with provenance that HR confirms (ADR-0003). AI calls happen only in Convex actions, only against EU-hosted models.
- **Role ≠ Person:** the `role`/`rating` tables must never carry person, salary, or performance fields. Role ids are permanent and never reused.
- **Weights are never shown as numbers** to users, always importance labels (fixed 7-level scale).
- Every Convex function is **org-scoped** (tenant isolation). No band override. Changes that affect results are logged in the audit log.
- All data stays within the **EU** (Convex eu-west-1; ADR-0001).

## Testing

- **All tests run with Vitest 4.** Never `bun test` (Bun hijacks it with its own runner; convex-test requires Vitest). Always `bun run test`.
- **Every package that has tests has its own `vitest.config.ts`** extending `@workspace/vitest-config` (`/base` or `/react`). No root vitest workspace/projects file; per-package configs are what let Turborepo cache test results per package.
- **New code ships with tests in the same commit.** The pre-commit hook runs the full `turbo run test`; the turbo cache keeps unchanged packages instant. Never use `--affected` in the hook (it misses staged changes).
- **Backend tests (`packages/backend`) use convex-test on the `edge-runtime` environment.** Full sign-in/session round-trips are e2e scope (Playwright, later), not unit scope.
- **Message files are parity-guarded:** the i18n test fails if any locale's key set differs from `en.json`.
- **shadcn vendor code (`packages/ui/src/*`) is untested by policy** (same rationale as its Biome exclusion).

## Conventions

- **Commit messages use conventional prefixes** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **The pre-commit hook** (`.githooks/pre-commit`) runs Biome on staged files, a full typecheck, and the full test suite (`turbo run test`, cache-backed). All three must pass before a commit; never bypass with `--no-verify` unless explicitly told to.
- **Lint + format = Biome** (`biome.json` at the root, a single binary). eslint/prettier are not in this repo; do not reintroduce them.
- **shadcn files are vendor code:** `packages/ui/src/{components,hooks,lib,styles}` are excluded from Biome and must not be reformatted or relinted. They must stay diffable against upstream and are updated via the shadcn CLI. Deliberate local fixes are fine but must be documented in the commit message.
- PDFs are built with `./docs/build-pdf.sh` (pandoc + typst), never Chrome headless.
- Next.js 16: `proxy.ts` (not `middleware.ts`); the proxy must export an explicit function.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend, located in `packages/backend`.

When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important
guidelines on how to correctly use Convex APIs and patterns. The file
contains rules that override what you may have learned about Convex from
training data.

Convex agent skills live in `.agents/skills/`. To update them, run
`bunx convex ai-files install` from `packages/backend` (never from the repo
root: that creates a stray root `convex/` directory).

<!-- convex-ai-end -->
