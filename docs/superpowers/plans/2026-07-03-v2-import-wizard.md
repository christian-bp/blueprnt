# V2 Salary Import — Plan 4: the People page + import wizard UI

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Frontend tasks (React/next-intl/shadcn) — use a standard model implementer (not convex-expert). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The dashboard UI for salary import: a **People page** that lists imported employees and launches a **full-screen import wizard** (upload → auto-map columns → readiness check → review → import). The wizard runs `@workspace/import` client-side for the live preview and calls the `importPayroll` action (Plan 3) to persist.

**Architecture:** A People surface under `apps/dashboard/components/people/` + a route. The wizard reuses the onboarding visual frame (`AuthShell` + `OnboardingDots` + `ScreenShell` + `NextButton`) but is **client-state-driven** (not the onboarding server-resume model): a single `ImportWizard` client component holds the in-memory flow state (`file`, `headers`, `rows`, `mapping`, `validation`) and renders the current step. `@workspace/import` is a browser-safe pure package (papaparse works in the browser); add it as a dashboard dependency. All copy is i18n (`dashboard.people.*`) in all 5 locales.

**Tech Stack:** Next.js (App Router), next-intl, shadcn (Table/Empty/Select/Button/Sheet), Convex `useQuery`/`useAction`, Motion, Vitest 4 + Testing Library.

## Global Constraints
- All user-facing text via i18n (`@workspace/i18n`), `dashboard.people.*`, English source + all 5 locales (Nordic = drafts, flag for native review). No hardcoded strings.
- Internal navigation via the `Link` component. Route-exposed entities use slugs (people are not route-exposed here; the list + wizard are enough).
- A data-backed surface ships a content-shaped skeleton (mirror `email-log-section.tsx` / `TableSkeleton`). CRUD/import success shows a toast (`dashboard.toast.*`). Minimize layout shift.
- The wizard's column detection is deterministic + local (`@workspace/import`); the CSV (PII + salary) is parsed in the browser for preview and sent to `importPayroll` (EU Convex); never to any external service or AI.
- Forms use react-hook-form + zod + shadcn Form where there is data entry (the mapping step is a controlled table, not a classic form; use controlled state).
- New code ships with tests; Vitest 4 (`bun run test`), never `bun test`. English identifiers/comments; no em dashes.
- Follow the surface-ownership rule: wizard + page live under `components/people/`.

## Patterns to mirror
- `apps/dashboard/components/admin/email-log-section.tsx` — a list page with `PageHeading`, `Table` + `TableSkeleton`, `Empty`, a toolbar, and a `useQuery`. The People list mirrors this.
- `apps/dashboard/components/onboarding/{onboarding-wizard,screen-shell,onboarding-dots,next-button,wizard-footer}.tsx` — the full-screen wizard frame (`AuthShell` footer = dots; `ScreenShell` heading + content).
- `@workspace/import` public API (`tokenizeCsv`, `detectColumns`, `validateImport`, parsers, `CANONICAL_FIELDS`, types) — read `packages/import/src/index.ts`.
- `api.people.people.listPeople` (Plan 2) and `api.people.import.importPayroll` (Plan 3, an action — call via `useAction`).

---

### Task 1: i18n + the People list page
**Files:** Create `apps/dashboard/components/people/people-section.tsx`, `.../people-section.test.tsx`, the route `apps/dashboard/app/(app)/people/page.tsx`; add `@workspace/import` to `apps/dashboard/package.json`; add `dashboard.people.*` to all 5 locale files; add a `dashboard.nav.people` entry + wire the nav (`nav-main.tsx` items).
- `PeopleSection`: `useQuery(api.people.people.listPeople, { orgId })`; render a `Table` (columns: Name, Gender, Department, FTE) with `TableSkeleton` while loading and an `Empty` state ("No employees imported yet" + an Import button) when empty. A `PageHeading` + a primary "Import salaries" `Button` that navigates to the wizard route. Show `displayName` for now (the `pseudonymizeNames` org toggle is a deferred follow-up; note it in the empty/heading area comment).
- i18n keys: `dashboard.people.{heading,description,empty,import,columns.{name,gender,department,fte}}` (+ nav.people), all 5 locales.
- [ ] TDD (render with a mocked `useQuery`: empty state shows the import CTA; a people list renders rows). Commit (`feat(people): people list page + nav`).

### Task 2: import wizard frame + Upload step
**Files:** Create `apps/dashboard/components/people/import/import-wizard.tsx`, `.../upload-step.tsx`, tests; route `apps/dashboard/app/(app)/people/import/page.tsx` (renders `ImportWizard`).
- `ImportWizard` (client): holds flow state `{ step, file, headers, rows, mapping, validation, result }`. Renders inside `AuthShell` with `OnboardingDots` (steps: Upload, Map, Check, Review) as the footer + `ScreenShell` per step. A back/next via `NextButton`/dots. Reuse the crossfade (`AnimatePresence`).
- `UploadStep`: a drop/select control for a `.csv`; on select, read the text (`file.text()`), `tokenizeCsv(text)` (from `@workspace/import`), store `{ headers, rows }`, advance. Show the detected row/column counts. Handle a non-CSV / empty file with an inline error.
- i18n: `dashboard.people.import.{title, upload.*, next, back, step labels}`.
- [ ] TDD (a fixture CSV string → tokenize → headers/rows populated → advance enabled). Commit (`feat(people): import wizard frame + upload step`).

### Task 3: Map-columns step (the core)
**Files:** Create `.../map-step.tsx`, tests.
- On entry, `detectColumns({ headers, rows })` to seed the mapping (canonical field → columnIndex). Render an editable table: one row per `CANONICAL_FIELDS` entry showing the field label (i18n) + tier badge (required/recommended/optional) + a `Select` of source columns (options = the headers, plus "— not mapped —") pre-set to the detected column + a sample value from the first data row + a confidence hint. Required fields that are unmapped are visually flagged. Editing a Select updates `mapping`.
- "Next" is enabled always (the readiness step reports blockers); but surface an inline count of unmapped required fields.
- i18n: `dashboard.people.import.map.{title, field, source, sample, confidence, notMapped, required, recommended, optional, unmappedRequired}` + a label per `CanonicalFieldKey` under `dashboard.people.import.fields.*`.
- [ ] TDD (seed with the test headers → required fields auto-mapped; changing a Select updates the mapping; an unmapped required field is flagged). Commit (`feat(people): import wizard column-mapping step`).

### Task 4: Check-readiness step
**Files:** Create `.../check-step.tsx`, tests.
- `validateImport({ headers, rows }, mappingAsDetected, {})` → render: a readiness checklist (each canonical field: mapped ✓ / required-missing (blocking) / recommended-missing (warning)), and a data-quality list grouped by `RowIssue.code` with counts (duplicate id, unparsable money, non-numeric code, blank gender) + the affected row numbers. If `blocking.length > 0`, disable "Next" (cannot proceed) and explain what to map; else allow proceeding. Warnings are shown but do not block.
- i18n: `dashboard.people.import.check.{title, ready, blocking, warnings, issues, issue.<code>, rowsAffected, cannotProceed}`.
- [ ] TDD (a mapping missing basicMonthly → blocking shown, Next disabled; a mapping missing FTE → warning shown, Next enabled; injected duplicate id → issue listed). Commit (`feat(people): import wizard readiness + data-quality step`).

### Task 5: Review + confirm step (calls importPayroll)
**Files:** Create `.../review-step.tsx`, tests.
- Show a normalized preview (first N rows: parsed money, trimmed currency, FTE, gender) + a summary (N people, N flagged/skipped). A confirm `Button` (disabled while submitting; `SubmitButton`/`Spinner`) calls `useAction(api.people.import.importPayroll)` with `{ orgId, csvText, mapping: <array-of-pairs [sourceHeader, canonicalKey] per the action's arg shape>, payYear?, effectiveAt? }`. On `ok:true` → `toast.success(dashboard.toast.<peopleImported>)` (add the toast key), navigate back to the People page (now populated). On `ok:false` (blocking) → surface the validation (shouldn't happen if Check gated correctly, but handle it). On throw → `toast.error`.
- Note the action's `mapping` arg is the array-of-pairs `[sourceHeader, canonicalKey]` shape (Plan 3 used that to sidestep Convex's non-ASCII record-key limit) — build it from the wizard's mapping + headers.
- i18n: `dashboard.people.import.review.{title, preview, summary, confirm, importing}` + `dashboard.toast.peopleImported`.
- [ ] TDD (mock `useAction` to resolve `{ok:true, counts}`; confirm calls it with the right args + fires the success toast). Commit (`feat(people): import wizard review + confirm (calls importPayroll)`).

## Self-review
- Covers spec §5.1-5.5 (the full wizard) + a People list surface to view results. The `mapping` arg to `importPayroll` matches Plan 3's array-of-pairs shape.
- Deterministic client-side detection via `@workspace/import`; PII/salary only to the EU action, never external/AI.
- Deferred (flag): the `pseudonymizeNames` org display toggle (needs an org-settings field + a toggle); per-person detail (salary history / assignment) — natural for Plan 5.

## Follow-on
- **Plan 5:** classification — an internal `appendAssignment` (Plan 2 note) + a title→role mapping + HR-confirmed level suggestion UI reachable from the People page, assigning each imported person to a role/level; and per-person detail. Then the `pseudonymizeNames` toggle.
