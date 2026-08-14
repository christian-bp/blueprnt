# Phase 1: Knowledge Dossier

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task.

**Goal:** Read ALL internal documentation and produce one dossier file per docs section under `docs/superpowers/analysis/2026-08-13-product-dossier/`, so every docs page in Phase 3 is written from full understanding of behavior, terminology, rationale, and history.

**Why a dossier instead of writing docs straight from the sources:** ~145 internal documents cannot fit one writer's context. The dossier distills them once, per docs section, into exactly what a page writer needs, and it is reusable for future doc updates.

### Task 1.1: Source inventory

**Files:**
- Create: `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md`

**Interfaces:**
- Produces: `SOURCES.md`, a checklist of every internal document with its assigned docs section(s). Task 1.2's agents receive their slice of this list.

- [ ] **Step 1: Enumerate all sources**

Run and capture:

```bash
ls docs/adr/*.md
ls docs/superpowers/specs/*.md
ls docs/superpowers/plans/*.md
ls docs/contexts/*/CONTEXT.md docs/contexts/evaluation-model/*.md
ls docs/*.md docs/reviews/*.md docs/agents/*.md docs/superpowers/analysis/*.md
```

- [ ] **Step 2: Write SOURCES.md**

One table row per document: path, one-line topic (from its title/first heading), and which docs section(s) it feeds (`getting-started`, `model`, `roles`, `evaluation`, `people`, `pay-mapping`, `assistant`, `organization`, `account`, `security-privacy`, `glossary`, `troubleshooting`, or `background` for documents that inform tone/scope only, e.g. `ui-animation.md`). Every ADR (0001-0018), every spec, every plan, all three glossaries and their companion explainers, `PLAN-V1.md`, `CONTEXT-MAP.md`, `lonekartlaggning-process-och-kravbild.md`, `pay-mapping-analysis-teardown-and-plan.md`, `go-live-checklist.md`, and the review reports must appear. A document may feed several sections.

- [ ] **Step 3: Verify completeness**

Run: `ls docs/adr/*.md docs/superpowers/specs/*.md docs/superpowers/plans/*.md | wc -l` and confirm SOURCES.md has at least that many rows (plans subdirectories count as one row per directory).

### Task 1.2: Section dossiers (workflow fan-out)

**Files:**
- Create: `docs/superpowers/analysis/2026-08-13-product-dossier/<section>.md` for each of the 12 sections listed in Task 1.1 Step 2 (12 files).

**Interfaces:**
- Consumes: `SOURCES.md` from Task 1.1.
- Produces: 12 dossier files, each with the six mandatory headings below. Phase 3's writing tasks consume these files verbatim.

Every dossier file MUST use exactly these `##` headings:

1. `## Behavior today` : what the surface does, flow by flow, with the code path for each claim (route file + main components).
2. `## Terms and history` : the section's canonical terms (Swedish/English), their boundaries against neighbouring terms, and renames (ADR-0014: Band became Level, old Nivå became Seniority, anchor-scale positions became Steps; older documents use the old words).
3. `## Rationale` : why it works this way, each point citing its ADR or spec by path.
4. `## Edge cases and error states` : preconditions, gates, locked states, suppression rules, empty states, and every `errors` i18n key this section's surfaces can raise.
5. `## Deliberately absent` : what was cut or deferred (with source), so docs never describe it (e.g. the pay-mapping report tab, per-criterion weighting texts, seniority in V1).
6. `## Sources read` : every document and code path the agent actually read.

- [ ] **Step 1: Run the fan-out**

Use the Workflow tool (per-section agents, Sonnet, background). One agent per section, each prompted with: its section slug, its SOURCES.md slice, the six mandatory headings, the instruction to read the listed documents AND the current code for its surfaces (routes under `apps/dashboard/app/(app)/`, components, relevant `packages/backend/convex/` context), and the instruction to record page-worthy facts (numbers like the 0-5 scale, the point budget formula `criteria count x 3`, `MIN_CRITERIA`, group-suppression floors) with their source. Agents write their file directly.

- [ ] **Step 2: Completeness critic**

One high-effort agent reads all 12 dossiers plus SOURCES.md and reports: sources assigned but never cited, sections whose `errors` keys are missing (cross-check the 31 keys in `packages/i18n/messages/en.json` `errors`; every key must appear in at least one dossier's heading 4), contradictions between dossiers, and claims without a code path. Fix findings by re-dispatching the affected section agent with the critic's notes.

- [ ] **Step 3: Verify structure**

Run: `rg -c '^## (Behavior today|Terms and history|Rationale|Edge cases and error states|Deliberately absent|Sources read)$' docs/superpowers/analysis/2026-08-13-product-dossier/*.md`
Expected: every section file reports 6.

- [ ] **Step 4: Leave staged-ready, continue** (no commit; repo rule)
