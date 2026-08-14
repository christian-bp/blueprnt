# In-App Documentation and Assistant Grounding Design

**Date:** 2026-08-13
**Status:** Proposed
**Plan:** `docs/superpowers/plans/2026-08-13-in-app-docs/` (written after spec approval)

## What was asked

1. Plan and build a large body of user-facing documentation covering everything the
   application does today.
2. Model the documentation system on how midday does it (cloned at
   `/Volumes/development/personal/midday`): MDX files as the content source.
3. Every domain term (track, level, seniority, step, and the rest) must be clearly
   explained, and the assistant must be able to answer questions about everything a user
   can encounter in the app.
4. Before writing content, systematically read ALL internal documentation written over
   the project's lifetime (ADRs, specs, plans, glossaries, research documents) so the
   docs are written from full understanding, not just a route inventory.
5. Final step: the assistant (Blueprnt AI) uses the documentation as a knowledge source.

## What midday actually does (verified in their repo)

- 52 flat MDX files in `apps/website/src/app/docs/content/`, rendered with
  `next-mdx-remote/rsc` + `remark-gfm` inside their marketing site. They migrated OFF
  Mintlify (commit `ea58c8b13`, 2026-01-19) to own the pipeline.
- Frontmatter: `title`, `description`, `section`, `order`. Navigation is a hardcoded
  TypeScript array (`docsNavigation` in `lib/docs.ts`). No images, no custom MDX
  components, no search, English only.
- Their docs chat does NOT use the docs: it is a static system prompt summarizing the
  product (no RAG, no embeddings, no llms.txt). For requirement 5 we deliberately go
  beyond midday.

Two midday weaknesses we correct rather than copy: page titles are duplicated between
frontmatter and the nav array (we keep titles in frontmatter only), and frontmatter is
parsed with a hand-written regex (we use `gray-matter` and validate with Zod in tests).

## Decisions (settled with Christian, 2026-08-13)

| Decision | Choice | Rejected alternatives |
|---|---|---|
| Where docs live | In-app help center at `/docs` inside `apps/dashboard`'s `(app)` shell (the shell's auth gate is client-side only, not server-enforced; see ADR-0019) | Separate public `apps/docs` (new deploy target, duplicated design system; marketing site lives in Lovable, not this repo); content-only package with no reading surface |
| Languages | All five locales (en source, sv/nb/da/fi AI-drafted, flagged for native review) | en+sv first (deliberate i18n-rule deviation); en only (breaks the i18n rule) |
| Assistant mechanism | Convex full-text search over synced doc chunks, exposed as a fifth read-only tool `search_docs` | Embeddings/RAG via Mistral embed (new infra, harder to test; possible later step if full-text recall proves insufficient); whole corpus in the system prompt (does not scale past a handful of pages) |

## Governance

- **ADR-0019** (Swedish, per the docs language rule) is written as part of this work:
  in-app documentation as a first-class surface, MDX in the repo as the single source of
  truth, the Convex `docsChunks` table as a derived, rebuildable cache (never edited by
  hand), and the assistant's grounding through a read-only search tool. This extends
  ADR-0018's fixed tool set. The ADR-0018 invariants all carry forward unchanged: AI only
  in Convex actions against EU-hosted models, read-only tools, no personal data in
  prompts (docs content is product documentation and contains none), no writes.
- The i18n rule applies to the docs system in both of its halves: the docs page chrome
  (section labels, prev/next, index copy) goes through `next-intl` messages, and the MDX
  content itself is per-locale content files with parity guarded by test, the same model
  as the message files.

## Architecture

### 1. Content layer

```
apps/dashboard/content/docs/
├── en/   <slug>.mdx   (source locale, written first)
├── sv/   <slug>.mdx   (identical slug set, translated content)
├── nb/   <slug>.mdx
├── da/   <slug>.mdx
└── fi/   <slug>.mdx
```

- Slugs are identical across locales (like message keys); the locale never appears in
  the URL. A parity test fails if any locale's file set differs from `en/`.
- Frontmatter (exactly midday's schema): `title`, `description`, `section`, `order`.
  Parsed with a thin `js-yaml`-based splitter (`lib/docs/parse-mdx.ts`: a fence split
  plus `js-yaml` v4 `load`; corrected during execution because the repo's security
  overrides pin js-yaml to 4.x, which breaks `gray-matter` at runtime), validated
  against a Zod schema in tests. Titles and descriptions are locale-specific (each
  locale's file carries its own).
- Body is plain GitHub-flavored Markdown: headings from `##` down (the page `<h1>` comes
  from frontmatter `title`), lists, tables, blockquotes, inline code. No custom MDX
  components, no images, no syntax highlighter in v1 (these docs are UI guides, not API
  docs; the renderer supports adding all three later).
- Internal links are root-relative paths: `/docs/<slug>` (optionally `#anchor`) for doc
  pages, or a real app route (`/roles`, `/model/weighting`) for "where to act" links.
  A link guard test validates both kinds.

### 2. Loader and navigation

- `apps/dashboard/lib/docs/docs-nav.ts` owns STRUCTURE only: an ordered array of
  `{ section: string, pages: string[] }` plus a small curated `POPULAR_DOCS` list for
  the index page. No titles in this file.
- Section display labels come from `dashboard.docs.sections.<sectionSlug>` in every
  locale's message file. Page titles come from the locale's frontmatter. Nothing is
  stored twice.
- `apps/dashboard/lib/docs/docs.ts` (server-only): `getDoc(locale, slug)`,
  `getAllDocs(locale)`, `getAdjacentDocs(locale, slug)` reading the content directory,
  with React `cache()` around the file reads.
- `next.config.ts` gets `outputFileTracingIncludes` for `content/docs/**` so the MDX
  files ship with the serverless build (locale comes from the user's setting, so pages
  render dynamically; the files must be present at runtime).

### 3. Routes and UI

- `app/(app)/docs/page.tsx`: the index. Hero with the localized intro, the reused
  `AssistantPrompt` box (same component as the home page), the popular-guides list, and
  a section grid built from `DOCS_NAV` + frontmatter.
- `app/(app)/docs/[slug]/page.tsx`: the article. Left sidebar with the section
  accordion (current section expanded), the rendered MDX, prev/next pagination.
  Headings get slugified `id`s and hover anchor links.
- Rendering with `next-mdx-remote/rsc` + `remark-gfm`; the component map
  (`components/docs/mdx.tsx`) styles standard elements with our tokens and routes
  internal links through `next/link`.
- The app sidebar gains a "Documentation" entry (key under `dashboard.nav`), placed with
  the help-oriented items. Both routes live inside the `(app)` shell, so locale and the
  sidebar come for free. The shell's `AuthGate` is client-side (it only selects which
  subtree the browser renders after hydration); neither route nor `lib/docs/docs.ts` runs
  a server-side session check before reading and returning the MDX, so the documentation
  content itself is not access-controlled on the server. Acceptable because the corpus is
  identical for every organization and carries no tenant or personal data (ADR-0019).
- Docs pages are static content (no Convex query), so no skeleton is required; the
  standard rule about content-shaped skeletons does not apply here.

### 4. Corpus (the English source, 56 pages)

Sections in reading order. Every page explains preconditions in words and names the
page where the user acts, mirroring the in-app guidance philosophy.

| Section (slug) | Pages |
|---|---|
| `getting-started` | introduction, onboarding-guide, key-concepts, navigating-the-app |
| `model` | model-overview, criteria-and-scale, weighting-and-point-budget, ai-weighting-review, method-documentation, method-appendix-pdf |
| `roles` | roles-register, role-families, job-profiles, ai-drafting, importing-roles, anchor-roles, archiving-roles |
| `evaluation` | evaluating-a-role, score-and-levels, adjusting-a-rating, levels-views |
| `people` | people-register, adding-people, importing-people, supported-payroll-exports, classifying-people, person-details-and-salary, erasing-a-person |
| `pay-mapping` | what-is-pay-mapping, starting-a-pay-mapping, pay-mapping-overview, collaboration, rules-and-practice, equal-work, equivalent-work, actions-and-notes, run-lifecycle |
| `assistant` | using-the-assistant, assistant-capabilities, assistant-privacy |
| `organization` | organization-settings, members-and-roles, invitations |
| `account` | profile-and-language, two-factor-authentication, changing-your-email, deleting-your-account |
| `security-privacy` | data-residency, audit-log, how-ai-is-used, gdpr-and-erasure |
| `glossary` | glossary (one page, one `##` heading per term) |
| `troubleshooting` | troubleshooting-sign-in-and-account, troubleshooting-model-and-evaluation, troubleshooting-people-and-import, troubleshooting-pay-mapping |

Content rules:

- **Glossary:** every canonical term from the three glossaries plus the pay-mapping and
  people domain terms gets its own `##` entry: definition first, then the explicit
  boundary against its neighbouring term (level vs seniority, weight points vs the 0-5
  scale, role vs person, anchor vs anchor role, equal vs equivalent work). Term entries
  carry the Swedish/English pairing where the UI locale and the statutory Swedish term
  differ.
- **Troubleshooting:** every user-facing error code in the `errors` i18n namespace is
  explained on one of the four troubleshooting pages: what the message means, why it
  appears, what to do. The error code appears as inline code so the coverage test can
  find it.
- **Not documented:** the platform admin surfaces (`/admin/*`, internal), and the
  pay-mapping report tab (a "coming soon" placeholder in the app; docs never describe
  unbuilt features).
- Terminology follows the glossaries' canonical terms; UI labels quoted in prose use
  the exact wording of the corresponding i18n message in that locale; international job
  titles stay in English in all locales.

### 5. Localization pipeline

English is written first, from the knowledge dossier (below). Then sv/nb/da/fi are
AI-drafted per locale with hard rules: canonical glossary terms, exact i18n message
wording for quoted UI labels, statutory Swedish terms (lönekartläggning, samverkan)
kept alongside their local rendering where relevant. Machine-drafted locales are drafts:
native review is tracked as an entry in `docs/go-live-checklist.md`, not in frontmatter.

### 6. Convex sync and the assistant tool

New bounded context `docs` in `packages/backend/convex/docs/` (registered in
`CONTEXT-MAP.md`):

- **Table `docsChunks`:** `{ locale, slug, section, pageTitle, heading, anchor, text,
  order, pageHash }` with a search index (`searchField: text`, `filterFields: [locale]`)
  and an index `by_locale_slug`. Content only, no PII, org-independent; no erasure hook
  needed. The table is a derived cache of the MDX files, rebuildable at any time.
- **Chunking:** one chunk for the page intro (before the first `##`), then one per `##`
  section with `###` content folded into its parent. `anchor` is the slugified heading
  (same slugifier as the renderer, shared so deep links `/docs/<slug>#<anchor>` always
  match). Chunks longer than ~2000 characters split at a paragraph boundary. The chunker
  is a pure, unit-tested function shared by the sync script.
- **Sync:** `apps/dashboard/scripts/sync-docs.ts` (bun) parses all locales, computes a
  per-page hash, and calls an internal mutation `docs.sync.replacePage` via
  `npx convex run`, one page per call (bounded writes per the large-org convention),
  skipping pages whose hash is unchanged, then a final sweep mutation removes chunks for
  slugs that no longer exist. Exposed as `bun run docs:sync`; wired into the deploy flow
  and noted in the go-live checklist.
- **Tool `search_docs`:** the assistant's fifth read-only tool.
  `buildAssistantTools(ctx, { orgId, locale })` gains the caller's locale (already
  available in `generateAssistantReply`). Input `{ query: string }`; executes an internal
  query `docs.search.searchDocs` in the user's locale, falling back to `en` on zero
  hits; returns the top 5 chunks as `{ pageTitle, heading, path, text }`.
- **Prompt changes (`knowledge.ts`):** `/docs` joins the Pages list; a new tool rule
  says product how-to and concept questions are answered by calling `search_docs` and
  answering from the results with a markdown link to the page path, and that a question
  the docs do not cover is answered from the Core concepts only, saying the docs do not
  cover it yet. The Core concepts block stays as the identity and boundary layer; the
  depth now lives in the docs.

### 7. Tests and drift guards

All Vitest 4, shipped in the same commit as what they guard:

1. **Locale parity:** every locale folder has exactly `en/`'s slug set.
2. **Frontmatter schema:** every file parses and validates (Zod); `section` must be a
   `DOCS_NAV` section slug.
3. **Nav drift:** every `DOCS_NAV` page slug has a file in every locale; every file
   appears in `DOCS_NAV`; every section slug has a `dashboard.docs.sections.*` label in
   every locale.
4. **Link guard:** every internal link in every MDX file resolves to an existing doc
   slug (and, when it carries an anchor, to a real heading in that locale's file) or to
   a real app route (checked against the `app/(app)` route directories).
5. **Prompt route guard:** the paths in `assistantSystemPrompt`'s Pages list are checked
   against the same route inventory (closes the drift risk found on 2026-08-13).
6. **Term coverage:** a canonical term list (built from the `model` and `assessment`
   message namespaces plus an explicit pay-mapping/people term constant) is crossed
   against the en glossary's `##` headings; a term without a glossary entry fails.
7. **Error coverage:** every key in the `errors` namespace appears as inline code on a
   troubleshooting page.
8. **Chunker unit tests:** intro/section splitting, anchor stability against the
   renderer's slugifier, long-section splitting.
9. **Backend tests (convex-test):** `replacePage` idempotence and hash skip, sweep
   deletion, `searchDocs` locale filter and en fallback, and the tool wiring.
10. **`knowledge.test.ts`:** extended for the new tool rule and the `/docs` page entry.

### 8. Knowledge dossier (the phase before any writing)

A workflow fan-out reads ALL internal documentation: the 18 ADRs, every spec (~55) and
plan (~70) under `docs/superpowers/`, the three glossaries and their companion
explainers, `PLAN-V1.md`, `CONTEXT-MAP.md`, the lönekartläggning research and teardown
documents, the audit reports, and `docs/ui-animation.md`. The output is a consolidated
per-area dossier under `docs/superpowers/analysis/2026-08-13-product-dossier/`
(one file per docs section): observed behavior, terminology with its history (ADR-0014
renames), the rationale behind design choices, edge cases, error states, and what is
deliberately absent. Docs-writing agents work from the dossier plus the code, never from
memory. The dossier is kept for future doc updates.

## Build order

1. **Dossier:** internal-docs read-through, consolidated per-area dossier.
2. **Skeleton:** loader, nav, MDX renderer, `/docs` + `/docs/[slug]`, sidebar entry,
   i18n chrome keys in all locales, 3 seed pages in all locales, tests 1-4 running.
3. **English corpus:** all 56 pages, written per section from the dossier, then a
   consolidation and review pass (terminology, cross-links, tone); tests 5-7 land here.
4. **Translations:** sv, nb, da, fi (workflow per locale), parity green, go-live
   checklist entry for native review.
5. **Backend:** `docs` context, chunker, sync script, `search_docs`, prompt update,
   ADR-0019, tests 8-10, dev-deployment sync + browser verification.
6. **Wrap-up:** `CONTEXT-MAP.md` entry, go-live checklist entries (native review, deploy
   sync wiring), full file-by-file change summary for review.

Everything stays uncommitted for review, per the repo rule.

## Out of scope (deliberate)

- A public docs site (the in-app content can be exposed later; the placement decision
  keeps this open).
- Screenshots and images (renderer supports them; content does not use them yet).
- Embeddings/semantic search (step 2 if full-text recall proves insufficient).
- Per-surface deep links from `HelpMorphButton` into docs pages (natural follow-up,
  listed for later).
- Docs versioning (pre-launch, no legacy rule applies).
- Documenting `/admin/*` or the pay-mapping report placeholder.
