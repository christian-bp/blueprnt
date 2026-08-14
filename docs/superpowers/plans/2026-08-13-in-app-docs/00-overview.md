# In-App Documentation and Assistant Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 56-page, five-locale MDX documentation corpus rendered at `/docs` inside the dashboard, and ground the assistant in it through a Convex full-text `search_docs` tool.

**Architecture:** MDX files per locale under `apps/dashboard/content/docs/` are the single source of truth, rendered with `next-mdx-remote/rsc` behind the existing app shell; a sync script chunks them per `##` heading into a Convex `docsChunks` search table that the assistant queries as its fifth read-only tool. Navigation structure lives in one TypeScript file; titles live only in frontmatter; ten drift guards keep content, nav, links, terms, errors, and the assistant prompt in sync.

**Tech Stack:** Next.js 16 App Router (RSC), next-mdx-remote@^6, remark-gfm@^4, gray-matter@^4, next-intl (cookie locale, no URL segment), Convex search indexes, convex-test, Vitest 4, Bun.

**Spec:** `docs/superpowers/specs/2026-08-13-in-app-docs-design.md`

## Global Constraints

- **No commits during execution.** The repo rule overrides this skill's commit steps: all work stays uncommitted for Christian's review; commits happen only after explicit approval, as focused single-concern commits on main. Every task's "Commit" step is therefore replaced by "leave staged-ready, continue".
- No git worktrees, no feature branches: work directly in the main checkout.
- Language: all code, comments, and filenames in English. ADR-0019 and dossier files that are domain documents are in Swedish where the spec says so (ADR yes, dossier is working material and stays English).
- Never use em dashes in any text we write (docs content, i18n values, comments, ADR).
- i18n: every UI string through `next-intl`; new keys land in `packages/i18n/messages/en.json` first, then mirrored to sv/nb/da/fi in the same change. MDX bodies are per-locale content files, not message keys.
- Terminology: glossary canonical terms everywhere (Level 1 is highest; track vs seniority vs level vs step per ADR-0014). Quoted UI labels in docs use the exact wording of the corresponding i18n message in that locale. International job titles stay English in all locales.
- Biome must end at zero (errors, warnings, info) on every touched file; shadcn vendor files in `packages/ui/src` are never touched.
- All tests are Vitest 4, run via `bun run test` (never `bun test`), shipped in the same change as what they guard.
- Backend work follows `packages/backend/convex/_generated/ai/guidelines.md`; every schema change ends with a dev-deployment push and a browser verification pass.
- Convex writes stay bounded: sync writes one page per mutation call, never one unbounded transaction.
- AI invariants (ADR-0018 carried forward): tools are read-only, org-scoped or content-only, no PII ever reaches a prompt, all calls in Convex actions against the configured EU-hosted model.

## Phase files

| Phase | File | Deliverable |
|---|---|---|
| 1 | `01-knowledge-dossier.md` | Per-section product dossier under `docs/superpowers/analysis/2026-08-13-product-dossier/` |
| 2 | `02-skeleton.md` | Rendering pipeline, nav, routes, sidebar entry, i18n chrome, 3 seed pages x 5 locales, guards 1-4 |
| 3 | `03-english-corpus.md` | All 56 English pages, guards 5-7, consolidation review pass |
| 4 | `04-translations.md` | sv/nb/da/fi corpora, parity green, go-live checklist entry |
| 5 | `05-backend-assistant.md` | `docs` Convex context, chunker, sync script, `search_docs`, prompt update, ADR-0019, guards 8-10, dev deploy + browser pass |
| 6 | `06-wrapup.md` | CONTEXT-MAP entry, go-live checklist entries, file-by-file change summary |

Phases execute in order. Phase 3 depends on 1 and 2; phase 4 on 3; phase 5 can start its backend tasks after 2 but its final sync/browser pass needs 3 (and ideally 4) in place.

## Established facts (verified 2026-08-13, do not re-derive)

- The dashboard has NO locale URL segment; locale comes from a cookie via `apps/dashboard/i18n/request.ts` (`resolveUiLocale`). Server components use `getLocale()`/`getTranslations()` from `next-intl/server`. Message files are statically imported there (Turbopack dev-server bug, see the comment in that file); docs MDX is read from the filesystem and is NOT affected, but new i18n keys need a dev-server restart to show.
- `AssistantPrompt` (`apps/dashboard/components/assistant/assistant-prompt.tsx`) takes no props and is self-contained; reuse as-is on the docs index.
- The app sidebar is `apps/dashboard/components/app-sidebar.tsx`; nav items live in arrays (`navStatus`, `navEvaluation`, `navPeoplePay`, `navAdmin`) with `t("nav.<key>")` titles.
- `slugify` lives in `packages/constants/src/slug.ts` (ASCII-folding, lowercase, hyphenated). It is the shared slugifier for heading anchors (renderer AND chunker).
- Convex schema: context table modules under `packages/backend/convex/<context>/tables.ts`, registered in `packages/backend/convex/schema.ts`. Test helper: `initConvexTest` in `packages/backend/convex/testing.helpers.ts`; backend tests run convex-test on edge-runtime.
- `errors` namespace in `packages/i18n/messages/en.json` has 31 keys (the troubleshooting coverage source). `dashboard.nav` currently has no `docs` key.
- The assistant generation action (`packages/backend/convex/assistant/generate.ts`) already receives `locale` in its args and builds tools via `buildAssistantTools(ctx, { orgId })` (`assistant/tools.ts`); the system prompt builder is `assistantSystemPrompt` (`assistant/knowledge.ts`) with tests in `assistant/knowledge.test.ts`.
- `apps/dashboard` devDeps include `@workspace/vitest-config` and testing-library; `vitest.config.ts` extends the react config, aliases `@` to the app root and `@workspace/i18n/messages` to the messages folder.
- New dependencies to add (Phase 2, in `apps/dashboard`): `next-mdx-remote@^6.0.0`, `remark-gfm@^4.0.1`, `js-yaml@^4.3.1` (+ `@types/js-yaml`). (Corrected during execution: gray-matter is broken by the repo's js-yaml 4 security override; frontmatter parsing goes through `lib/docs/parse-mdx.ts`.)
