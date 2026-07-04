# V2 Classification, Plan 3: the Classify surface + People-list enrichment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the `/people/classify` HR review surface (title→role table with inline per-person level review, plus inline create-role / map-to-existing for unmatched titles), enrich the People list with a per-person classification badge and an "N of M classified" summary, and add the `pseudonymizeNames` org display toggle that reshapes the name render path on both surfaces. All wiring goes to Plan 2's backend (`listPeopleByTitle`, `runClassificationSuggestions`) and the existing `assignPersonToRole` / `createRole` mutations. No AI in the path: the engine's suggestion (surfaced with its confidence tier) is a proposal HR confirms explicitly.

**Architecture:** New route `apps/dashboard/app/(app)/people/classify/page.tsx` (a thin `"use client"` page that owns queries + `usePageTitle`, like `roles/page.tsx`) rendering a new `components/people/classify/` component tree. The People-list enrichment edits the existing `components/people/people-section.tsx`. The pseudonymize toggle adds a field to the org settings backend + a new toggle section on the org general page, and a shared pure formatter `lib/person-display.ts` that both surfaces call. All UI copy via `next-intl` under new `dashboard.classify.*`, `dashboard.people.*`, `dashboard.organization.general.*`, `dashboard.toast.*`, `dashboard.help.*` keys in all 5 locales. shadcn `Table`/`Select`/`Badge`/`Dialog`/`Collapsible` at their default variants; no per-call-site sizing. Layout shift minimized: expansion extends below, skeletons mirror content, controls live in pre-reserved slots.

**Tech Stack:** Next.js 16 App Router (`"use client"` pages), React 19, Convex `useQuery`/`useMutation` (`convex/react`), react-hook-form + Zod + shadcn `Form`, next-intl, sonner toasts, Motion (`AnimatePresence`/`layout`), Vitest 4 + `@testing-library/react` (component tests mock `convex/react` + the generated api via `@/test/convex-mocks`).

## Global Constraints

- **Org-scoped:** every Convex call carries the caller's `orgId` from `useOrganization()`; the frontend never reads across orgs and passes the active `orgId` to every query/mutation, exactly as `roles/page.tsx:28` and `people-section.tsx:36` do today.
- **Role ≠ Person:** the Classify UI shows role-level data (title, track, function/team) and per-person assignment (level), never writing person/salary/performance fields onto a role; `createRole` from an unmatched row takes only `{title, function, team, trackKey, familyId?}`.
- **No AI in the classification path (ADR-0003):** the surface renders the deterministic engine's suggestion with its `confidence` tier; HR can override the role and the level, and every write happens only on an explicit HR confirm. Nothing here calls a model.
- **Level is per-individual, validated against the track (ADR-0005):** the per-person level Select options come only from the assigned role's track ladder (`TRACK_LEVELS[trackKey]` via `@workspace/constants`); `assignPersonToRole` re-validates with `isValidLevelForTrack` server-side (`people/assignments.ts:84`).
- **Derived never stored (ADR-0002):** the classification badge and the "N of M classified" summary are computed live from `listPeopleByTitle`'s assignment state at render; no classification count or badge value is persisted.
- **Every state-changing mutation writes an audit row:** confirming calls `assignPersonToRole` (already audits `assignment.set`, `people/assignments.ts:133`) and `createRole` (already audits `role.created`, `roles.ts:155`); the pseudonymize toggle reuses `updateOrganizationSettings` (already audits `organization.settingsUpdated`, `organization.ts:82`). This plan adds no new audit event.
- **EU:** no external calls; all data flows through Convex (eu-west-1).
- **All user-facing text via i18n in all 5 locales:** every new string is added to `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json` in the same commit; Nordic strings are drafts flagged for native review. The `packages/i18n` parity test guards the key sets.
- **New code ships with tests in the same commit:** component tests via Vitest 4 (`bun run test`, never `bun test`); pure formatter unit-tested.
- **English identifiers and comments; no em dashes** in copy, comments, or commit messages.
- **Conventional commits** (`feat:` / `refactor:`), no AI attribution.
- **shadcn defaults, minimize layout shift, CRUD toasts, dialogs follow shadcn anatomy, row actions via dropdown** per `CLAUDE.md`; internal navigation via `next/link` `Link`.

## Interfaces consumed from earlier plans

These are the exact signatures Plan 3 depends on. They are produced by Plans 1 and 2; if a real signature differs at implementation time, treat the earlier plan's `Produces` as authoritative and adjust the call sites.

**From Plan 1 (`packages/core/src/classification/`, pure), re-exported from `@workspace/core`:**
```ts
type MatchConfidence = "high" | "medium" | "unmatched"
```
(Plan 3 only reads the `confidence` string returned by Plan 2's query; it does not import the engines directly. The `MatchConfidence` union is the display contract for the confidence badge.)

**From Plan 2 (`packages/backend/convex/people/`):**
```ts
// orgQuery: one row per distinct title across the org's active people (the
// no-title bucket is included as a group with title: null, sorted LAST), each
// with per-person current-assignment state AND the deterministic engine
// suggestion (matched role + confidence for the group, suggested level per
// person). Titles are grouped in JS after a by_org collect; the query runs the
// same engine path the persistence mutation uses, so what HR sees equals what
// gets written.
listPeopleByTitle: OrgQuery<
  { orgId: string },
  Array<{
    title: string | null                     // null = the "no title" group (sorted last)
    personCount: number
    suggestedRoleId: Id<"roles"> | null       // null for the no-title group and for titles that matched no role
    confidence: "high" | "medium" | "unmatched"
    people: Array<{
      personId: Id<"people">
      displayName: string
      externalRef: string | null
      employmentStartDate: string | null
      isManager: boolean | null
      suggestedLevel: string | null          // engine suggestion for this person, or null when the title is unmatched / no-title
      currentAssignment: {
        roleId: Id<"roles">
        level: string
        levelSource: "suggested" | "confirmed"
      } | null
    }>
  }>
>

// orgMutation: computes + persists levelSource:"suggested" assignments for
// every person whose title matched a role and who has no confirmed/identical
// assignment yet. Idempotent. Returns an object summary; Plan 3 fires it on
// mount and DISCARDS the return value (no UI reads it).
runClassificationSuggestions: OrgMutation<
  { orgId: string },
  { suggested: number; skipped: number; unmatchedTitles: number }
>
```

**From existing code (grounded, unchanged by earlier plans):**
```ts
// people/assignments.ts:69
assignPersonToRole: OrgMutation<
  { personId: Id<"people">; roleId: Id<"roles">; level: string;
    levelSource: "suggested" | "confirmed"; effectiveAt?: number },
  Id<"personAssignments">
>
// assessment/roles.ts:96
createRole: OrgMutation<
  { title: string; function: string; team: string;
    trackKey: "IC" | "Lead" | "M"; familyId?: Id<"roleFamilies">;
    purpose?: string; responsibilities?: string },
  { roleId: Id<"roles">; slug: string }
>
// assessment/roles.ts:177 (rows carry roleId,title,slug,trackKey,trackName,function,team,familyId,...)
listRoles: OrgQuery<{ locale?: string }, RoleRow[]>
// evaluationModel.model.getModel (.tracks is TrackOption[] { key:"IC"|"Lead"|"M"; name; order })
getModel: OrgQuery<{ locale?: string }, { tracks: {key:"IC"|"Lead"|"M"; name:string; order:number}[]; ... } | null>
// @workspace/constants
TRACK_LEVELS: Record<"IC"|"Lead"|"M", readonly string[]>
isValidLevelForTrack(trackKey: string, level: string): boolean
```

## Interfaces produced by this plan

```ts
// apps/dashboard/lib/person-display.ts (pure)
export function displayNameFor(
  person: { displayName: string; externalRef: string | null },
  pseudonymize: boolean,
  pseudonymTemplate: (ref: string) => string
): string
// When pseudonymize && externalRef != null -> pseudonymTemplate(externalRef);
// otherwise person.displayName (also the fallback when externalRef is null).

// apps/dashboard/components/people/classify/classify-title-table.tsx
export function classificationStateForPeople(
  people: { currentAssignment: { levelSource: "suggested" | "confirmed" } | null }[]
): "confirmed" | "pending" | "unclassified"
// "confirmed" iff people.length > 0 && every person has a confirmed assignment;
// "unclassified" iff no person has any assignment; otherwise "pending".

// apps/dashboard/lib/classification-summary.ts (pure)
export function countClassified(
  people: { currentAssignment: { levelSource: "suggested" | "confirmed" } | null }[]
): { classified: number; total: number }
// classified = count of people with a confirmed open assignment; total = people.length.
```

Backend surface produced (Task 6): `pseudonymizeNames` on the org settings shape.
```ts
// accounts/organization.ts getOrganizationSettings returns adds:
//   pseudonymizeNames: boolean   (defaults false when the field is absent)
// updateOrganizationSettings args adds:
//   pseudonymizeNames: v.optional(v.boolean())
```

---

### Task 1: Pure display + summary helpers

**Files:** Create `apps/dashboard/lib/person-display.ts`, `apps/dashboard/lib/classification-summary.ts`; Test `apps/dashboard/lib/person-display.test.ts`, `apps/dashboard/lib/classification-summary.test.ts`.

**Pattern to mirror:** existing pure helpers under `apps/dashboard/lib/` (e.g. `role-error.ts`); tests colocated `*.test.ts`, plain Vitest (no React), per `packages/*/vitest.config.ts` react/base split (these live in `apps/dashboard` which already runs component + unit tests).

Both helpers are pure so the badge, summary, and name substitution are unit-testable without rendering.

- [ ] Step 1: Write `person-display.test.ts` with the failing cases:
```ts
import { describe, expect, it } from "vitest"
import { displayNameFor } from "@/lib/person-display"

const tmpl = (ref: string) => `Anställd #${ref}`

describe("displayNameFor", () => {
  it("returns the real name when pseudonymize is off", () => {
    expect(displayNameFor({ displayName: "Ada Lovelace", externalRef: "42" }, false, tmpl)).toBe("Ada Lovelace")
  })
  it("returns the pseudonym when pseudonymize is on and a ref exists", () => {
    expect(displayNameFor({ displayName: "Ada Lovelace", externalRef: "42" }, true, tmpl)).toBe("Anställd #42")
  })
  it("falls back to the real name when pseudonymize is on but no ref", () => {
    expect(displayNameFor({ displayName: "Ada Lovelace", externalRef: null }, true, tmpl)).toBe("Ada Lovelace")
  })
})
```
- [ ] Step 2: Write `classification-summary.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { countClassified } from "@/lib/classification-summary"

const conf = { currentAssignment: { levelSource: "confirmed" as const } }
const sug = { currentAssignment: { levelSource: "suggested" as const } }
const none = { currentAssignment: null }

describe("countClassified", () => {
  it("counts only confirmed assignments as classified", () => {
    expect(countClassified([conf, sug, none, conf])).toEqual({ classified: 2, total: 4 })
  })
  it("handles an empty list", () => {
    expect(countClassified([])).toEqual({ classified: 0, total: 0 })
  })
})
```
- [ ] Step 3: Run `bun run test --filter=dashboard` (or `bun run test` at root); confirm both fail (modules missing).
- [ ] Step 4: Implement `person-display.ts`:
```ts
// Pure name-display decision for the pseudonymizeNames org toggle. The stored
// displayName is never mutated; this only chooses what the UI renders. Falls
// back to the real name when there is no externalRef to build a pseudonym from.
export function displayNameFor(
  person: { displayName: string; externalRef: string | null },
  pseudonymize: boolean,
  pseudonymTemplate: (ref: string) => string
): string {
  if (pseudonymize && person.externalRef !== null) {
    return pseudonymTemplate(person.externalRef)
  }
  return person.displayName
}
```
- [ ] Step 5: Implement `classification-summary.ts`:
```ts
// Live count of confirmed-classified people over the total. "Classified" means
// a confirmed open assignment; suggested-but-unconfirmed does not count (badge,
// not gate). Derived at render, never stored (ADR-0002).
export function countClassified(
  people: { currentAssignment: { levelSource: "suggested" | "confirmed" } | null }[]
): { classified: number; total: number } {
  const classified = people.filter(
    (p) => p.currentAssignment?.levelSource === "confirmed"
  ).length
  return { classified, total: people.length }
}
```
- [ ] Step 6: Run the two tests; confirm pass.
- [ ] Step 7: Commit (`feat(classify): add pure name-display and classification-summary helpers`).

---

### Task 2: i18n keys for the Classify surface, badges, toggle, toasts

**Files:** Modify all 5 of `packages/i18n/messages/{en,sv,nb,da,fi}.json`. Test: the existing `packages/i18n` parity test (no edit needed; it auto-guards key parity).

**Pattern to mirror:** `en.json` `dashboard.roles.*` and `dashboard.people.*` blocks; `dashboard.toast.*` (existing keys listed at `dashboard.toast`); `dashboard.help.*` help pairs (`*Label` + `*Body`, e.g. `trackLabel`/`trackBody`). English is the source; the `Messages` type is generated from it.

Add under `dashboard`:
- `classify`: `heading`, `description`, `pageTitle`; `columns` (`title`, `people`, `suggestedRole`, `confidence`, `state`, `actions`); `confidence` (`high`, `medium`, `unmatched`); `state` (`confirmed`, `pending`, `unclassified`); `noTitle` (the label the title→role table shows for the `title: null` group, e.g. "Unclassified / no title"); `selectRolePlaceholder`; `assignCta` ("Confirm classification"); `expandLabel` / `collapseLabel` (aria); `levelLabel`; `tenureLabel`; `tenureYears` (ICU: `"{years, plural, one {# year} other {# years}}"`); `unmatchedHint`; `createRoleCta`; `mapExistingCta`; `empty` (no people at all yet); `summary` (ICU: `"{classified} of {total} classified"`); `runningSuggestions` (skeleton/loading label); `entryCta` ("Classify employees"); `entryHint` (ICU: `"{count, plural, one {# employee needs classification} other {# employees need classification}}"`).
- `classify.createRole`: `title`, `description`, `titleLabel`, `functionLabel`, `teamLabel`, `trackLabel`, `cancel`, `cta`, `error` (reuse the create-role dialog copy shape from `dashboard.roles.create`).
- `people.columns.classification` (new column header "Classification"); `people.badge` (`confirmed`, `pending`, `unclassified`); `people.classifyCta` ("Classify employees").
- `organization.general`: `pseudonymizeLabel`, `pseudonymizeDescription`, `pseudonymTemplate` (ICU: `"Anställd #{ref}"` in en; localized per locale where idiomatic, keep the ref token).
- `toast`: `classificationConfirmed` ("Classification confirmed"), `settingsSaved` (reuse existing `orgSaved` if present; otherwise add). Use existing `orgSaved` for the toggle save.
- `help`: `classifyConfidenceLabel` / `classifyConfidenceBody` (explains High/Suggested/Unmatched), `classifyLevelLabel` / `classifyLevelBody` (explains Level is per-individual within the track, ADR-0005 in plain language).

- [ ] Step 1: Add every key above to `en.json` under the right namespaces (source of truth).
- [ ] Step 2: Mirror all keys to `sv.json`, `nb.json`, `da.json`, `fi.json` with translated values; mark Nordic values as drafts (a `// review` note in the commit body, not in JSON). Do not add non-ASCII via shell `perl`/`sed` (double-encodes); edit the JSON files directly and grep for mojibake afterward.
- [ ] Step 3: Run the `packages/i18n` parity test (`bun run test --filter=@workspace/i18n`); confirm it passes (all 5 locales have identical key sets).
- [ ] Step 4: Run `bun run typecheck` for `apps/dashboard` (the generated `Messages` type now knows the new keys). Confirm pass.
- [ ] Step 5: Commit (`feat(classify): add i18n keys for the classify surface in all locales`).

---

### Task 3: `pseudonymizeNames` org setting (backend)

**Files:** Modify `packages/backend/convex/accounts/tables.ts` (org table), `packages/backend/convex/accounts/organization.ts` (`getOrganizationSettings` + `updateOrganizationSettings`). Test: extend `packages/backend/convex/accounts/audit.test.ts` (or add `organization.pseudonymize.test.ts`) with a convex-test round-trip.

**Pattern to mirror:** the existing optional fields on `organizations` (`tables.ts:40-53`) and the `settingsShape` + upsert-patch pattern in `organization.ts:25-94`. `SETTINGS_AUDIT_FIELDS` in `lib/audit.ts` drives the diff.

- [ ] Step 1: Add a convex-test in `organization.pseudonymize.test.ts` (edge-runtime) that:
```ts
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "./../_generated/api"
import schema from "./../schema"
// ... initConvexTest helper as used across packages/backend tests
```
asserting: (1) `getOrganizationSettings` returns `pseudonymizeNames: false` for a fresh org row (field absent), (2) after `updateOrganizationSettings({ pseudonymizeNames: true })` it returns `true`, (3) the toggle change is in the audit diff. Run it; confirm it fails (field/arg missing).
- [ ] Step 2: Add `pseudonymizeNames: v.optional(v.boolean())` to the `organizations` table in `accounts/tables.ts`.
- [ ] Step 3: Add `pseudonymizeNames: v.boolean()` to `settingsShape` in `organization.ts` and return `settings.pseudonymizeNames ?? false` from `getOrganizationSettings`.
- [ ] Step 4: Add `pseudonymizeNames: v.optional(v.boolean())` to `updateOrganizationSettings` args (the existing upsert-patch already spreads `...args`, so no handler-body change is needed beyond the arg). Add `"pseudonymizeNames"` to `SETTINGS_AUDIT_FIELDS` in `lib/audit.ts` so the toggle change is diffed.
- [ ] Step 5: Run the new test + the existing `accounts/audit.test.ts` + backend typecheck; confirm all pass.
- [ ] Step 6: Commit (`feat(people): add pseudonymizeNames org display setting`).

---

### Task 4: The pseudonymize toggle section (org general page)

**Files:** Create `apps/dashboard/components/organization/pseudonymize-section.tsx`; Modify `apps/dashboard/app/(app)/organization/general/page.tsx`. Test `apps/dashboard/components/organization/pseudonymize-section.test.tsx`.

**Pattern to mirror:** `organization-profile-form.tsx` (Card + `useMutation(updateOrganizationSettings)` + `toast.success(tToast("orgSaved"))`); the settings page composition in `organization/general/page.tsx:24-34` (renders sections once `settings !== undefined`). For a single boolean this is a `Switch` (shadcn `packages/ui/src/components/switch.tsx`) inside a `Card`, saved immediately on toggle (no form gate needed for a one-field non-destructive setting; it is a settings toggle, not a create form).

- [ ] Step 1: Write `pseudonymize-section.test.tsx` mocking convex per `@/test/convex-mocks`:
```ts
vi.mock("convex/react", async () => (await import("@/test/convex-mocks")).convexReactModule)
vi.mock("@workspace/backend/convex/_generated/api", async () => (await import("@/test/convex-mocks")).apiModule)
// mockMutation("accounts.organization.updateOrganizationSettings")
```
Assert: renders the label from `dashboard.organization.general.pseudonymizeLabel`; toggling the `Switch` calls `updateOrganizationSettings` with `{ orgId, pseudonymizeNames: true }` and shows the `orgSaved` toast. Wrap in `NextIntlClientProvider` with `messages` from `en.json` and a stub `useOrganization` (mock `@/components/org-context`). Run it; confirm fail (component missing).
- [ ] Step 2: Implement `pseudonymize-section.tsx`:
```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"

// Org display toggle: when on, the UI substitutes "Anställd #<externalRef>" for
// the stored displayName (pure client-side formatting via lib/person-display;
// the stored name is unchanged). Saved immediately on toggle: a single
// non-destructive boolean has nothing to gate on.
export function PseudonymizeSection({ pseudonymizeNames }: { pseudonymizeNames: boolean }) {
  const t = useTranslations("dashboard.organization.general")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const updateSettings = useMutation(api.accounts.organization.updateOrganizationSettings)

  async function onToggle(next: boolean) {
    await updateSettings({ orgId, pseudonymizeNames: next })
    toast.success(tToast("orgSaved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pseudonymizeLabel")}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="pseudonymize-toggle" className="text-muted-foreground text-sm font-normal">
          {t("pseudonymizeDescription")}
        </Label>
        <Switch id="pseudonymize-toggle" defaultChecked={pseudonymizeNames} onCheckedChange={onToggle} />
      </CardContent>
    </Card>
  )
}
```
- [ ] Step 3: Render it from `organization/general/page.tsx` inside the `settings !== undefined` block, passing `pseudonymizeNames={settings.pseudonymizeNames}`.
- [ ] Step 4: Run the component test + `apps/dashboard` typecheck; confirm pass.
- [ ] Step 5: Commit (`feat(organization): add pseudonymize-names display toggle section`).

---

### Task 5: People-list enrichment (badge column + summary + pseudonymize + Classify entry)

**Files:** Modify `apps/dashboard/components/people/people-section.tsx`. Test `apps/dashboard/components/people/people-section.test.tsx`.

**Pattern to mirror:** current `people-section.tsx` (PageHeader + skeleton + Table). The badge state derives from each person's current assignment, so the section reads `listPeopleByTitle` (which carries assignment state per person). Decision: keep `listPeople` for the row set + demographics it uniquely provides (`gender`, `department`, `ftePercent`) and for the pseudonymize name/`externalRef` on each row; add a `listPeopleByTitle` read to build a `personId -> currentAssignment` map for the badge; also read `getOrganizationSettings` for the pseudonymize flag.

**Single source for the summary (no double-counting):** `listPeopleByTitle` now returns EVERY active person exactly once (each person is in exactly one title group, and the no-title group with `title: null` is included), so the "N of M classified" summary is computed with `countClassified` over the ONCE-flattened `listPeopleByTitle` people, NOT over `listPeople`. Do not derive the summary total from both queries: `listPeople` is used only for the per-row demographics and the badge is looked up by person id; the summary's total and classified counts come solely from the flattened `byTitle` set. This guarantees no person is counted twice and the two queries cannot disagree on the total.

Concretely: build `assignmentByPerson: Map<personId, "confirmed"|"suggested">` from `listPeopleByTitle` for the per-row badge lookup (a person absent from the map is `unclassified`), and flatten `listPeopleByTitle`'s people once for the summary.

- [ ] Step 1: Extend `people-section.test.tsx` (create if absent) mocking convex-mocks and `@/components/org-context`. Assert:
  - a person with a confirmed assignment renders the `dashboard.people.badge.confirmed` badge; a suggested one renders `badge.pending`; one with no assignment renders `badge.unclassified`.
  - the summary line renders `dashboard.classify.summary` with the correct `{classified}`/`{total}` (drive `countClassified` via the fixture).
  - with `getOrganizationSettings -> { pseudonymizeNames: true }`, a person with `externalRef: "42"` renders `Anställd #42` instead of the display name; with the flag off, the real name renders.
  - the "Classify employees" action links to `/people/classify`.
  Use `onQuery((ref) => ref === "people.people.listPeople" ? PEOPLE : ref === "people.classificationQueries.listPeopleByTitle" ? BY_TITLE : ref === "accounts.organization.getOrganizationSettings" ? SETTINGS : [])`. Run it; confirm fail.
- [ ] Step 2: In `people-section.tsx`, add the queries:
```tsx
const people = useQuery(api.people.people.listPeople, { orgId })
const byTitle = useQuery(api.people.classificationQueries.listPeopleByTitle, { orgId })
const settings = useQuery(api.accounts.organization.getOrganizationSettings, { orgId })
```
Guard the skeleton on any being `undefined`.
- [ ] Step 3: Build the badge lookup + the single-source summary. Flatten `byTitle` ONCE; the flattened list is both the badge map source and the summary source (never `listPeople`), so no person is double-counted:
```tsx
// Flatten every title group's people once. listPeopleByTitle returns each
// active person exactly once (including the title: null group), so this is the
// complete, non-duplicated person set for both the badge and the summary.
const byTitlePeople = useMemo(
  () => (byTitle ?? []).flatMap((group) => group.people),
  [byTitle]
)
const assignmentByPerson = useMemo(() => {
  const m = new Map<string, "confirmed" | "suggested">()
  for (const p of byTitlePeople) {
    if (p.currentAssignment !== null)
      m.set(String(p.personId), p.currentAssignment.levelSource)
  }
  return m
}, [byTitlePeople])
// Summary from the SINGLE flattened source: countClassified reads each person's
// currentAssignment directly. A person with no confirmed assignment (suggested
// or none) counts toward total but not classified.
const summary = useMemo(
  () => countClassified(byTitlePeople),
  [byTitlePeople]
)
```
- [ ] Step 4: Add a "Classification" column (`t("columns.classification")`) rendering a `Badge`:
```tsx
const state = assignmentByPerson.get(String(person.personId)) ?? null
const badge =
  state === "confirmed"
    ? { variant: "default" as const, label: t("badge.confirmed") }
    : state === "suggested"
      ? { variant: "secondary" as const, label: t("badge.pending") }
      : { variant: "outline" as const, label: t("badge.unclassified") }
// <Badge variant={badge.variant}>{badge.label}</Badge>
```
Apply `displayNameFor(person, settings?.pseudonymizeNames ?? false, (ref) => tOrg("pseudonymTemplate", { ref }))` to the name cell (`tOrg = useTranslations("dashboard.organization.general")`).
- [ ] Step 5: Add the summary line + a "Classify employees" `Button asChild` `Link href="/people/classify"` into the `PageHeader` `action` area (keep the existing Import action; place Classify alongside it). Render the summary text with `t("classify.summary" via useTranslations("dashboard.classify"))` under the header. Keep the badge column in the pre-reserved table (no reflow: it is a fixed column, present in header + skeleton).
- [ ] Step 6: Update the skeleton to `columns={5}` and the header to include the new `TableHead`.
- [ ] Step 7: Run the test + typecheck; confirm pass.
- [ ] Step 8: Commit (`feat(people): add classification badge, summary, pseudonymize, and classify entry`).

---

### Task 6: Classify title→role table (Part A) with confidence + state badges

**Files:** Create `apps/dashboard/components/people/classify/classify-title-table.tsx`; Create the route `apps/dashboard/app/(app)/people/classify/page.tsx`. Test `apps/dashboard/components/people/classify/classify-title-table.test.tsx`.

**Pattern to mirror:** `roles/page.tsx` (client page owning queries + `usePageTitle` + `PageHeader` + `Spinner`/skeleton guard); `roles-table.tsx` for a `Table` with a per-row `Select` and exported pure helpers tested in isolation (`matchesRoleQuery` precedent). The page reads `listPeopleByTitle`, `listRoles`, `getModel` (for `tracks`), and `getOrganizationSettings` (pseudonymize). On mount it fires `runClassificationSuggestions` once so a fresh import / new titles get suggested rows before the table renders its state.

This task builds Part A only (title row + role Select + confidence badge + state badge + Confirm). Part B (per-person expansion) and unmatched actions are Tasks 7 and 8.

- [ ] Step 1: Write `classify-title-table.test.tsx`. First the pure helper (no render):
```ts
import { classificationStateForPeople } from "@/components/people/classify/classify-title-table"
const conf = { currentAssignment: { levelSource: "confirmed" as const } }
const sug = { currentAssignment: { levelSource: "suggested" as const } }
const none = { currentAssignment: null }
it("is confirmed only when every person is confirmed", () => {
  expect(classificationStateForPeople([conf, conf])).toBe("confirmed")
})
it("is unclassified when nobody has an assignment", () => {
  expect(classificationStateForPeople([none, none])).toBe("unclassified")
})
it("is pending when mixed or all suggested", () => {
  expect(classificationStateForPeople([conf, sug])).toBe("pending")
  expect(classificationStateForPeople([sug, none])).toBe("pending")
})
it("is unclassified for an empty group", () => {
  expect(classificationStateForPeople([])).toBe("unclassified")
})
```
Then the render tests (mock convex-mocks + org-context): a matched group ("Senior Engineer", confidence "high") renders the `dashboard.classify.confidence.high` badge and a role `Select` prefilled with the suggested role's title; the state badge reflects `classificationStateForPeople`; clicking Confirm calls `assignPersonToRole` once per person in the group with `levelSource: "confirmed"`, the selected `roleId`, and each person's shown level, then shows the `classificationConfirmed` toast. Run; confirm fail.
- [ ] Step 2: Implement `classificationStateForPeople` (exported pure) and the `ClassifyTitleTable` component. Props: `{ orgId, groups, roles, tracks, pseudonymize }` (the page passes query results down so the component stays test-drivable with fixtures). Row = title label + person count + role `Select` (options = `roles.map(r => ({value: r.roleId, label: r.title}))`, default = `group.suggestedRoleId`) + confidence `Badge` (`high`→`default`, `medium`→`secondary`, `unmatched`→`outline`) + state `Badge` + a Confirm `Button`.
  - **Row title label:** render `group.title` when it is a string; render `t("noTitle")` for the `title: null` group (the no-title / unclassified bucket the backend sorts last). This group always arrives with `confidence: "unmatched"` and `suggestedRoleId: null`, so it renders the unmatched confidence badge and the Task 8 unmatched actions (create-role / map-to-existing) exactly like any other unmatched title; its people still get a per-row role Select once a role is chosen.
  - **Row key / selected-role map key:** key rows and the `selectedRole` map by a stable string, not by the possibly-null title. Use `group.title ?? " __no_title__"` (or the group index) as the row key and as the `Map<string, roleId | null>` key, so the null-title group has a distinct, stable entry.
  Track the per-row selected role in local state (`Map<string, roleId | null>` keyed as above), and (Task 7 fills this) the per-person selected level. Confirm handler:
```tsx
const confirm = useMutation(api.people.assignments.assignPersonToRole)
const rowKey = (group) => group.title ?? " __no_title__"
async function onConfirm(group) {
  const roleId = selectedRole.get(rowKey(group)) ?? group.suggestedRoleId
  if (roleId === null) return
  for (const p of group.people) {
    await confirm({
      orgId,
      personId: p.personId,
      roleId,
      level: selectedLevel.get(String(p.personId)) ?? p.suggestedLevel ?? defaultLevelFor(roleId),
      levelSource: "confirmed",
    })
  }
  toast.success(tToast("classificationConfirmed"))
}
```
`defaultLevelFor(roleId)` = the first (lowest) level of the role's track: `TRACK_LEVELS[roleById.get(roleId).trackKey][0]`, guaranteeing a valid level even when the engine gave none.
- [ ] Step 3: Create the route page `people/classify/page.tsx`:
```tsx
"use client"
// reads listPeopleByTitle, listRoles, getModel, getOrganizationSettings;
// fires runClassificationSuggestions once on mount via useEffect + useMutation;
// PageHeader + skeleton guard (undefined queries -> TableSkeleton in the same Table);
// renders <ClassifyTitleTable orgId groups roles tracks={model.tracks} pseudonymize />
```
Fire-once effect:
```tsx
const run = useMutation(api.people.classification.runClassificationSuggestions)
const ranRef = useRef(false)
useEffect(() => {
  if (ranRef.current) return
  ranRef.current = true
  void run({ orgId })
}, [run, orgId])
```
(The mutation is idempotent per Plan 2, so a re-fire is a safe no-op; the ref just avoids a duplicate in-flight call. `listPeopleByTitle` re-runs reactively after the mutation writes suggested rows.)
- [ ] Step 4: Add a nav/entry: the People-list "Classify employees" button (Task 5) already links here; no sidebar change required (Classify is a sub-surface of People).
- [ ] Step 5: Run the tests + typecheck; confirm pass.
- [ ] Step 6: Commit (`feat(classify): add the title-to-role table with confidence and state badges`).

---

### Task 7: Per-person level expansion (Part B)

**Files:** Modify `apps/dashboard/components/people/classify/classify-title-table.tsx` (add the expandable per-person rows); Create `apps/dashboard/components/people/classify/classify-person-rows.tsx`. Extend `classify-title-table.test.tsx`.

**Pattern to mirror:** `roles-table.tsx` group-row expand precedent; shadcn `Collapsible` (`packages/ui/src/components/collapsible.tsx`) or an expanded `TableRow` spanning the columns. Animate the reveal with Motion `AnimatePresence` + `layout` (read `docs/ui-animation.md` first). The expansion extends below the title row (no reflow of rows above). Each person row shows: display name (via `displayNameFor` + pseudonymize), employment start date, computed tenure (years from `employmentStartDate` to today, formatted with `classify.tenureYears`), and a level `Select` whose options are `TRACK_LEVELS[assignedTrackKey]` (the track of the row's currently selected role), defaulted to `p.suggestedLevel` when it is a valid level for that track, else `TRACK_LEVELS[track][0]`.

- [ ] Step 1: Extend the test: expanding a title row (click the expand control with `aria-label` from `classify.expandLabel`) reveals one person row per `group.people`; each shows a level `Select` prefilled with `suggestedLevel`; changing a level then confirming passes the changed level to `assignPersonToRole` for that person. Assert the tenure label renders for a person with a start date. Run; confirm fail.
- [ ] Step 2: Implement `classify-person-rows.tsx` exporting `ClassifyPersonRows({ people, trackKey, selectedLevel, onLevelChange, pseudonymize })`. Level options from `TRACK_LEVELS[trackKey]`; guard each option through `isValidLevelForTrack` (defensive, though `TRACK_LEVELS` is the source). Compute tenure with a pure inline helper:
```tsx
function tenureYears(startDate: string | null, today: Date): number | null {
  if (startDate === null) return null
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  const ms = today.getTime() - start.getTime()
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)))
}
```
(`today` is `new Date()` captured once in the component render; display-only, not engine logic, so `new Date()` is acceptable in a client component.)
- [ ] Step 3: Wire the expansion into `ClassifyTitleTable`: track `expanded: Set<title>` and `selectedLevel: Map<personId, level>` in state; render `ClassifyPersonRows` under the title row when expanded; the Confirm handler already reads `selectedLevel` (Task 6). When the row's selected role changes track, reset that group's per-person levels to the new track's default so an out-of-track level can never be submitted.
- [ ] Step 4: Add the `classifyLevelLabel`/`classifyLevelBody` `HelpMorphButton` next to the level column header (per "guide the user" rule; one help per concept).
- [ ] Step 5: Run tests + typecheck; confirm pass.
- [ ] Step 6: Commit (`feat(classify): add per-person level expansion with track-scoped level selects`).

---

### Task 8: Unmatched-title resolution (create-role + map-to-existing)

**Files:** Create `apps/dashboard/components/people/classify/unmatched-title-actions.tsx`; Modify `classify-title-table.tsx` (render the actions on unmatched rows). Test `apps/dashboard/components/people/classify/unmatched-title-actions.test.tsx`.

**Pattern to mirror:** `create-role-dialog.tsx` (the exact `createRole` call shape, Zod factory `makeCreateRoleSchema`, `SubmitButton` gated on `isValid`, dialog anatomy, toast on success). Here the dialog's title field is prefilled with the unmatched imported title, and on success the new role must appear in the row's role Select immediately: the page's `listRoles` query is reactive, so a `createRole` write re-populates `roles` and the Select options update without manual refetch. "Map to existing" is simply focusing/opening the row's existing role Select (a searchable picker); it reuses the same Select, so it needs no separate mutation.

- [ ] Step 1: Write `unmatched-title-actions.test.tsx`: an unmatched group renders the `createRoleCta` and `mapExistingCta` buttons; opening "Create role" shows a dialog with the title field prefilled to the group title; submitting calls `createRole` with `{orgId, title, function, team, trackKey}` and shows the `roleCreated` toast; clicking "Map to existing" invokes the provided `onMapExisting` callback (which the table wires to open its role Select). Run; confirm fail.
- [ ] Step 2: Implement `unmatched-title-actions.tsx`. Reuse `makeCreateRoleSchema` (from `@/lib/role-schemas`) and the `createRole` mutation exactly as `create-role-dialog.tsx:78,110-127`, but:
  - `defaultValues.title = title` (prefilled from the prop; the parent passes `group.title ?? ""`, so the no-title group opens with an empty title field for HR to fill),
  - no family picker (classification create is family-less: omit `familyId`),
  - `tracks` prop passed from the page's `getModel.tracks` (same `TrackOption` type),
  - on success: `toast.success(tToast("roleCreated"))`, close the dialog, and call `onRoleCreated(roleId)` so the parent selects the new role for this row.
  Props: `{ orgId, title: string, tracks, onRoleCreated: (roleId: Id<"roles">) => void, onMapExisting: () => void }`.
- [ ] Step 3: In `ClassifyTitleTable`, render `UnmatchedTitleActions` inside the row's actions cell when `group.confidence === "unmatched"` (this includes the `title: null` group, in place of the prefilled Select value); pass `title={group.title ?? ""}`; wire `onRoleCreated` to `setSelectedRole(rowKey(group), roleId)` (using the same `rowKey` helper as the confirm handler, so the null-title group's selection is keyed stably) and `onMapExisting` to open the row's Select.
- [ ] Step 4: Run tests + typecheck; confirm pass.
- [ ] Step 5: Commit (`feat(classify): add inline create-role and map-to-existing for unmatched titles`).

---

### Task 9: End-to-end wiring check + full suite

**Files:** none new; verification task.

- [ ] Step 1: Manually trace the Classify page composition: page fires `runClassificationSuggestions` on mount, guards all four queries with a `TableSkeleton`, renders `ClassifyTitleTable` with `groups=listPeopleByTitle`, `roles=listRoles`, `tracks=getModel.tracks`, `pseudonymize=getOrganizationSettings.pseudonymizeNames`. Confirm every mutation call shape matches the consumed signatures (`assignPersonToRole`, `createRole`, `runClassificationSuggestions`).
- [ ] Step 2: Confirm no hardcoded UI text remains (grep the new files for string literals in JSX; all must be `t(...)`), no em dashes in copy/comments, and internal links use `Link`.
- [ ] Step 3: Run the full suite: `bun run test` (cache-backed turbo) + `bun run typecheck`; confirm all packages pass and the i18n parity test is green.
- [ ] Step 4: Grep all 5 locale files for mojibake in the new keys; confirm clean.
- [ ] Step 5: Commit any final touch-ups (`refactor(classify): final wiring and copy pass`), otherwise no-op.

---

## Notes on decisions applied

- **Eager-suggested persistence** is Plan 2's job; Plan 3 only *triggers* it (on Classify-page mount) and *reads* the resulting state. HR confirm flips `levelSource` to `"confirmed"` via `assignPersonToRole`; Plan 3 never duplicates the assignment write logic (that shared DB helper lives in Plan 2's refactor of `people/assignments.ts`).
- **Statistikkod** is not surfaced in this UI (deferred matching signal); the confidence badge reflects the title-only match Plan 1/2 produce.
- **Erasure** is not in this plan (Plan 4, org-scoped HR path).
- **Pseudonymize** is display-only: the stored `displayName` is untouched; `displayNameFor` chooses the render, and every place a person name appears on these two surfaces routes through it.
