# Phase 6: Wrap-Up

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task.

**Goal:** Register the new context, close the tracking loops, and hand the whole work over for review.

### Task 6.1: Context map and checklist entries

**Files:**
- Modify: `CONTEXT-MAP.md`
- Modify: `docs/go-live-checklist.md`

- [ ] **Step 1: CONTEXT-MAP entry**

Add `docs` beside the other cross-cutting modules (the map already lists `platform`, `ai`, `email`, `assistant` without dedicated glossaries): one paragraph in the established style stating that `docs` holds the derived documentation search cache (`docsChunks`), that its source of truth is `apps/dashboard/content/docs/`, and that it carries no personal data (ADR-0019).

- [ ] **Step 2: Go-live checklist entries**

Beyond Phase 4's native-review entry, add: "Deploy wiring for docs sync: `bun run docs:sync` must run after `convex deploy` in the production deploy flow (today it is a manual step against the dev deployment); wire it into CI before go-live."

- [ ] **Step 3: Verify ADR status line**

ADR-0019 stays `Status: Föreslagen` until Christian approves the review; flipping it to `Accepterad` happens in the approval commit, matching how earlier ADRs landed.

### Task 6.2: Final verification and review handoff

- [ ] **Step 1: Full test run**

Run at the repo root: `bun run test`
Expected: every package green, including the ten guards, i18n parity, and the backend suites.

- [ ] **Step 2: Full static gate**

Run: `bun run lint` and `bun run typecheck` at the root (or per touched package).
Expected: Biome at zero errors/warnings/info; tsc clean.

- [ ] **Step 3: Browser sweep**

On the dev deployment: `/docs` index in all five languages, three spot articles (glossary, importing-people, equal-work) per language, the assistant flow from Phase 5 Task 5.6, and the sidebar entry.

- [ ] **Step 4: File-by-file change summary**

Produce the mandatory review summary, grouped by area (content en/sv/nb/da/fi, docs UI, guards, backend docs context, assistant, governance docs), listing EVERY file created or modified with a one-line note. Present it together with: the known review items (native review pending per go-live checklist; ADR-0019 pending acceptance), and the commit plan (suggested focused commits: `feat(docs): add the in-app documentation surface`, `feat(docs): add the English corpus`, `feat(i18n): add the sv/nb/da/fi docs corpora`, `feat(assistant): ground the assistant in the documentation`, `docs: add ADR-0019 and tracking entries`).

- [ ] **Step 5: STOP**

No commits, no push. Christian reviews the working tree; commits happen only after explicit approval.
