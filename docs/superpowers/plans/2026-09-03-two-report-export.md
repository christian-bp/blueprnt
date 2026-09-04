# Two Report Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the masked documentation PDF and the masked union PDF with two deliberately different documents from one frozen pay mapping: a 6 to 8 page signing report (aggregates, statuses, signature block, nothing per group) and an unmasked detail appendix (every group, amount, reason, action and the frozen method), both downloadable by every member and each logged before the file is handed over.

**Architecture:** One unmasked assembly (`assemblePayMappingReport`) feeds two pure projections: `detailAppendixDoc` (identity) and `signingReportDoc` (counts, shares and statuses; the ONLY place masking exists, and its type has no field for a group-level amount). Two `@react-pdf/renderer` document components share table, identity and signature primitives lifted into `components/pdf/`. Four small data-model changes support them: an optional samverkan date on the run, a `praxis` action target, a per-run action number, and the frozen method on the run's wire. A pure `analysis-status` helper derives one status per equal-work group and per equivalent-work comparison for both documents.

**Tech Stack:** Convex (packages/backend, convex-test on edge-runtime), Next.js 16 dashboard (React 19, next-intl, react-hook-form + Zod, Base UI via @workspace/ui), @react-pdf/renderer, jszip, exceljs, Vitest 4, Biome, MDX guide corpus with `docs:sync`.

**Spec:** `docs/superpowers/specs/2026-09-03-two-report-export-design.md`

## Global Constraints

- All code, code comments, log messages, commit messages, and code filenames are in English. Domain documents under `docs/` (the ADR, the kravbild) are in Swedish.
- Never use em dashes in text we write: UI copy, documents, comments, commit messages. Use a period, comma, colon, or parentheses instead.
- All user-facing text goes through i18n. New strings are added to `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json` and `fi.json` in the same task; the parity test in `packages/i18n` fails on any missing key. Edit the JSON files with the Edit tool, never with perl/sed (non-ASCII double-encodes). Every locale ships at production quality when written; never mark a string as draft.
- Help bodies (`dashboard.help.*Body`) are at most two sentences, max 200 characters in en and 240 in the other locales (`packages/i18n/src/messages.test.ts` enforces it). A `HelpMorphButton` sits only after a title or heading.
- Every state-changing mutation writes an audit row via `ctx.audit.log` with an `AUDIT_EVENTS` key. A new event ships its `AuditPayloads` entry, its `AUDIT_SUBJECTS` deriver, its `dashboard.auditLog.events.*` label in every locale, and its category (`categoryForEvent`, `payMapping.*` is already `pay`). A new payload field ships its `dashboard.auditLog.fields.*` label in every locale and joins `ALL_AUDIT_FIELDS` in `apps/dashboard/lib/audit-labels.test.ts`. A coded value ships its value labels through `resolveCodedValue`'s domain maps.
- Tests run with Vitest 4 via `bun run test`, never `bun test`. Per package: `cd packages/backend && bun run test`, `cd apps/dashboard && bun run test`, `cd packages/i18n && bun run test`. Backend typecheck: `cd packages/backend && bunx tsc --noEmit -p convex`. Dashboard typecheck: `cd apps/dashboard && bunx tsc --noEmit`.
- New code ships with tests in the same task. The tree (typecheck, tests, Biome) is green after every task.
- Biome ends every task at zero errors, warnings and infos: `bunx biome check <files>` from the repo root; fix, never ignore.
- No legacy before launch: when something is replaced, delete it completely (schema fields, dead constants, compat shims, unused i18n keys, the retired kravbild). Pre-launch data is reset, never backfilled.
- DRY and typed by default: one constant, helper or builder per literal or shape; never widen to `any`.
- UI is built only from `@workspace/ui` components or the app primitives composed from them: dates through `DatePicker` (never `<input type="date">`), selects through `Select`, dialogs with the standard shadcn anatomy. Row and table actions live behind a `...` `DropdownMenu`.
- User-initiated CRUD shows a toast (`toast.success(t("dashboard.toast.<op>"))`, `toast.error(t("dashboard.toast.error"))`).
- Any change under `apps/dashboard/content/docs/` ends with `bun run docs:sync` from `apps/dashboard`, in the same change. New guide rules ship as guards in `apps/dashboard/lib/docs/docs-guards.test.ts`.
- Every download writes its audit row BEFORE the file is handed over; a failed log aborts the download (today's rule, kept).
- No task commits. Every task leaves the tree uncommitted for review (the repo's flow: implementers never commit; focused commits by path happen after the whole slice is reviewed). The "Suggested message for the post-review focused commit" line in each task is for that later commit, never an instruction to commit now. No AI attribution anywhere.
- Tasks 7 through 11c form ONE staged chain: from Task 7 (the assembly becomes unmasked) until Task 11c deletes them, the retired documentation and union PDFs print unmasked figures. That is acceptable only because nothing is committed or deployed before Task 11c removes them; never stop the slice inside the chain.
- Every task ends with a file-by-file change summary.

## Choices made where the spec is silent

These values are used consistently across every task; do not re-decide them mid-plan.

- Collaboration date audit diff field key: `collaborationDate` (an ISO `YYYY-MM-DD` string, never epoch ms), labeled "Collaboration date". It joins `AUDIT_ISO_DATE_FIELDS`.
- Praxis action target refusal when the area's finding is not `found`: `ERROR_CODES.invalidInput` (the UI only offers the action when the finding is `found`, so no new translated code is needed). Notes never take a praxis target.
- Praxis action's audit `targetLabel` is the raw area key (as `payMapping.groupAnalysisUpdated` already logs it); the audit log resolves it through `PRAXIS_AREA_VALUE_KEYS`.
- File name segments stay Swedish constants like today's (`-lonekartlaggning.pdf`, `-nyckeltal.xlsx`, `-arkiv.zip`): `<label>-signeringsrapport.pdf` and `<label>-detaljbilaga.pdf`.
- Backend mutations: `logPayMappingSigningReportExport` and `logPayMappingDetailAppendixExport` in `payMapping/report.ts`; audit events `payMapping.signingReportExported` and `payMapping.detailAppendixExported`; `AUDIT_EVENTS` keys `payMappingSigningReportExported` and `payMappingDetailAppendixExported`.
- Action number column header: "No." (en), "Nr" (sv), "Nr." (nb, da), "Nro" (fi). Rendered `#<n>` everywhere.
- The actions overview scope filter's third option is labeled with the praxis chapter's short name ("Practice"); its deep link opens the praxis chapter at `?step=praxis:<area>`.
- Previous run's actions with their live statuses render in the detail appendix's chapter 4 as a sub-table under the `previousActions` praxis area (statutory 13 § 3 p content); no extra chapter.
- The signing report's quartile chart is the vector `PairedBarsChart`; the raster chart capture (`lib/chart-capture.ts`, the capture host) has no consumer left and is deleted.
- Formatters gain `dateTime(epochMs)` for the extraction instant; `date(epochMs)` stays day precision.
- Analysis status precedence: an action targeting the row wins (`actionDecided`), then a row with no documentation duty (`noActionNeeded`), then a done row with a reason or a note (`objectiveReason`), else `furtherAnalysis`.
- Signing "assessments completed x of y": x = required groups marked done, y = required groups. Equivalent work "comparisons assessed x of y": x = the comparisons whose women-dominated group is marked done, y = every relevant comparison. Both rows count in the unit their label names, and both print in the x-of-y form the owner table draws.
- Signing "comparable groups" = every mixed-gender group the analysis reached, in both directions (`equalWork` plus `reverseGroups`); the "of which women are ahead" row under it carries the split. Only gender-pure and singleton groups are not comparable, and they are counted in the exclusions. Every duty-bearing measure (required, assessed, objective reasons, actions decided, the status record) stays on the women-behind subset: a women-ahead group carries no documentation duty (ADR-0015).
- Signing equivalent-work "actions decided" counts comparison-anchored plus group-anchored measures (`womenDominatedGroupStatus`), because a measure for a women-dominated group may be anchored on the group or on one of its members and would otherwise reach the action plan but not the measures table.
- Signing "insufficient basis" = groups whose `masked` flag is set (the export thresholds), counted over the comparable set (both directions).
- The detail appendix's cover classification line is one i18n string; "every download is logged" is stated there and in the panel's help text.
- Action numbers come from a per-run counter on the run row (`payMappingRuns.actionCounter`, seeded 0 at creation) that never reuses a number: a hard-deleted action does not free its number, and a tombstoned one keeps it.
- The signing projection test scans the PROJECTION's JSON (`JSON.stringify(signingReportDoc(full))`), not rendered PDF text: the signing labels derive only from `SigningReportDoc`, so a group amount or name that is absent from the projection cannot reach the document.
- The actions overview's third scope option is keyed `dashboard.payMapping.actionsOverview.scopePraxis` (select value `praxis`).
- The export-threshold constants and predicates live in `apps/dashboard/lib/pay-mapping-masking.ts` from Task 8 on (no react-pdf import), read by the signing projection, the assembly's `orgVariablePayStats`, the key-figures workbook, and the overview redesign plan's Task 5 from that same path.
- The kit (`components/pdf/`) never touches `pay-mapping-report-data.ts`: that module is engine-agnostic (ADR-0026) and must not import `@react-pdf/renderer`; the retired report's `computeHeaderBreaks(doc, rowPages)` stays there until Task 11c deletes it with its tests.

---

## File map

**Backend (`packages/backend/convex/`)**
- Modify `payMapping/tables.ts`: `collaboration.date`, `praxisAreaValidator`, praxis variant of `actionTargetValidator`, `ACTION_TARGET_KINDS`, `payMappingRuns.actionCounter`, `payMappingActions.number`.
- Modify `payMapping/runs.ts`: `setPayMappingCollaboration` date arg + audit diff; `startPayMappingRun` seeds `actionCounter: 0`; `getPayMappingRunBySlug` returns `systemVersion`, `collaboration.date`, `frozenMethod`.
- Modify `payMapping/workLayer.ts`: praxis branches, `assertPraxisTargetAllowed`.
- Modify `payMapping/actions.ts`: praxis gate, numbering, `number` on the wire.
- Modify `payMapping/notes.ts`: refuse praxis targets.
- Modify `payMapping/report.ts`: two new log mutations replace the report/union ones.
- Modify `lib/audit.ts`: `COLLABORATION_AUDIT_FIELDS`, events, subjects.
- Modify `lib/auditPayloads.ts`: payload contracts.
- Modify tests: `payMapping/runs.test.ts`, `payMapping/actions.test.ts`, `payMapping/notes.test.ts` (create if absent), `payMapping/erasure.test.ts`, `payMapping/report.test.ts`.

**Dashboard (`apps/dashboard/`)**
- Modify `lib/audit-constants.ts`, `lib/audit-detail.tsx`, `lib/audit-labels.test.ts`.
- Modify `components/pay-mapping/pay-mapping-gap-types.ts` (+ test): praxis target, `number`, `frozenMethod`, `systemVersion`, `collaboration.date`, `targetGroupLabel` resolver.
- Modify `test/pay-mapping-fixtures.ts`.
- Create `components/pay-mapping/analysis-status.ts` (+ test).
- Modify `components/pay-mapping/pay-mapping-report-data.ts` (+ test): unmasked assembly, new doc shape.
- Create `lib/pay-mapping-masking.ts`: the export-threshold constants and predicates (no react-pdf import; the overview redesign plan consumes them from this path).
- Create `components/pay-mapping/signing-report-data.ts` (+ test): `signingReportDoc`, `detailAppendixDoc`.
- Create `lib/iso-date.ts`; modify `components/date-picker.tsx` (`disabled` prop).
- Create `components/pdf/pdf-table.tsx`, `components/pdf/identity-block.tsx`, `components/pdf/signature-block.tsx` (+ `components/pdf/pdf-primitives-render.test.tsx`).
- Create `components/pay-mapping/signing-report-doc.tsx` (+ `signing-report-render.test.tsx`).
- Create `components/pay-mapping/detail-appendix-doc.tsx` (+ `detail-appendix-render.test.tsx`).
- Modify `components/pay-mapping/pay-mapping-report-export.tsx`, `pay-mapping-report.tsx`, `pay-mapping-report-download.tsx` (+ test), `pay-mapping-run-actions.tsx` (+ test), `pay-mapping-archive-export.ts` (+ test), `pay-mapping-metrics-export.ts`.
- Delete `components/pay-mapping/pay-mapping-report-doc.tsx`, `pay-mapping-report-render.test.tsx`, `lib/chart-capture.ts`, `lib/chart-capture.test.ts`; trim `pay-mapping-report-charts.tsx`.
- Modify `components/pay-mapping/review-praxis-step.tsx` (+ test), `pay-mapping-analysis.tsx`, `actions-overview.tsx` (+ test), `review-start-step.tsx` (+ test), `action-dialog.tsx`.
- Modify `lib/docs/docs-nav.ts`; create `content/docs/{en,sv,nb,da,fi}/pay-mapping-reports.mdx`; modify `content/docs/*/glossary.mdx` and `content/docs/*/collaboration.mdx`.

**i18n (`packages/i18n/messages/`)**: `en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json` in every task that adds a string.

**Docs**: create `docs/adr/0030-tva-rapporter-fran-en-fryst-kartlaggning.md`; modify `docs/lonekartlaggning-rapport-kravbild.md`, `docs/lonekartlaggning-arkivpaket-kravbild.md`; delete `docs/lonekartlaggning-facklig-rapport-kravbild.md`.

---

### Task 1: Collaboration date on the run

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts` (the `collaboration` field)
- Modify: `packages/backend/convex/payMapping/runs.ts` (`getPayMappingRunBySlug` collaboration validator + handler; `setPayMappingCollaboration`)
- Modify: `packages/backend/convex/lib/audit.ts` (new `COLLABORATION_AUDIT_FIELDS`)
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (`payMapping.collaborationUpdated`)
- Modify: `packages/backend/convex/payMapping/runs.test.ts` (the `setPayMappingCollaboration` describe)
- Modify: `packages/backend/convex/lib/audit.test.ts` (`otherFieldSets`)
- Modify: `apps/dashboard/lib/audit-constants.ts` (`AUDIT_ISO_DATE_FIELDS`)
- Modify: `apps/dashboard/lib/audit-labels.test.ts` (import + `ALL_AUDIT_FIELDS`)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (`PayMappingRunDetail.collaboration`)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.auditLog.fields.collaborationDate`)

**Interfaces:**
- Produces: `payMappingRuns.collaboration: { participants: string; description: string; date?: number }`; `setPayMappingCollaboration({ runId, participants, description, date?: number })`; wire `collaboration: { participants; description; date: number | null } | null`; `COLLABORATION_AUDIT_FIELDS = ["collaborationDate"] as const`; payload `"payMapping.collaborationUpdated": { runId: string; changes: Changes }`.

- [ ] **Step 1: Write the failing backend tests**

Append inside `describe("setPayMappingCollaboration", ...)` in `packages/backend/convex/payMapping/runs.test.ts` (after the existing audit-row test):

```ts
  it("stores an optional samverkan date, reads it back, and clears it when omitted", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "Fackligt ombud",
      description: "Beskrivning",
      date: Date.UTC(2026, 8, 15),
    })
    let result = await asHr.query(api.payMapping.runs.getPayMappingRunBySlug, {
      orgId,
      slug: "test-run",
    })
    expect(result?.collaboration).toEqual({
      participants: "Fackligt ombud",
      description: "Beskrivning",
      date: Date.UTC(2026, 8, 15),
    })

    // Saving without a date clears it: the date is optional and the pair
    // of text fields is what the done rule reads.
    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "Fackligt ombud",
      description: "Beskrivning",
    })
    result = await asHr.query(api.payMapping.runs.getPayMappingRunBySlug, {
      orgId,
      slug: "test-run",
    })
    expect(result?.collaboration).toEqual({
      participants: "Fackligt ombud",
      description: "Beskrivning",
      date: null,
    })
  })

  it("diffs the date as an ISO day in the audit row and never the participant text", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)

    await asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
      orgId,
      runId,
      participants: "Fackligt ombud Anna Persson",
      description: "Beskrivning",
      date: Date.UTC(2026, 8, 15),
    })
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.collaborationUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.payload).toEqual({
      runId,
      changes: { collaborationDate: { from: null, to: "2026-09-15" } },
    })
    expect(JSON.stringify(audits[0]?.payload)).not.toContain("Anna")
    expect(audits[0]?.searchText).not.toContain("anna")
  })

  it("rejects a non-finite date", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t, noRequiredGroupRows)
    await expect(
      asHr.mutation(api.payMapping.runs.setPayMappingCollaboration, {
        orgId,
        runId,
        participants: "Fackligt ombud",
        description: "Beskrivning",
        date: Number.NaN,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })
```

Also update the existing audit test in that describe (`writes exactly one payMapping.collaborationUpdated audit row carrying only runId, never the participant name`): its three payload assertions

```ts
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(["runId"])
    expect(payload.runId).toBe(runId)
```

become

```ts
    const payload = audits[0]?.payload as Record<string, unknown>
    // The marker plus the one diffable field: nothing else, ever.
    expect(Object.keys(payload).sort()).toEqual(["changes", "runId"])
    expect(payload.runId).toBe(runId)
    // A text-only save changes no diffable field.
    expect(payload.changes).toEqual({})
```

(the `not.toContain("Anna Persson")` assertion stays), and rename the test to `writes exactly one payMapping.collaborationUpdated audit row carrying runId and the date diff, never the participant name`. In `packages/backend/convex/lib/audit.test.ts`, add `COLLABORATION_AUDIT_FIELDS` to the import from `./audit` and to the hand-listed `otherFieldSets` object in the test `keeps identity fields out of every other event's diff` (after `NOTE_AUDIT_FIELDS,`), so the identity cross-check covers it.

Also change the test in `it("sets collaboration and reads it back trimmed via the slug query")` from `expect(result?.collaboration).toEqual({ participants: ..., description: ... })` to include `date: null`:

```ts
    expect(result?.collaboration).toEqual({
      participants: "Fackligt ombud Anna Persson",
      description: "Kvartalsvisa moten med de fackliga representanterna.",
      date: null,
    })
```

- [ ] **Step 2: Run the backend tests to verify they fail**

Run: `cd packages/backend && bun run test -- payMapping/runs.test.ts`
Expected: FAIL (the `date` arg is rejected by the validator; the payload shape differs).

- [ ] **Step 3: Schema, mutation, wire and audit wiring**

In `packages/backend/convex/payMapping/tables.ts` replace the `collaboration` field of `payMappingRuns`:

```ts
  // The samverkansredogörelse (DL 3 kap. 11-14 §§): who the employer
  // cooperated with on the kartläggning, how, and optionally on which day
  // (epoch ms, day precision, like plannedDate on actions). Cleared
  // (undefined) when both text fields are emptied, never stored as an
  // empty-string object. Participants are people's names by design
  // (statutory documentation content on this run document), but must NEVER
  // enter the audit trail (setPayMappingCollaboration diffs the date only).
  collaboration: v.optional(
    v.object({
      participants: v.string(),
      description: v.string(),
      date: v.optional(v.number()),
    })
  ),
```

In `packages/backend/convex/lib/audit.ts`, after `NOTE_AUDIT_FIELDS`:

```ts
// The one collaboration field that enters the trail on
// payMapping.collaborationUpdated: the samverkan day as an ISO date string.
// The participants and the description never do (names by design, ADR-0027).
export const COLLABORATION_AUDIT_FIELDS = ["collaborationDate"] as const
```

In `packages/backend/convex/lib/auditPayloads.ts` replace the `payMapping.collaborationUpdated` entry:

```ts
  // The samverkan (collaboration) participants are people's names by design
  // (statutory documentation content), so the trail records only THAT the
  // field changed plus the diff of the one non-identity field, the
  // collaboration date (COLLABORATION_AUDIT_FIELDS, an ISO day string).
  "payMapping.collaborationUpdated": { runId: string; changes: Changes }
```

In `packages/backend/convex/payMapping/runs.ts`:

1. Add to the imports from `../lib/audit`: `buildChanges, COLLABORATION_AUDIT_FIELDS` (so the line reads `import { AUDIT_EVENTS, buildChanges, COLLABORATION_AUDIT_FIELDS, resolveActorName } from "../lib/audit"`), and add `import { plannedDateIso } from "./workLayer"`.
2. In `getPayMappingRunBySlug`'s `returns` validator replace the `collaboration` entry:

```ts
      collaboration: v.union(
        v.object({
          participants: v.string(),
          description: v.string(),
          date: v.union(v.number(), v.null()),
        }),
        v.null()
      ),
```

and in the handler replace `collaboration: run.collaboration ?? null,` with

```ts
      collaboration:
        run.collaboration === undefined
          ? null
          : {
              participants: run.collaboration.participants,
              description: run.collaboration.description,
              date: run.collaboration.date ?? null,
            },
```

3. Replace the whole `setPayMappingCollaboration` export:

```ts
// The samverkansredogörelse (DL 3 kap. 11-14 §§): who the employer
// cooperated with, how, and optionally on which day. Trims both text fields;
// when both are empty after trim, clears the field entirely (never stores an
// empty-string object), date included. The date is optional and outside the
// done rule (both text fields non-empty); it prints on the signing report's
// formalities page.
// AUDIT PRIVACY: participants are people's names by design (statutory
// documentation content on this run document), so the trail diffs ONLY the
// date (COLLABORATION_AUDIT_FIELDS, as an ISO day); the names themselves
// must NEVER enter the audit payload/searchText.
const COLLABORATION_DATE_MIN = Date.UTC(2000, 0, 1)
const COLLABORATION_DATE_MAX = Date.UTC(2100, 0, 1)

export const setPayMappingCollaboration = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    participants: v.string(),
    description: v.string(),
    date: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, participants, description, date }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    // v.number() accepts NaN/Infinity; an out-of-range day would make the
    // ISO diff throw a raw RangeError after the write.
    if (
      date !== undefined &&
      (!Number.isFinite(date) ||
        date < COLLABORATION_DATE_MIN ||
        date > COLLABORATION_DATE_MAX)
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }

    const trimmedParticipants = participants.trim()
    const trimmedDescription = description.trim()
    const cleared = trimmedParticipants === "" && trimmedDescription === ""
    const nextDate = cleared ? undefined : date
    if (cleared) {
      await ctx.db.patch(runId, { collaboration: undefined })
    } else {
      await ctx.db.patch(runId, {
        collaboration: {
          participants: trimmedParticipants,
          description: trimmedDescription,
          ...(nextDate !== undefined ? { date: nextDate } : {}),
        },
      })
    }
    const dateView = (value: number | undefined) => ({
      collaborationDate: value === undefined ? null : plannedDateIso(value),
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingCollaborationUpdated,
      payload: {
        runId,
        changes: buildChanges(
          dateView(run.collaboration?.date),
          dateView(nextDate),
          COLLABORATION_AUDIT_FIELDS
        ),
      },
    })
    return null
  },
})
```

- [ ] **Step 4: Dashboard audit wiring and the client type**

In `apps/dashboard/lib/audit-constants.ts` replace `AUDIT_ISO_DATE_FIELDS`:

```ts
// ISO-date-string payload fields (person employmentStartDate, birthDate,
// action plannedDate, the run's collaborationDate): localized through the
// same dateLabel, so one sheet never mixes "2024-01-15" with "Jan 15, 2024".
export const AUDIT_ISO_DATE_FIELDS: ReadonlySet<string> = new Set([
  "employmentStartDate",
  "birthDate",
  "plannedDate",
  "collaborationDate",
])
```

In `apps/dashboard/lib/audit-labels.test.ts` add `COLLABORATION_AUDIT_FIELDS,` to the import list from `@workspace/backend/convex/lib/audit` (alphabetical position after `AUDIT_EVENTS,`), and add `...COLLABORATION_AUDIT_FIELDS,` to `ALL_AUDIT_FIELDS` right after `...NOTE_AUDIT_FIELDS,`.

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` replace the `collaboration` member of `PayMappingRunDetail`:

```ts
  // The samverkansredogörelse (who the employer cooperated with, how, and
  // optionally on which day, epoch ms); null until set. Participant names
  // are statutory documentation content on the run, never audited (see
  // setPayMappingCollaboration).
  collaboration: {
    participants: string
    description: string
    date: number | null
  } | null
```

In `packages/i18n/messages/en.json`, inside `dashboard.auditLog.fields`, after `"plannedDate": "Planned date",` add:

```json
      "collaborationDate": "Collaboration date",
```

Mirror in the other four files at the same position:
- sv: `"collaborationDate": "Samverkansdatum",`
- nb: `"collaborationDate": "Samarbeidsdato",`
- da: `"collaborationDate": "Samarbejdsdato",`
- fi: `"collaborationDate": "Yhteistoiminnan päivä",`

- [ ] **Step 5: Fix the dashboard fixtures that build a collaboration object**

Every literal of the form `collaboration: { participants: "...", description: "..." }` in `apps/dashboard` now needs `date: null`. Run `cd apps/dashboard && bunx tsc --noEmit` and add `date: null` to each reported literal. Known sites: `components/pay-mapping/pay-mapping-report-render.test.tsx` (the `buildDoc` fixture), `components/pay-mapping/pay-mapping-report-data.test.ts` (the `assemble` helper), `components/pay-mapping/pay-mapping-report-download.test.tsx` (the `usePayMappingRun` mock), `components/pay-mapping/review-start-step.test.tsx` (any `collaboration:` override), `components/pay-mapping/pay-mapping-run-shell.test.tsx`, `components/pay-mapping/review-queue.test.ts` and `review-checklist.test.tsx` if they pass a collaboration object to `buildReviewQueue` (that input type is `{ participants; description } | null` and is structurally satisfied by the wider wire object; only literals typed as `PayMappingRunDetail["collaboration"]` need the field). The review-start-step reads `collaboration?.participants`/`.description` only, so it keeps compiling.

- [ ] **Step 6: Run the tests and typechecks**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping/runs.test.ts`
Expected: PASS.
Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- lib/audit-labels.test.ts`
Expected: PASS.
Run: `cd packages/i18n && bun run test`
Expected: PASS.
Run: `bunx biome check packages/backend/convex/payMapping packages/backend/convex/lib apps/dashboard/lib apps/dashboard/components/pay-mapping packages/i18n/messages`
Expected: no diagnostics.

- [ ] **Step 7: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): record an optional samverkan date on the run`

---

### Task 2: Praxis action target

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts` (`praxisAreaValidator`, `actionTargetValidator`, `ACTION_TARGET_KINDS`)
- Modify: `packages/backend/convex/payMapping/workLayer.ts` (praxis branches, `assertPraxisTargetAllowed`)
- Modify: `packages/backend/convex/payMapping/actions.ts` (call the gate)
- Modify: `packages/backend/convex/payMapping/notes.ts` (`allowPraxis: false`)
- Modify: `packages/backend/convex/payMapping/actions.test.ts`
- Modify: `apps/dashboard/lib/audit-constants.ts` (`TARGET_KIND_VALUE_KEYS`, `CODED_FIELD_DOMAINS.targetLabel`)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (+ test)
- Modify: `apps/dashboard/components/pay-mapping/actions-overview.tsx`, `pay-mapping-report-data.ts` (+ test), `pay-mapping-report-doc.tsx`, `pay-mapping-report-export.tsx`, `pay-mapping-analysis.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.payMapping.actions.targetKind.praxis`)

**Interfaces:**
- Produces: target variant `{ kind: "praxis"; area: PraxisAreaKey }` on the backend validator and on `ActionTargetWire`; `ACTION_TARGET_KINDS = ["group","person","comparison","praxis"]`; `assertPraxisTargetAllowed(ctx, orgId, runId, target)`; `validateTarget(rows, target, { allowExcludedGroups, allowPraxis })`; `targetGroupLabel(target, praxisAreaLabel: (area: PraxisAreaKey) => string)`; `targetScope(target)` in actions-overview returns `"equalWork" | "equivalentWork" | "praxis"`.

- [ ] **Step 1: Write the failing backend tests**

In `packages/backend/convex/payMapping/actions.test.ts`, inside `describe("payMapping actions", ...)` add:

```ts
  it("accepts a praxis target only when the area's finding is found, labels it by the area key, and refuses it on notes", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    // No praxis row yet: no finding, so no action.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: { kind: "praxis", area: "payPolicy" },
      })
    ).rejects.toThrow(/errors.invalidInput/)

    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "payPolicy",
      reasons: [],
      note: "Criteria are unclear to managers.",
      done: false,
      finding: "found",
    })
    const actionId = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
      target: { kind: "praxis", area: "payPolicy" },
    })
    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list.find((a) => a.actionId === actionId)?.target).toEqual({
      kind: "praxis",
      area: "payPolicy",
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.actionCreated")
        )
        .collect()
    )
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.targetKind).toBe("praxis")
    // The raw area key, as the praxis analysis rows already log it; the
    // audit log resolves it to the area's title.
    expect(payload.targetLabel).toBe("payPolicy")

    // A finding of "none" carries nothing to act on.
    await asHr.mutation(api.payMapping.analyses.upsertGroupAnalysis, {
      orgId,
      runId,
      scope: "praxis",
      groupKey: "benefits",
      reasons: [],
      done: false,
      finding: "none",
    })
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: { kind: "praxis", area: "benefits" },
      })
    ).rejects.toThrow(/errors.invalidInput/)

    // Notes never anchor to a practice area.
    await expect(
      asHr.mutation(api.payMapping.notes.createNote, {
        orgId,
        runId,
        target: { kind: "praxis", area: "payPolicy" },
        text: "A note",
        noteType: "discussionNeeded",
      })
    ).rejects.toThrow(/errors.invalidInput/)

    // An unknown area never passes the validator (a literal union, not a
    // free string).
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        // The cast is the point: the wire type refuses it, and so must the
        // runtime validator.
        target: { kind: "praxis", area: "nope" } as unknown as {
          kind: "praxis"
          area: "payPolicy"
        },
      })
    ).rejects.toThrow()
  })
```

(Check `packages/backend/convex/payMapping/notes.ts` for `createNote`'s exact arg names before running; the args are `runId`, `target`, `text`, `noteType`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bun run test -- payMapping/actions.test.ts`
Expected: FAIL with a validator error on `kind: "praxis"`.

- [ ] **Step 3: Backend validator, kinds and gate**

In `packages/backend/convex/payMapping/tables.ts` add `import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"` (replace the existing `PayGapReason` type import), and before `actionTargetValidator`:

```ts
// The praxis review areas as a validator, mirroring PRAXIS_AREA_KEYS
// (@workspace/constants). Spelled out rather than mapped from the constant
// so the drift guard below can prove the two admit exactly the same keys.
export const praxisAreaValidator = v.union(
  v.literal("payPolicy"),
  v.literal("collectiveAgreements"),
  v.literal("benefits"),
  v.literal("payPractices"),
  v.literal("previousActions")
)
type PraxisAreaFromValidator = Infer<typeof praxisAreaValidator>
type _PraxisAreasExact = PraxisAreaFromValidator extends PraxisAreaKey
  ? PraxisAreaKey extends PraxisAreaFromValidator
    ? true
    : never
  : never
const _assertPraxisAreasMatch: _PraxisAreasExact = true
void _assertPraxisAreasMatch
```

Add a fourth member to `actionTargetValidator` after the `comparison` object:

```ts
  // A practice area (DL 3 kap. 8 § p1) whose review found a deficiency: the
  // action plan's fix for it. No person data rides on this kind, so no
  // export masking ever applies to it. Allowed only while the area's
  // finding is "found" (assertPraxisTargetAllowed).
  v.object({
    kind: v.literal("praxis"),
    area: praxisAreaValidator,
  })
```

Replace `ACTION_TARGET_KINDS`:

```ts
export const ACTION_TARGET_KINDS = [
  "group",
  "person",
  "comparison",
  "praxis",
] as const
```

In `packages/backend/convex/payMapping/workLayer.ts`:

1. Extend `validateTarget`'s options and add the praxis branch at the top of the body (after `const { equalWork, excluded, womenDominated } = buildGapAggregates(rows)` is fine, but put it BEFORE that line so a praxis target never pays for the aggregate):

```ts
export function validateTarget(
  rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget,
  options: { allowExcludedGroups: boolean; allowPraxis: boolean }
): { targetLabel: string } {
  // A practice area is not a group: its label is the constant area key
  // (the same value the praxis analysis rows log), and whether an action
  // may anchor to it depends on the area's finding, which
  // assertPraxisTargetAllowed reads from the analyses. Notes never take it.
  if (target.kind === "praxis") {
    if (!options.allowPraxis) throw appError(ERROR_CODES.invalidInput)
    return { targetLabel: target.area }
  }
  const { equalWork, excluded, womenDominated } = buildGapAggregates(rows)
```

2. Replace `targetLabelFromRows` and `resolveTargetLabel` bodies with one shared derivation:

```ts
// The audit-safe label of a target: the comparator's role title for a
// comparison (the row the reader documented), the raw area key for a
// practice area (a constant slug, never split on "|"), the group's role
// title otherwise. Every kind labels without a database read.
function targetLabelOf(target: ActionTarget): string {
  if (target.kind === "praxis") return target.area
  return groupKeyLabel(
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  )
}

// The audit-safe label of an EXISTING record's target, from rows the caller
// already holds (updateAction diffs the OLD target's label without a second
// snapshot read).
export function targetLabelFromRows(
  _rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget
): string {
  return targetLabelOf(target)
}

// The audit-safe display label for an EXISTING record's target (status
// flips, deletes: no re-validation, no whole-snapshot read).
export function resolveTargetLabel(target: ActionTarget): string {
  return targetLabelOf(target)
}
```

3. Add after `assertOwnerIsMember`:

```ts
// A praxis-targeted action is the plan's answer to a deficiency, so the
// area's review must have FOUND one: the praxis analysis row for the area
// must carry finding "found". Read in the same transaction as the write;
// a group/person/comparison target passes through untouched.
export async function assertPraxisTargetAllowed(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  runId: Id<"payMappingRuns">,
  target: ActionTarget
): Promise<void> {
  if (target.kind !== "praxis") return
  const rows = await ctx.db
    .query("payMappingGroupAnalyses")
    .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
    .collect()
  const area = rows.find(
    (row) => row.scope === "praxis" && row.groupKey === target.area
  )
  if (area?.finding !== "found") throw appError(ERROR_CODES.invalidInput)
}
```

In `packages/backend/convex/payMapping/actions.ts`: import `assertPraxisTargetAllowed` from `./workLayer`; in both `createAction` and `updateAction` change the `validateTarget(...)` call's options to `{ allowExcludedGroups: false, allowPraxis: true }`, skip the snapshot read for a praxis target (it validates against the analyses, never the rows), and gate it:

```ts
    // A praxis target validates against the area's finding, never the
    // frozen rows: no snapshot read for it.
    const rows =
      content.target.kind === "praxis"
        ? []
        : await snapshotRowsForRun(ctx, ctx.orgId, runId)
    const { targetLabel } = validateTarget(rows, content.target, {
      allowExcludedGroups: false,
      allowPraxis: true,
    })
    await assertPraxisTargetAllowed(ctx, ctx.orgId, runId, content.target)
```

(in `updateAction` the run id is `action.runId`, and its later `targetLabelFromRows(rows, action.target)` call keeps working with the empty array because every kind labels without a row read).

In `packages/backend/convex/payMapping/notes.ts` change the `validateTarget` options to `{ allowExcludedGroups: true, allowPraxis: false }`.

- [ ] **Step 4: Dashboard wire types, label resolver and audit value keys**

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`:

1. Change the constants import to `import { type BasePayBasis, fteTotalMonthlyComp, type PayGapReason, type PraxisAreaKey } from "@workspace/constants"`.
2. Replace `ActionTargetWire`:

```ts
// What an action or note is anchored to (ADR-0015): a whole comparison
// group, one individual within a group, a women-dominated comparison, or
// (actions only) a practice area whose review found a deficiency.
// Individuals are referenced by personPublicId only (Role != Person);
// display values come from the snapshot row.
export type ActionTargetWire =
  | { kind: "group"; scope: "equalWork" | "equivalentWork"; groupKey: string }
  | {
      kind: "person"
      scope: "equalWork" | "equivalentWork"
      groupKey: string
      personPublicId: string
    }
  | { kind: "comparison"; groupKey: string; comparisonKey: string }
  | { kind: "praxis"; area: PraxisAreaKey }
```

3. In `targetMatches`, add before the final `return false`:

```ts
  if (target.kind === "praxis" && match.kind === "praxis") {
    return target.area === match.area
  }
```

4. Replace `targetGroupLabel`:

```ts
// The thing a work-layer record is anchored to, as display text. A
// person-targeted record still reads by its GROUP (the person's own name
// lives in the detail view, never denormalized here). A comparison reads by
// the job it compares AGAINST: that is the row the reader documented. A
// practice area reads by its localized title, which only the caller's
// translator can produce, so it is injected. Shared by the actions overview
// and the report assembly so the derivation cannot drift.
export function targetGroupLabel(
  target: ActionTargetWire,
  praxisAreaLabel: (area: PraxisAreaKey) => string
): string {
  if (target.kind === "praxis") return praxisAreaLabel(target.area)
  const key =
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  // A group key is roleTitle|level (ADR-0017), so the title alone names it.
  const [roleTitle] = key.split("|")
  return groupLabel({ roleTitle: roleTitle ?? null, seniority: null })
}
```

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.test.ts` add:

```ts
import { targetGroupLabel, targetMatches } from "./pay-mapping-gap-types"

describe("targetGroupLabel", () => {
  const praxisLabel = (area: string) => `Area ${area}`
  it("names a group by its role title, a comparison by the comparator, a praxis target by the injected area label", () => {
    expect(
      targetGroupLabel(
        { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
        praxisLabel
      )
    ).toBe("SWE")
    expect(
      targetGroupLabel(
        { kind: "comparison", groupKey: "Nurse|2", comparisonKey: "Support|3" },
        praxisLabel
      )
    ).toBe("Support")
    expect(
      targetGroupLabel({ kind: "praxis", area: "payPolicy" }, praxisLabel)
    ).toBe("Area payPolicy")
  })
})

describe("targetMatches", () => {
  it("matches praxis targets by area only", () => {
    expect(
      targetMatches(
        { kind: "praxis", area: "payPolicy" },
        { kind: "praxis", area: "payPolicy" }
      )
    ).toBe(true)
    expect(
      targetMatches(
        { kind: "praxis", area: "payPolicy" },
        { kind: "praxis", area: "benefits" }
      )
    ).toBe(false)
    expect(
      targetMatches(
        { kind: "praxis", area: "payPolicy" },
        { kind: "group", scope: "equalWork", groupKey: "payPolicy" }
      )
    ).toBe(false)
  })
})
```

(Merge the import into the file's existing import from `./pay-mapping-gap-types`.)

In `apps/dashboard/lib/audit-constants.ts`:

```ts
export const TARGET_KIND_VALUE_KEYS: Record<ActionTargetKind, string> = {
  group: "payMapping.actions.targetKind.group",
  person: "payMapping.actions.targetKind.person",
  comparison: "payMapping.actions.targetKind.comparison",
  praxis: "payMapping.actions.targetKind.praxis",
}
```

and in `CODED_FIELD_DOMAINS` add, after `groupLabel: PRAXIS_AREA_VALUE_KEYS,`:

```ts
  // payMapping.action* `targetLabel` when the record anchors to a practice
  // area (the raw area key); a group-targeted record's targetLabel is a role
  // title and resolves to nothing here, so it renders as written.
  targetLabel: PRAXIS_AREA_VALUE_KEYS,
```

In `packages/i18n/messages/en.json` under `dashboard.payMapping.actions.targetKind` add `"praxis": "Practice area"`. Mirror: sv `"praxis": "Praxisområde"`, nb `"praxis": "Praksisområde"`, da `"praxis": "Praksisområde"`, fi `"praxis": "Käytäntöalue"`.

- [ ] **Step 5: Adapt the consumers so the tree compiles**

`apps/dashboard/components/pay-mapping/actions-overview.tsx`:

1. Replace `targetScope`:

```ts
// Which chapter a record belongs to: the lika arbete flow, the
// women-dominated chapter, or the practice review. The overview's "type of
// comparison" filter and the deep link back into the analysis.
function targetScope(
  target: ActionTargetWire
): "equalWork" | "equivalentWork" | "praxis" {
  // A comparison only ever belongs to the women-dominated chapter: it is
  // one of the jobs a dominated group is measured against.
  if (target.kind === "comparison") return "equivalentWork"
  if (target.kind === "praxis") return "praxis"
  return target.scope
}
```

2. Replace `analysisStepHref`:

```ts
function analysisStepHref(
  analysisHref: string,
  target: ActionTargetWire
): string {
  const scope = targetScope(target)
  const segment = chapterSegment(scope)
  const key = target.kind === "praxis" ? target.area : target.groupKey
  return `${analysisHref}/${segment}?step=${scope}:${encodeURIComponent(key)}`
}
```

3. Add `const tReview = useTranslations("dashboard.payMapping.review")` next to the other translators and `const praxisAreaLabel = (area: PraxisAreaKey) => tReview(\`praxis.${area}.title\`)` (import `type PraxisAreaKey` from `@workspace/constants`). Replace every `targetGroupLabel(action.target)` / `targetGroupLabel(note.target)` with `targetGroupLabel(action.target, praxisAreaLabel)` / `targetGroupLabel(note.target, praxisAreaLabel)` (three call sites).

`apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`: in the deep-link effect, extend the `target` derivation so a praxis link opens its step:

```ts
    const target: OpenStep =
      scope === "equalWork" && gap.equalWork.some((group) => group.key === key)
        ? groupOpenStep(queue, key)
        : scope === "equivalentWork"
          ? (queue.steps.find(
              (step) =>
                step.kind === "group" &&
                step.scope === "equivalentWork" &&
                step.group.key === key
            ) ?? null)
          : scope === "praxis"
            ? (queue.steps.find(
                (step) => step.kind === "praxis" && step.area === key
              ) ?? null)
            : null
```

(`OpenStep` must already admit a praxis step: it does, `renderOpenStep` switches on `open.kind === "praxis"`.)

`apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (temporary until Task 7 rewrites this module):
- `ReportActionRow.kind` becomes `"group" | "person" | "comparison" | "praxis"` and `scope` becomes `"equalWork" | "equivalentWork" | "praxis"`; same widening on `ReportPreviousEvaluation.actions[number].kind`.
- `assemblePayMappingReport`'s input gains `praxisAreaLabel: (area: PraxisAreaKey) => string` and threads it into every `targetGroupLabel(...)` call (actions, previous actions, notes).
- `actionScope` becomes `(target) => target.kind === "comparison" ? "equivalentWork" : target.kind === "praxis" ? "praxis" : target.scope`, and the sort ranks `praxis` after `equivalentWork`: `const rank = (s) => s === "equalWork" ? 0 : s === "equivalentWork" ? 1 : 2`.

`apps/dashboard/components/pay-mapping/pay-mapping-report-doc.tsx` (temporary until Task 11c deletes it): widen `actionScopeLabel: (scope: "equalWork" | "equivalentWork" | "praxis") => string` and `targetKindLabel: (kind: "person" | "comparison" | "praxis") => string`.

`apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx` (temporary): pass `praxisAreaLabel: (area) => tReview(\`praxis.${area}.title\`)` into `assemblePayMappingReport`, and make `actionScopeLabel` return `tReview("chaptersShort.praxis")` for `"praxis"`.

`apps/dashboard/components/pay-mapping/pay-mapping-report-data.test.ts` and `pay-mapping-report-render.test.tsx`: add `praxisAreaLabel: (area) => \`Area ${area}\`` to the `assemblePayMappingReport` input.

- [ ] **Step 6: Run everything**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping`
Expected: PASS.
Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pay-mapping lib/audit-labels`
Expected: PASS (the `audit-labels` value-keys test now sees four target kinds on both sides).
Run: `cd packages/i18n && bun run test`; `bunx biome check packages/backend/convex/payMapping apps/dashboard/components/pay-mapping apps/dashboard/lib`
Expected: PASS, no diagnostics.

- [ ] **Step 7: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): let an action target a practice area with a found deficiency`

---

### Task 3: Action number

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts` (`payMappingRuns.actionCounter`, `payMappingActions.number`)
- Modify: `packages/backend/convex/payMapping/runs.ts` (`startPayMappingRun` seeds the counter)
- Modify: `packages/backend/convex/payMapping/actions.ts` (`createAction`, `listActions`, `actionShape`)
- Modify: `packages/backend/convex/payMapping/actions.test.ts`, `payMapping/erasure.test.ts`, and every backend test that inserts a `payMappingRuns` row directly (listed in Step 3)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (`PayMappingActionWire.number`)
- Modify: every dashboard file that builds a `PayMappingActionWire` literal (listed in Step 4)

**Interfaces:**
- Produces: `payMappingRuns.actionCounter: number` (required, seeded 0, monotonic); `payMappingActions.number: number` (required, `actionCounter + 1` at creation, never reused); wire `PayMappingActionWire.number: number`.

- [ ] **Step 1: Write the failing backend tests**

In `packages/backend/convex/payMapping/actions.test.ts` add:

```ts
  it("numbers actions from the run's counter, never reuses a number, and restarts at 1 in another run", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    const first = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    const second = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    let list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list.find((a) => a.actionId === first)?.number).toBe(1)
    expect(list.find((a) => a.actionId === second)?.number).toBe(2)

    // The run's counter only ever climbs: a hard-deleted action does not free
    // its number, so deleting #2 and creating again yields #3, and a number
    // printed in a document can never point at a different action later.
    await asHr.mutation(api.payMapping.actions.deleteAction, {
      orgId,
      actionId: second,
    })
    const third = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list.find((a) => a.actionId === third)?.number).toBe(3)
    const storedRun = await t.run((ctx) => ctx.db.get(runId))
    expect(storedRun?.actionCounter).toBe(3)

    // A second run starts at 1.
    const otherRunId = await t.run(async (ctx) => {
      const original = await ctx.db.get(runId)
      if (original === null) throw new Error("unreachable")
      const { _id, _creationTime, ...fields } = original
      // A fresh run starts its counter at zero, whatever the clone source
      // had counted.
      const id = await ctx.db.insert("payMappingRuns", {
        ...fields,
        slug: "other-run",
        actionCounter: 0,
      })
      const rows = await ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
        .collect()
      for (const row of rows) {
        const { _id: _rowId, _creationTime: _rowCreated, ...rowFields } = row
        await ctx.db.insert("payMappingSnapshotRows", {
          ...rowFields,
          runId: id,
        })
      }
      return id
    })
    const otherFirst = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId: otherRunId,
      ...baseAction(userId),
    })
    const otherList = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId: otherRunId,
    })
    expect(otherList.find((a) => a.actionId === otherFirst)?.number).toBe(1)
  })
```

In `packages/backend/convex/payMapping/erasure.test.ts`, find the test that asserts a person-targeted action is tombstoned (it reads the action back after `erasePersonAsOrg` and expects `erased: true`, `problem: ""`) and add to its assertions:

```ts
    // The tombstoned row keeps its number, so a number printed in a document
    // never shifts after an erasure.
    expect(personAction?.number).toBe(1)
```

(`personAction` is that test's variable for the re-read action row: `const personAction = await t.run((ctx) => ctx.db.get(personActionId))`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test -- payMapping/actions.test.ts payMapping/erasure.test.ts`
Expected: FAIL (`number` is undefined).

- [ ] **Step 3: Schema, numbering and the wire**

In `packages/backend/convex/payMapping/tables.ts`:

1. Add to `payMappingRuns` after `withPayCount: v.number(),`:

```ts
  // The run's action counter: the highest action number ever assigned in
  // this run. createAction reads it and writes number = actionCounter + 1
  // back in the same transaction, so two concurrent creates conflict rather
  // than share a number, and a number is NEVER reused: a hard delete does
  // not free it and an erasure-tombstoned row keeps it. Seeded 0 at run
  // creation; pre-launch data is reset, never backfilled.
  actionCounter: v.number(),
```

2. Add to `payMappingActions` after `target: actionTargetValidator,`:

```ts
  // The action's per-run number, from the run's actionCounter at creation.
  // Rendered as "#n" in the overview and as the action id column in both
  // report documents, so it is never reassigned.
  number: v.number(),
```

In `packages/backend/convex/payMapping/runs.ts`, `startPayMappingRun`'s `ctx.db.insert("payMappingRuns", {...})` gains `actionCounter: 0,` after `withPayCount: 0,`.

In `packages/backend/convex/payMapping/actions.ts`:
- add `number: v.number(),` to `actionShape` after `target`;
- in `listActions`' map add `number: a.number,` after `target: a.target,`;
- in `createAction`, before `const doc = {`, add

```ts
    // The counter lives on the run doc already fetched above; bumping it in
    // the same transaction is what makes the number unique and monotonic.
    const number = run.actionCounter + 1
    await ctx.db.patch(runId, { actionCounter: number })
```

  and put `number,` into `doc` right after `target: content.target,`.

Every backend test that inserts a `payMappingRuns` row directly must add `actionCounter: 0,` to the literal (after `withPayCount`): `accounts/audit.test.ts`, `assistant/insights.test.ts`, `payMapping/actions.test.ts`, `payMapping/analyses.test.ts`, `payMapping/erasure.test.ts`, `payMapping/gap.test.ts`, `payMapping/report.test.ts`, `payMapping/runs.test.ts`, `payMapping/tables.test.ts`. `payMapping/erasure.test.ts` also inserts two `payMappingActions` rows directly (the `personActionId` and `groupActionId` inserts): add `number: 1,` to the first and `number: 2,` to the second, right after their `target`, and set that run's `actionCounter: 2`. Run `cd packages/backend && bunx tsc --noEmit -p convex` to catch any other direct insert.

- [ ] **Step 4: Client wire and fixture sweep**

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts`, in `PayMappingActionWire` after `target: ActionTargetWire` add:

```ts
  // The per-run number the action is cited by ("#3"), stable for the row's
  // whole life (an erased row keeps it).
  number: number
```

Add `number: 1,` (or the literal's position in its list: 1, 2, 3 in order of appearance within one fixture) to every `PayMappingActionWire` literal in: `components/pay-mapping/documentation-controls.test.tsx`, `components/pay-mapping/pay-mapping-report-data.test.ts` (`makeAction`), `components/pay-mapping/actions-overview.test.tsx` (`action()`), `components/pay-mapping/pay-mapping-report-render.test.tsx` (two literals: 1 and 2), `components/pay-mapping/action-dialog.test.tsx` (`EXISTING`). Then run `cd apps/dashboard && bunx tsc --noEmit` and fix any literal it still reports.

- [ ] **Step 5: Run everything**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping`
Expected: PASS.
Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pay-mapping`
Expected: PASS.
Run: `bunx biome check packages/backend/convex/payMapping apps/dashboard/components/pay-mapping`

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): number actions per run`

---

### Task 4: Frozen method and system version on the run's wire

**Files:**
- Modify: `packages/backend/convex/payMapping/runs.ts` (`getPayMappingRunBySlug`)
- Modify: `packages/backend/convex/payMapping/runs.test.ts` (the `getPayMappingRunBySlug` describe)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (`PayMappingRunDetail`)
- Modify: `apps/dashboard/test/pay-mapping-fixtures.ts` (`makeRunDetail`)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (+ test), `pay-mapping-report-render.test.tsx`, `pay-mapping-report-download.test.tsx` (every `frozenCriteria` consumer)

**Interfaces:**
- Produces on the wire: `systemVersion: string` and

```ts
frozenMethod: {
  criteria: { libraryKey: string | null; name: string; dimensionKey: string | null; weightPoints: number; anchorCount: number; order: number | null }[]
  levelRules: { level: number; minScore: number }[]
  zoneProfileRules: { zone: ZoneKey; minStep: number }[]
  workingConditions: { status: "active" | "testedNotMaterial"; motivation: string } | null
  approvedAt: number | null
}
```

`frozenCriteria` is removed.

- [ ] **Step 1: Write the failing backend test**

In `packages/backend/convex/payMapping/runs.test.ts`, in `it("resolves a run and its rows by slug", ...)`, replace the block from `// The report's method section reads the frozen criteria` to the end of that `it` with:

```ts
    // The report's method chapter documents the run's own frozen method,
    // never the live model: criteria (identity, weight, anchor count,
    // order), the ladder and zone gates, the working-conditions decision
    // and the approval date. No person data: the decider's and approver's
    // user ids stay off the wire.
    const storedRun = await t.run(async (ctx) =>
      ctx.db
        .query("payMappingRuns")
        .withIndex("by_org_slug", (q) => q.eq("orgId", orgId).eq("slug", slug))
        .first()
    )
    if (storedRun === null || storedRun === undefined)
      throw new Error("unreachable")
    expect(result?.systemVersion).toBe(storedRun.systemVersion)
    const evidence = [...storedRun.frozenModel.criteria].sort(
      (a, b) =>
        (a.order ?? Number.POSITIVE_INFINITY) -
        (b.order ?? Number.POSITIVE_INFINITY)
    )
    expect(evidence.length).toBeGreaterThan(0)
    expect(result?.frozenMethod.criteria).toEqual(
      evidence.map((criterion) => ({
        libraryKey: criterion.libraryKey ?? null,
        name: criterion.name,
        dimensionKey: criterion.dimensionKey ?? null,
        weightPoints: criterion.weightPoints,
        anchorCount: criterion.anchorCount,
        order: criterion.order ?? null,
      }))
    )
    expect(result?.frozenMethod.levelRules).toEqual(
      storedRun.frozenModel.levelRules
    )
    expect(result?.frozenMethod.zoneProfileRules).toEqual(
      storedRun.frozenModel.zoneProfileRules
    )
    expect(result?.frozenMethod.workingConditions).toEqual({
      status: storedRun.frozenModel.workingConditions?.status,
      motivation: storedRun.frozenModel.workingConditions?.motivation,
    })
    expect(result?.frozenMethod.approvedAt).toBe(
      storedRun.frozenModel.approval?.approvedAt ?? null
    )
    expect(JSON.stringify(result?.frozenMethod)).not.toContain("decidedBy")
    expect(JSON.stringify(result?.frozenMethod)).not.toContain("approvedBy")
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/backend && bun run test -- payMapping/runs.test.ts -t "resolves a run"`
Expected: FAIL (`frozenMethod` undefined).

- [ ] **Step 3: The query**

In `packages/backend/convex/payMapping/runs.ts`, import `levelRuleShape, zoneProfileRuleShape` from `../evaluationModel/tables`. In `getPayMappingRunBySlug`'s `returns` object replace the `frozenCriteria` entry with:

```ts
      // The run's own system version: with the frozen approval date it is
      // the "method version" both report documents print.
      systemVersion: v.string(),
      // The frozen model's method (ADR-0008/ADR-0023): both report documents
      // document the method the run was computed under, never the live one.
      // Criteria in evidence order. No person data: the decider's and
      // approver's ids are deliberately absent.
      frozenMethod: v.object({
        criteria: v.array(
          v.object({
            libraryKey: v.union(v.string(), v.null()),
            name: v.string(),
            dimensionKey: v.union(v.string(), v.null()),
            weightPoints: v.number(),
            anchorCount: v.number(),
            order: v.union(v.number(), v.null()),
          })
        ),
        levelRules: v.array(levelRuleShape),
        zoneProfileRules: v.array(zoneProfileRuleShape),
        workingConditions: v.union(
          v.object({
            status: v.union(
              v.literal("active"),
              v.literal("testedNotMaterial")
            ),
            motivation: v.string(),
          }),
          v.null()
        ),
        approvedAt: v.union(v.number(), v.null()),
      }),
```

and in the handler replace the `frozenCriteria:` property with:

```ts
      systemVersion: run.systemVersion,
      frozenMethod: {
        criteria: [...run.frozenModel.criteria]
          .sort(
            (a, b) =>
              (a.order ?? Number.POSITIVE_INFINITY) -
              (b.order ?? Number.POSITIVE_INFINITY)
          )
          .map((criterion) => ({
            libraryKey: criterion.libraryKey ?? null,
            name: criterion.name,
            dimensionKey: criterion.dimensionKey ?? null,
            weightPoints: criterion.weightPoints,
            anchorCount: criterion.anchorCount,
            order: criterion.order ?? null,
          })),
        levelRules: run.frozenModel.levelRules ?? [],
        zoneProfileRules: run.frozenModel.zoneProfileRules ?? [],
        workingConditions:
          run.frozenModel.workingConditions === undefined
            ? null
            : {
                status: run.frozenModel.workingConditions.status,
                motivation: run.frozenModel.workingConditions.motivation,
              },
        approvedAt: run.frozenModel.approval?.approvedAt ?? null,
      },
```

- [ ] **Step 4: Client type, fixture and consumers**

In `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` add `import type { ZoneKey } from "@workspace/core"` and replace the `frozenCriteria` member of `PayMappingRunDetail`:

```ts
  // The run's system version; with frozenMethod.approvedAt it is the method
  // version both report documents print.
  systemVersion: string
  // The frozen model's method (ADR-0008): the report documents cite the
  // method the run was computed under, never the live model. Criteria in
  // evidence order. No person data.
  frozenMethod: {
    criteria: {
      libraryKey: string | null
      name: string
      dimensionKey: string | null
      weightPoints: number
      anchorCount: number
      order: number | null
    }[]
    levelRules: { level: number; minScore: number }[]
    zoneProfileRules: { zone: ZoneKey; minStep: number }[]
    workingConditions: {
      status: "active" | "testedNotMaterial"
      motivation: string
    } | null
    approvedAt: number | null
  }
```

In `apps/dashboard/test/pay-mapping-fixtures.ts` replace `frozenCriteria: [],` in `makeRunDetail` with:

```ts
    systemVersion: "v2-slice1",
    frozenMethod: {
      criteria: [],
      levelRules: [],
      zoneProfileRules: [],
      workingConditions: null,
      approvedAt: null,
    },
```

and add a builder so tests state only the criteria they need:

```ts
// A frozen criterion with the evidence fields a report cites; tests that
// only care about name and weight pass those.
export function makeFrozenCriterion(
  overrides: Partial<PayMappingRunDetail["frozenMethod"]["criteria"][number]> &
    Pick<
      PayMappingRunDetail["frozenMethod"]["criteria"][number],
      "name" | "weightPoints"
    >
): PayMappingRunDetail["frozenMethod"]["criteria"][number] {
  return {
    libraryKey: null,
    dimensionKey: null,
    anchorCount: 3,
    order: null,
    ...overrides,
  }
}
```

In `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` replace the two `run.frozenCriteria` reads with `run.frozenMethod.criteria` (the `totalWeight` reduce and the `method.criteria` map). In `pay-mapping-report-render.test.tsx`, `pay-mapping-report-data.test.ts` and `pay-mapping-report-download.test.tsx` replace every `frozenCriteria: [ { name, weightPoints } ... ]` with

```ts
      frozenMethod: {
        criteria: [
          makeFrozenCriterion({ name: "Knowledge", weightPoints: 4 }),
          makeFrozenCriterion({ name: "Responsibility", weightPoints: 2 }),
        ],
        levelRules: [],
        zoneProfileRules: [],
        workingConditions: null,
        approvedAt: null,
      },
```

(adapting the names/weights each file used; import `makeFrozenCriterion` from `@/test/pay-mapping-fixtures`). Run `cd apps/dashboard && bunx tsc --noEmit` to find any remaining `frozenCriteria` reference.

- [ ] **Step 5: Run everything**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping/runs.test.ts`; `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pay-mapping`; `bunx biome check packages/backend/convex/payMapping apps/dashboard/components/pay-mapping apps/dashboard/test`
Expected: all PASS, no diagnostics.

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): put the frozen method and system version on the run's wire`

---

### Task 5: The analysis-status helper

**Files:**
- Create: `apps/dashboard/components/pay-mapping/analysis-status.ts`
- Create: `apps/dashboard/components/pay-mapping/analysis-status.test.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.payMapping.analysisStatus.*`)

**Interfaces:**
- Produces:

```ts
export const ANALYSIS_STATUSES = ["noActionNeeded", "objectiveReason", "actionDecided", "furtherAnalysis"] as const
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]
export interface AnalysisStatusInput { required: boolean; done: boolean; reasons: readonly PayGapReason[]; note: string | null; hasAction: boolean }
export function analysisStatus(input: AnalysisStatusInput): AnalysisStatus
export function equalWorkGroupStatus(group: Pick<GapGroup, "key" | "flag">, analyses: readonly GroupAnalysis[], actions: readonly PayMappingActionWire[]): AnalysisStatus
export function comparisonStatus(group: Pick<WomenDominatedGroupWire, "key">, comparisonKey: string, analyses: readonly GroupAnalysis[], actions: readonly PayMappingActionWire[]): AnalysisStatus
export function womenDominatedGroupStatus(group: Pick<WomenDominatedGroupWire, "key" | "comparisons">, analyses: readonly GroupAnalysis[], actions: readonly PayMappingActionWire[]): AnalysisStatus
export function countByStatus(statuses: readonly AnalysisStatus[]): Record<AnalysisStatus, number>
```

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/components/pay-mapping/analysis-status.test.ts`:

```ts
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"
import {
  ANALYSIS_STATUSES,
  type AnalysisStatus,
  analysisStatus,
  comparisonStatus,
  countByStatus,
  equalWorkGroupStatus,
  womenDominatedGroupStatus,
} from "./analysis-status"
import type {
  GroupAnalysis,
  PayMappingActionWire,
} from "./pay-mapping-gap-types"

function makeAction(
  target: PayMappingActionWire["target"],
  erased = false
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    number: 1,
    target,
    problem: erased ? "" : "Gap",
    plannedAction: erased ? "" : "Review",
    reason: null,
    ownerUserId: "u1",
    ownerName: "HR",
    plannedDate: 1,
    estimatedCost: null,
    estimatedCostUnit: null,
    priority: "medium",
    status: "notStarted",
    erased,
    createdAt: 1,
  }
}

// The rule, restated independently of the implementation: an action wins,
// then no duty, then a done and documented row, else open.
function expected(input: {
  required: boolean
  done: boolean
  reasons: boolean
  note: boolean
  action: boolean
}): AnalysisStatus {
  if (input.action) return "actionDecided"
  if (!input.required) return "noActionNeeded"
  if (input.done && (input.reasons || input.note)) return "objectiveReason"
  return "furtherAnalysis"
}

describe("analysisStatus", () => {
  it("derives every combination of required, done, reasons, note and action", () => {
    const flags = [false, true]
    for (const required of flags) {
      for (const done of flags) {
        for (const reasons of flags) {
          for (const note of flags) {
            for (const action of flags) {
              const status = analysisStatus({
                required,
                done,
                reasons: reasons ? ["experience"] : [],
                note: note ? "Looked into it" : null,
                hasAction: action,
              })
              expect(
                status,
                JSON.stringify({ required, done, reasons, note, action })
              ).toBe(expected({ required, done, reasons, note, action }))
            }
          }
        }
      }
    }
  })

  it("treats a whitespace-only note as no note", () => {
    expect(
      analysisStatus({
        required: true,
        done: true,
        reasons: [],
        note: "   ",
        hasAction: false,
      })
    ).toBe("furtherAnalysis")
  })
})

describe("the wire adapters", () => {
  const analyses: GroupAnalysis[] = [
    {
      scope: "equalWork",
      groupKey: "SWE|3",
      comparisonKey: null,
      reasons: ["experience"],
      note: null,
      done: true,
      finding: null,
    },
    {
      scope: "equivalentWork",
      groupKey: "Nurse|2",
      comparisonKey: null,
      reasons: [],
      note: null,
      done: true,
      finding: null,
    },
    {
      scope: "equivalentWork",
      groupKey: "Nurse|2",
      comparisonKey: "Support|3",
      reasons: ["historicalPay"],
      note: null,
      done: false,
      finding: null,
    },
  ]

  it("reads an equal-work group's duty from its flag and its documentation from its own row", () => {
    expect(
      equalWorkGroupStatus(
        makeGapGroup({ key: "SWE|3", flag: "elevated" }),
        analyses,
        []
      )
    ).toBe("objectiveReason")
    expect(
      equalWorkGroupStatus(makeGapGroup({ key: "QA|4", flag: "ok" }), [], [])
    ).toBe("noActionNeeded")
    expect(
      equalWorkGroupStatus(
        makeGapGroup({ key: "QA|4", flag: "critical" }),
        [],
        []
      )
    ).toBe("furtherAnalysis")
  })

  it("lets a non-erased action on the group, a member, or the comparison win, and ignores an erased one", () => {
    const group = makeGapGroup({ key: "SWE|3", flag: "elevated" })
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction({ kind: "group", scope: "equalWork", groupKey: "SWE|3" }),
      ])
    ).toBe("actionDecided")
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction({
          kind: "person",
          scope: "equalWork",
          groupKey: "SWE|3",
          personPublicId: "p1",
        }),
      ])
    ).toBe("actionDecided")
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction(
          { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          true
        ),
      ])
    ).toBe("objectiveReason")
    expect(
      comparisonStatus({ key: "Nurse|2" }, "Support|3", analyses, [
        makeAction({
          kind: "comparison",
          groupKey: "Nurse|2",
          comparisonKey: "Support|3",
        }),
      ])
    ).toBe("actionDecided")
  })

  it("reads a comparison's done state from the group's own row and its reasons from the comparison row", () => {
    expect(
      comparisonStatus({ key: "Nurse|2" }, "Support|3", analyses, [])
    ).toBe("objectiveReason")
    expect(
      comparisonStatus({ key: "Nurse|2" }, "Clerk|3", analyses, [])
    ).toBe("furtherAnalysis")
  })

  it("gives a women-dominated group with no comparisons no duty", () => {
    expect(
      womenDominatedGroupStatus(
        { key: "Nurse|2", comparisons: [] },
        analyses,
        []
      )
    ).toBe("noActionNeeded")
  })

  it("counts every status, zero included", () => {
    expect(countByStatus(["actionDecided", "actionDecided"])).toEqual({
      noActionNeeded: 0,
      objectiveReason: 0,
      actionDecided: 2,
      furtherAnalysis: 0,
    })
    expect(Object.keys(countByStatus([])).sort()).toEqual(
      [...ANALYSIS_STATUSES].sort()
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bun run test -- analysis-status`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

Create `apps/dashboard/components/pay-mapping/analysis-status.ts`:

```ts
// One status per equal-work group and per equivalent-work comparison,
// derived from the frozen gap, the documentation rows and the actions.
// Never stored: both report documents and, later, the overview redesign
// read it from here so the four words can never mean different things on
// two surfaces. Pure: no React, no Convex, no clock.
import type { PayGapReason } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingActionWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"

export const ANALYSIS_STATUSES = [
  "noActionNeeded",
  "objectiveReason",
  "actionDecided",
  "furtherAnalysis",
] as const

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]

export interface AnalysisStatusInput {
  // Whether the row carries a documentation duty (a flagged equal-work
  // group; every comparison; a women-dominated group with comparisons).
  required: boolean
  done: boolean
  reasons: readonly PayGapReason[]
  note: string | null
  // At least one non-erased action targets the row.
  hasAction: boolean
}

// Precedence: a decided action is the strongest statement about a
// difference, whatever the documentation says; a row with no duty needs
// nothing; a done row explained by a reason or a written assessment is
// closed; everything else is still open.
export function analysisStatus(input: AnalysisStatusInput): AnalysisStatus {
  if (input.hasAction) return "actionDecided"
  if (!input.required) return "noActionNeeded"
  const documented =
    input.reasons.length > 0 ||
    (input.note !== null && input.note.trim() !== "")
  if (input.done && documented) return "objectiveReason"
  return "furtherAnalysis"
}

function liveActions(
  actions: readonly PayMappingActionWire[]
): PayMappingActionWire[] {
  return actions.filter((action) => !action.erased)
}

// The group's own documentation row (comparisonKey null).
function ownRow(
  analyses: readonly GroupAnalysis[],
  scope: "equalWork" | "equivalentWork",
  groupKey: string
): GroupAnalysis | undefined {
  return analyses.find(
    (row) =>
      row.scope === scope &&
      row.groupKey === groupKey &&
      row.comparisonKey === null
  )
}

export function equalWorkGroupStatus(
  group: Pick<GapGroup, "key" | "flag">,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const row = ownRow(analyses, "equalWork", group.key)
  // A group-targeted or a member-targeted action both answer the group's
  // difference.
  const hasAction = liveActions(actions).some(
    (action) =>
      (action.target.kind === "group" || action.target.kind === "person") &&
      action.target.scope === "equalWork" &&
      action.target.groupKey === group.key
  )
  return analysisStatus({
    required: equalWorkGroupRequiresDocumentation(group.flag),
    done: row?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

// A comparison is always a difference to assess (DL 3 kap. 9 §): its duty
// is unconditional, its done state is the group's own klarmarkering, and
// its reasons live on its own row.
export function comparisonStatus(
  group: Pick<WomenDominatedGroupWire, "key">,
  comparisonKey: string,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const own = ownRow(analyses, "equivalentWork", group.key)
  const row = analyses.find(
    (candidate) =>
      candidate.scope === "equivalentWork" &&
      candidate.groupKey === group.key &&
      candidate.comparisonKey === comparisonKey
  )
  const hasAction = liveActions(actions).some(
    (action) =>
      action.target.kind === "comparison" &&
      action.target.groupKey === group.key &&
      action.target.comparisonKey === comparisonKey
  )
  return analysisStatus({
    required: true,
    done: own?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

// The women-dominated group as a whole: no comparisons, no duty; otherwise
// its own row's state, with a group- or member-targeted action winning.
export function womenDominatedGroupStatus(
  group: Pick<WomenDominatedGroupWire, "key" | "comparisons">,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const row = ownRow(analyses, "equivalentWork", group.key)
  const hasAction = liveActions(actions).some(
    (action) =>
      (action.target.kind === "group" || action.target.kind === "person") &&
      action.target.scope === "equivalentWork" &&
      action.target.groupKey === group.key
  )
  return analysisStatus({
    required: womenDominatedGroupRequiresDocumentation(
      group.comparisons.length
    ),
    done: row?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

export function countByStatus(
  statuses: readonly AnalysisStatus[]
): Record<AnalysisStatus, number> {
  const counts = Object.fromEntries(
    ANALYSIS_STATUSES.map((status) => [status, 0])
  ) as Record<AnalysisStatus, number>
  for (const status of statuses) counts[status] += 1
  return counts
}
```

- [ ] **Step 4: The status labels in every locale**

In `packages/i18n/messages/en.json`, inside `dashboard.payMapping` (after the `actionsOverview` block), add:

```json
    "analysisStatus": {
      "noActionNeeded": "No action needed",
      "objectiveReason": "Objective reason documented",
      "actionDecided": "Action decided",
      "furtherAnalysis": "Further analysis"
    },
```

sv:

```json
    "analysisStatus": {
      "noActionNeeded": "Ingen åtgärd behövs",
      "objectiveReason": "Sakligt skäl dokumenterat",
      "actionDecided": "Åtgärd beslutad",
      "furtherAnalysis": "Fortsatt analys"
    },
```

nb:

```json
    "analysisStatus": {
      "noActionNeeded": "Ingen tiltak nødvendig",
      "objectiveReason": "Saklig grunn dokumentert",
      "actionDecided": "Tiltak besluttet",
      "furtherAnalysis": "Videre analyse"
    },
```

da:

```json
    "analysisStatus": {
      "noActionNeeded": "Intet tiltag nødvendigt",
      "objectiveReason": "Saglig grund dokumenteret",
      "actionDecided": "Tiltag besluttet",
      "furtherAnalysis": "Videre analyse"
    },
```

fi:

```json
    "analysisStatus": {
      "noActionNeeded": "Toimenpidettä ei tarvita",
      "objectiveReason": "Asiallinen peruste dokumentoitu",
      "actionDecided": "Toimenpide päätetty",
      "furtherAnalysis": "Jatkoanalyysi"
    },
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/dashboard && bun run test -- analysis-status && bunx tsc --noEmit`; `cd packages/i18n && bun run test`; `bunx biome check apps/dashboard/components/pay-mapping/analysis-status.ts apps/dashboard/components/pay-mapping/analysis-status.test.ts`
Expected: PASS, no diagnostics.

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): derive one analysis status per group and comparison`

---

### Task 6: Shared PDF primitives in the kit

**Files:**
- Create: `apps/dashboard/components/pdf/pdf-table.tsx`
- Create: `apps/dashboard/components/pdf/identity-block.tsx`
- Create: `apps/dashboard/components/pdf/signature-block.tsx`
- Create: `apps/dashboard/components/pdf/pdf-primitives-render.test.tsx`

This task touches nothing under `components/pay-mapping/`: `pay-mapping-report-data.ts` is engine-agnostic (ADR-0026) and never imports the kit; the retired report's own `computeHeaderBreaks(doc, rowPages)` stays there until Task 11c deletes it.

**Interfaces:**
- Produces (`pdf-table.tsx`): `tableStyles` (the `StyleSheet` the old report doc kept as `s`), `PdfStyle`, `BREAKABLE_ROW_TEXT_LENGTH`, `RowPaginationProps`, `CapturedText`, `TocRow`, `cellText(value, dash)`, `computeHeaderBreaks(tables, rowPages)`.
- Produces (`identity-block.tsx`): `IdentityLabels`, `IdentityBlock`.
- Produces (`signature-block.tsx`): `SignatureLabels`, `SignatureBlock`.

- [ ] **Step 1: Write the failing render test**

Create `apps/dashboard/components/pdf/pdf-primitives-render.test.tsx`:

```tsx
import { pdf, Text, View } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import { IdentityBlock } from "@/components/pdf/identity-block"
import {
  CapturedText,
  computeHeaderBreaks,
  tableStyles as s,
  TocRow,
} from "@/components/pdf/pdf-table"
import { SignatureBlock } from "@/components/pdf/signature-block"

const IDENTITY = {
  docTitle: "Signing report",
  organizationName: "Acme AB",
  runLabel: "Pay mapping 2026",
  referenceDateLine: "Reference date 1 Jul 2026",
  extractedAtLine: "Data extracted 1 Jul 2026, 09:12",
  methodVersionLine: "Method version v2-slice1, model approved 12 Jun 2026",
  generatedOn: "Generated on 3 Sep 2026",
  statusTag: "DRAFT",
}

describe("pdf primitives (real render)", () => {
  it("renders the identity block, a table with captured rows, a TOC row and the signature block", async () => {
    const rowPages: Record<string, number> = {}
    const blob = await pdf(
      <BrandedDocument>
        <BrandedPage footerLeft="Footer">
          <IdentityBlock
            labels={IDENTITY}
            classification="Internal document. Every download is logged."
          />
          <TocRow number="1" label="Formalities" page={2} />
          <Section title="Table" number="1">
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]}>Group</Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>Value</Text>
            </View>
            <View style={s.row}>
              <CapturedText
                style={[s.cellGroup, s.tableText]}
                id="t:row1"
                onRowPage={(id, page) => {
                  rowPages[id] = page
                }}
                text="Row 1"
              />
              <Text style={[s.cellNum, s.tableText]}>42</Text>
            </View>
          </Section>
          <SignatureBlock
            columns={["For the employer", "For the union party"]}
            labels={{
              name: "Name",
              signature: "Signature",
              place: "Place",
              date: "Date",
            }}
          />
        </BrandedPage>
      </BrandedDocument>
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
    expect(rowPages["t:row1"]).toBe(1)
  })
})

describe("computeHeaderBreaks", () => {
  it("marks rows that start a later page, never a table's first row, and skips unreported rows", () => {
    const tables = [
      ["a:1", "a:2", "a:3"],
      ["b:1", "b:2"],
    ]
    const breaks = computeHeaderBreaks(tables, {
      "a:1": 2,
      "a:2": 2,
      "a:3": 3,
      "b:1": 3,
      "b:2": 4,
    })
    expect([...breaks].sort()).toEqual(["a:3", "b:2"])
    expect([...computeHeaderBreaks(tables, { "a:1": 2, "a:3": 3 })]).toEqual([
      "a:3",
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bun run test -- pdf-primitives`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create the three modules**

Create `apps/dashboard/components/pdf/pdf-table.tsx`:

```tsx
import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ComponentProps } from "react"
import { BRAND } from "./branded-document"

// The kit's table vocabulary, shared by every document that prints a table
// (the two pay-mapping documents, the method appendix's criteria table).
// Rows follow the flex-row pattern; lineHeight stays off table rows (the
// fixed-footer landmine, see branded-document.tsx).

// A row whose free text reaches this length may exceed a full page as one
// block, and react-pdf draws an oversized wrap={false} block off the page
// edge with only a console warning: the overflow is silently lost from the
// document (measured at roughly 2,100 characters on an action row's
// geometry). Rows under the bound stay atomic; longer ones give up
// unbreakability so every word stays on a page.
export const BREAKABLE_ROW_TEXT_LENGTH = 600

// View's style type, not Text's: the Text typing unions in the SVG text
// variant's attributes, which the plain Text overload then rejects.
export type PdfStyle = ComponentProps<typeof View>["style"]

export const tableStyles = StyleSheet.create({
  para: { marginBottom: 4, lineHeight: 1.4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingVertical: 3,
  },
  label: { fontFamily: "Helvetica-Bold" },
  cellGroup: { flex: 2.4 },
  cellNum: { flex: 0.9, textAlign: "right", paddingLeft: 4 },
  // Wide enough for the "Women"/"Men" headers at font 9; narrower and the
  // three count headers fuse into one word.
  cellCount: { flex: 0.72, textAlign: "right", paddingLeft: 2 },
  cellMoney: { flex: 1.3, textAlign: "right", paddingLeft: 4 },
  cellSpread: { flex: 1.7, textAlign: "right", paddingLeft: 6 },
  cellStatus: { flex: 0.95, textAlign: "right", paddingLeft: 4 },
  cellWide: { flex: 3 },
  tableText: { fontSize: 9 },
  // The median line under a mean cell: same figure family, visually
  // subordinate so the mean stays the row's first read.
  medianText: { fontSize: 8, color: "#555" },
  // The documentation block under a table row: the row's reasons, note and
  // cited actions, indented so it reads as belonging to the row above.
  docBlock: {
    paddingLeft: 10,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  docText: { fontSize: 9, color: "#333", lineHeight: 1.4 },
  docLabel: { fontFamily: "Helvetica-Bold", color: "#111" },
  // Heading scale under the 16pt chapter title (branded-document): 12pt
  // subheadings, 10pt group headings, a clear step per level against the
  // 9-10pt body, with more space before a heading than after it.
  subHeading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 6,
  },
  groupHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 2,
  },
  // A table's band heading (the action table's chapter bands): the app's
  // rounded muted band, not a bare rule.
  band: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 14,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  note: { fontSize: 9, color: "#555", marginTop: 4, lineHeight: 1.4 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
    color: "#111",
  },
  fieldValue: { fontSize: 10, color: "#333", lineHeight: 1.4, marginBottom: 8 },
  // A bordered status box (the signing summary's four boxes): a titled
  // card holding label/value lines.
  box: {
    borderWidth: 0.5,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    width: "48%",
  },
  boxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  boxTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  boxRow: { flexDirection: "row", justifyContent: "space-between" },
  chartBlock: { marginTop: 12, marginBottom: 10 },
  contents: { marginTop: 28 },
  contentsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tocRow: { flexDirection: "row", marginBottom: 4 },
  // A fixed number column keeps the TOC titles left-aligned with each other.
  tocNumber: { fontSize: 11, color: BRAND, width: 18 },
  tocLabel: { fontSize: 11, flex: 1 },
  tocPage: { fontSize: 10, color: "#555" },
})

// A masked or absent figure renders the caller's dash.
export function cellText(value: string | null, dash: string): string {
  return value ?? dash
}

// The multi-pass pagination hooks: rows report where they landed (pass N),
// and the export loop answers with the rows that start a new page so their
// table's header re-renders above them (pass N+1).
export interface RowPaginationProps {
  onRowPage?: (id: string, page: number) => void
  headerBreaks?: ReadonlySet<string>
}

// A table cell text that reports its page for the continuation-header
// passes when a capture callback is wired, and renders as plain text
// otherwise. The render prop must be ABSENT (not undefined) on the plain
// path: react-pdf treats any node carrying the prop as dynamic and calls it.
export function CapturedText({
  style,
  id,
  onRowPage,
  text,
}: {
  style: PdfStyle
  id: string
  onRowPage?: (id: string, page: number) => void
  text: string
}) {
  if (!onRowPage) return <Text style={style}>{text}</Text>
  return (
    <Text
      style={style}
      render={({ pageNumber }) => {
        onRowPage(id, pageNumber)
        return text
      }}
    />
  )
}

export function TocRow({
  number,
  label,
  page,
}: {
  number: string
  label: string
  page: number | undefined
}) {
  return (
    <View style={tableStyles.tocRow}>
      <Text style={tableStyles.tocNumber}>{number}</Text>
      <Text style={tableStyles.tocLabel}>{label}</Text>
      {page !== undefined && <Text style={tableStyles.tocPage}>{page}</Text>}
    </View>
  )
}

// The continuation-header derivation for the multi-pass render: given the
// row ids of every table in document order and where each row landed
// (captured by CapturedText's onRowPage), the rows that START a new page
// within their table get their table's header re-rendered above them. A
// table's first row never does; a row with no reported page is skipped.
// Pure over (tables, rowPages) so an export loop can iterate to a fixed
// point and tests can pin the derivation.
export function computeHeaderBreaks(
  tables: readonly (readonly string[])[],
  rowPages: Record<string, number>
): Set<string> {
  const breaks = new Set<string>()
  for (const ids of tables) {
    let previousPage: number | undefined
    for (const id of ids) {
      const page = rowPages[id]
      if (page === undefined) continue
      if (previousPage !== undefined && page > previousPage) breaks.add(id)
      previousPage = page
    }
  }
  return breaks
}
```

Create `apps/dashboard/components/pdf/identity-block.tsx`:

```tsx
import { Text } from "@react-pdf/renderer"
import { Cover } from "./branded-document"
import { tableStyles } from "./pdf-table"

// The identity block both pay-mapping documents open with (ADR-0030): the
// organization, the run, the reference date, the data extraction instant,
// the method version, the status tag and the generation timestamp. Every
// line arrives resolved (the kit is i18n-free); the block only lays them
// out on the Cover. The detail appendix adds its classification line.
export interface IdentityLabels {
  docTitle: string
  organizationName: string
  runLabel: string
  referenceDateLine: string
  extractedAtLine: string
  methodVersionLine: string
  generatedOn: string
  statusTag: string
}

export function IdentityBlock({
  labels,
  classification,
}: {
  labels: IdentityLabels
  classification?: string
}) {
  return (
    <>
      <Cover
        docTitle={labels.docTitle}
        metaLines={[
          labels.organizationName,
          labels.runLabel,
          labels.referenceDateLine,
          labels.extractedAtLine,
          labels.methodVersionLine,
          labels.generatedOn,
        ]}
        statusTag={labels.statusTag}
      />
      {classification !== undefined && (
        <Text style={tableStyles.para}>{classification}</Text>
      )}
    </>
  )
}
```

Create `apps/dashboard/components/pdf/signature-block.tsx`:

```tsx
import { StyleSheet, Text, View } from "@react-pdf/renderer"

// The signing report's signature block: one column per signing party, each
// with a labeled line for name, signature, place and date. Lines are ruled
// blanks (the document is signed on paper; there is no in-app signing).
export interface SignatureLabels {
  name: string
  signature: string
  place: string
  date: string
}

const s = StyleSheet.create({
  block: { flexDirection: "row", gap: 24, marginTop: 28 },
  column: { flex: 1 },
  columnTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  line: { marginBottom: 16 },
  lineLabel: { fontSize: 8, color: "#555", marginBottom: 14 },
  rule: { borderBottomWidth: 0.5, borderBottomColor: "#111" },
})

export function SignatureBlock({
  columns,
  labels,
}: {
  columns: readonly string[]
  labels: SignatureLabels
}) {
  const lines = [labels.name, labels.signature, labels.place, labels.date]
  return (
    <View style={s.block} wrap={false}>
      {columns.map((title) => (
        <View key={title} style={s.column}>
          <Text style={s.columnTitle}>{title}</Text>
          {lines.map((line) => (
            <View key={line} style={s.line}>
              <Text style={s.lineLabel}>{line}</Text>
              <View style={s.rule} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pdf-primitives`; `bunx biome check apps/dashboard/components/pdf`
Expected: PASS, no diagnostics. The retired report and its `computeHeaderBreaks(doc, rowPages)` in `pay-mapping-report-data.ts` are untouched.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pdf): lift table, identity and signature primitives into the kit`

---

### Task 7: The assembly becomes unmasked and carries what both documents need

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx` (the formatters object only)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-render.test.tsx` (formatters only)

**Interfaces:**
- Consumes: `analysis-status.ts` (Task 5), the wire shapes from Tasks 1-4.
- Produces: `ReportFormatters.dateTime`; `ReportLinkedAction`; `ReportGroupRow.status/actions`; `ReportComparisonRow.status/actions`; `ReportWomenDominatedGroup.actions`; `ReportActionRow.number/plannedDateMs/costAmount/costUnit`; `ReportPraxisRow.action`; `PayMappingReportDoc.identity`, `.collaboration.date`, `.population.womenPriced/menPriced`, `.method.{dimensionShares, levelRules, zoneProfileRules, workingConditions, approvedAt}`, `.method.criteria[].dimensionKey`; an assembly that never nulls a value for size (the `masked` flags and `maskedGroupCount` stay). The fields the retired documentation PDF still consumes (`spread`, `chartData`, `orgPrevious`, `summary.variable*`, `equivalentWorkLevels`, the signed mode) remain until Task 17 deletes them; from this task on they are unmasked too. This task opens the staged chain (Tasks 7 through 11c, see Global Constraints).

- [ ] **Step 1: Rewrite the masking tests as flag tests and add the new-field tests**

In `apps/dashboard/components/pay-mapping/pay-mapping-report-data.test.ts`:

1. Replace the test `keeps figures for compliant groups and masks small cells` with:

```ts
  it("keeps every group's figures and only FLAGS the export-threshold rows", () => {
    const doc = assemble({ withPrevious: true })
    const [swe, qa] = doc.equalWork
    expect(swe?.masked).toBe(false)
    expect(swe?.tcc.womenMean).toBe("M90000")
    expect(swe?.tcc.gapPct).toBe("P10")
    expect(swe?.reasons).toEqual(["experience", "performance"])
    expect(swe?.done).toBe(true)
    // 1 woman / 3 men: flagged for the signing projection, but the figures
    // are all there (the appendix prints them; masking is the projection's
    // business, never the assembly's).
    expect(qa?.masked).toBe(true)
    expect(qa?.tcc.womenMean).toBe("M90000")
    expect(qa?.tcc.gapPct).toBe("P10")
    expect(qa?.base.womenMean).toBe("M90000")
    expect(doc.method.maskedGroupCount).toBe(3)
  })
```

2. Replace the test `masks whole-group means by total headcount in the women-dominated comparison` with:

```ts
  it("keeps whole-group means in the women-dominated comparison and flags by total headcount", () => {
    const doc = assemble({ withPrevious: true })
    const [nurse, clerk] = doc.womenDominated
    expect(nurse?.masked).toBe(false)
    expect(nurse?.meanComp).toBe("M40000")
    expect(nurse?.comparisons[0]?.diffKr).toBe("M5000")
    expect(nurse?.comparisons[0]?.reasons).toEqual(["historicalPay"])
    expect(clerk?.masked).toBe(true)
    // The clerk fixture overrides only key, title, level and headcount, so
    // its mean is makeWomenDominated's default.
    expect(clerk?.meanComp).toBe("M40000")
    expect(clerk?.comparisons[0]?.masked).toBe(true)
    expect(clerk?.comparisons[0]?.diffKr).toBe("M5000")
  })
```

3. Replace the test `carries medians, year-over-year figures, spread and the excluded lists` with:

```ts
  it("carries medians, year-over-year figures, spread and the excluded lists, unmasked", () => {
    const doc = assemble({ withPrevious: true })
    const swe = doc.equalWork[0]
    // Median computed from the frozen rows through the shared engine stats,
    // on total compensation: one priced woman at 45000 + 5000 bonus, no
    // priced man.
    expect(swe?.tccMedian.women).toBe("M50000")
    expect(swe?.tccMedian.men).toBeNull()
    // The previous run had the same group at a 12% mean gap.
    expect(swe?.previousGapPct).toBe("P12")
    // The previous run's Dev group was 1W/1M: the assembly carries its gap
    // anyway (the signing projection decides what leaves).
    const dev = doc.equalWork[2]
    expect(dev?.masked).toBe(false)
    expect(dev?.previousGapPct).toBe("P25")
    // A flagged row keeps its medians; absent figures are null for absence,
    // never for size (QA has no priced rows in this fixture, and no previous
    // group).
    const qa = doc.equalWork[1]
    expect(qa?.masked).toBe(true)
    expect(qa?.tccMedian.women).toBeNull()
    expect(qa?.previousGapPct).toBeNull()
    // Org-level year-over-year line from the previous gap aggregate.
    expect(doc.orgPrevious).toEqual({
      runLabel: "Pay mapping 2025",
      referenceDate: "D500",
      gapPct: "P10",
    })
    // The org median over one priced woman is her total compensation; no
    // priced men, so no men's median and no median gap.
    expect(doc.org.womenMedian).toBe("M50000")
    expect(doc.org.menMedian).toBeNull()
    expect(doc.org.medianGapPct).toBeNull()
    // The excluded groups are listed by identity, not only counted.
    expect(doc.reverseGroups.map((group) => group.key)).toEqual(["UX|2"])
    expect(doc.genderPureGroups).toEqual([
      {
        key: "Lead|1",
        label: "Lead",
        level: 1,
        gender: "Man",
        count: 3,
      },
    ])
    expect(doc.method.singletonCount).toBe(2)
  })
```

4. In the test `assembles the statutory sections: praxis, samverkan, actions, evaluation`, replace the `doc.collaboration` and `doc.population` assertions with:

```ts
    expect(doc.collaboration).toEqual({
      participants: "Union rep",
      description: "Monthly",
      date: null,
    })
    ...
    expect(doc.population).toEqual({
      total: 6,
      women: 3,
      men: 3,
      priced: 1,
      womenPriced: 1,
      menPriced: 0,
    })
```

5. Delete the test `derives the method section from the frozen criteria` (its content is covered below) and add these tests inside `describe("assemblePayMappingReport", ...)`:

```ts
  it("derives a status and the linked actions for every group and comparison", () => {
    const doc = assemble({ withPrevious: true })
    const [swe, qa] = doc.equalWork
    // SWE: done with reasons, but two actions (one on the group, one on a
    // member) target it, so the action wins and both are cited.
    expect(swe?.status).toBe("actionDecided")
    expect(swe?.actions).toEqual([
      { number: 1, ownerName: "HR Person", plannedDate: "D1000" },
      { number: 2, ownerName: "HR Person", plannedDate: "D1000" },
    ])
    // QA: flagged, nothing documented, no action.
    expect(qa?.status).toBe("furtherAnalysis")
    expect(qa?.actions).toEqual([])
    // The reverse list and the per-level table carry no duty.
    expect(doc.reverseGroups[0]?.status).toBe("noActionNeeded")
    expect(doc.equivalentWorkLevels[0]?.status).toBe("noActionNeeded")
    const [nurse] = doc.womenDominated
    expect(nurse?.actions).toEqual([])
    expect(nurse?.comparisons[0]?.status).toBe("objectiveReason")
    expect(nurse?.comparisons[0]?.actions).toEqual([])
  })

  it("joins a praxis action to its area and carries the collaboration date", () => {
    const doc = assemble({
      withPrevious: false,
      extraActions: [
        makeAction({
          actionId: "a9" as PayMappingActionWire["actionId"],
          number: 9,
          target: { kind: "praxis", area: "payPolicy" },
          plannedAction: "Rewrite the pay policy",
          plannedDate: 5000,
        }),
      ],
      collaborationDate: 7000,
    })
    expect(doc.praxis[0]?.action).toEqual({
      number: 9,
      plannedAction: "Rewrite the pay policy",
      plannedDate: "D5000",
    })
    expect(doc.praxis[1]?.action).toBeNull()
    expect(doc.collaboration?.date).toBe("D7000")
    const praxisRow = doc.actions.find((a) => a.kind === "praxis")
    expect(praxisRow?.scope).toBe("praxis")
    expect(praxisRow?.label).toBe("Area payPolicy")
    expect(praxisRow?.number).toBe(9)
    expect(praxisRow?.plannedDateMs).toBe(5000)
  })

  it("carries the identity block's raw parts and the frozen method in full", () => {
    const doc = assemble({ withPrevious: false })
    expect(doc.previousEvaluation).toBeNull()
    expect(doc.method.pointBudget).toBe(6)
    expect(doc.identity).toEqual({
      systemVersion: "v2-slice1",
      approvedAt: "D1700000000000",
      referenceDate: `D${Date.UTC(2026, 6, 1)}`,
      extractedAt: `T${Date.UTC(2026, 6, 1)}`,
    })
    expect(doc.method.criteria).toEqual([
      {
        name: "Knowledge",
        dimensionKey: "competence",
        weightPoints: 4,
        sharePct: "P66.66666666666666",
      },
      {
        name: "Responsibility",
        dimensionKey: "responsibility",
        weightPoints: 2,
        sharePct: "P33.33333333333333",
      },
    ])
    expect(doc.method.dimensionShares).toEqual([
      { dimensionKey: "competence", sharePct: "P66.66666666666666" },
      { dimensionKey: "responsibility", sharePct: "P33.33333333333333" },
    ])
    expect(doc.method.levelRules).toEqual([{ level: 1, minScore: 90 }])
    expect(doc.method.zoneProfileRules).toEqual([{ zone: "A", minStep: 4 }])
    expect(doc.method.workingConditions).toEqual({
      status: "testedNotMaterial",
      motivation: "Tested",
    })
    expect(doc.method.approvedAt).toBe("D1700000000000")
    expect(doc.population.womenPriced).toBe(1)
    expect(doc.population.menPriced).toBe(0)
  })

  it("carries raw cost parts on every action row and one roll-up per scope", () => {
    const doc = assemble({})
    const group = doc.actions.find((a) => a.kind === "group")
    expect(group?.costAmount).toBe(42000)
    expect(group?.costUnit).toBe("oneOff")
    expect(group?.plannedDateMs).toBe(1000)
    expect(doc.actionCostByScope).toEqual({
      equalWork: "M42000",
      equivalentWork: null,
      praxis: null,
    })
    expect(doc.actionTotals.cost).toBe("M42000")
  })
```

6. Update the file's `assemble` helper, `makeAction` and the `formatters` constant:
   - `formatters` gains `dateTime: (epochMs) => \`T${epochMs}\``.
   - `makeAction`'s default target becomes `{ kind: "group", scope: "equalWork", groupKey: "SWE|3|Senior" }` and the fixture's person action's `groupKey` becomes `"SWE|3|Senior"` too (the fixture's SWE group key), so the actions actually link to the group; `makeAction` gets `number: 1` and the person action `number: 2`.
   - `assemble` takes two new optional options `extraActions?: PayMappingActionWire[]` (appended to the fixture's action list) and `collaborationDate?: number` (passed as `date` on the run's collaboration; `date: null` otherwise), and the run fixture's `frozenMethod` becomes:

```ts
      frozenMethod: {
        criteria: [
          makeFrozenCriterion({
            name: "Knowledge",
            weightPoints: 4,
            dimensionKey: "competence",
          }),
          makeFrozenCriterion({
            name: "Responsibility",
            weightPoints: 2,
            dimensionKey: "responsibility",
          }),
        ],
        levelRules: [{ level: 1, minScore: 90 }],
        zoneProfileRules: [{ zone: "A", minStep: 4 }],
        workingConditions: { status: "testedNotMaterial", motivation: "Tested" },
        approvedAt: 1_700_000_000_000,
      },
```

   (`zone: "A"`: use the first member of `ZONE_KEYS` from `@workspace/core`; read `packages/core` for the literal if it differs, and use the same literal in the assertion.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- pay-mapping-report-data`
Expected: FAIL (missing fields, masked nulls).

- [ ] **Step 3: Edit `pay-mapping-report-data.ts`**

Apply these edits in order.

(a) Replace the module header comment (the first two paragraphs) with:

```ts
// Assembly of the pay-mapping report content: a pure mapping from the run's
// frozen data + work layer to the typed doc both PDF documents project
// from. Everything display-formatted is formatted HERE through injected
// formatters (locale-aware money/percent/date), so the templates stay
// layout-only and this step is unit-testable with identity formatters.
// Engine-agnostic by design (ADR-0026): nothing in this module knows which
// PDF engine renders the doc.
//
// UNMASKED by design (ADR-0030): this doc never nulls a value for size. It
// still computes the export-threshold flags (`masked`, `maskedGroupCount`)
// so the signing projection (signing-report-data.ts, the ONLY place masking
// exists) can decide what leaves the HR context; the detail appendix prints
// everything.
```

(b) Imports: add `import { equalWorkGroupRequiresDocumentation } from "@workspace/core"` next to the existing core import (merge into one import: `import { equalWorkGroupRequiresDocumentation, genderStats, percentileOf } from "@workspace/core"`), add `targetMatches` to the value import from `./pay-mapping-gap-types`, and add

```ts
import {
  type AnalysisStatus,
  comparisonStatus,
  equalWorkGroupStatus,
} from "./analysis-status"
```

(c) `ReportFormatters`: add after `date`:

```ts
  // Date and time of day, for the extraction instant (the freeze).
  dateTime: (epochMs: number) => string
```

(d) After `ReportMedianText` add:

```ts
// An action cited from a group or comparison row: its number (the id both
// documents print), the owner and the planned date. The action's own row
// in the action table carries the rest.
export interface ReportLinkedAction {
  number: number
  ownerName: string
  plannedDate: string
}
```

(e) In `ReportGroupRow` replace the `masked` comment and add two members at the end:

```ts
  // The export threshold (signing-report-data.ts) bites this row. A flag
  // only: the figures below are always present.
  masked: boolean
  ...
  status: AnalysisStatus
  actions: ReportLinkedAction[]
```

In `ReportComparisonRow` add `status: AnalysisStatus` and `actions: ReportLinkedAction[]` after `note`. In `ReportWomenDominatedGroup` add `actions: ReportLinkedAction[]` after `done`.

(f) In `ReportActionRow` add after `id`:

```ts
  number: number
```

and after `plannedDate: string`:

```ts
  // The raw instant behind plannedDate, for the signing plan's date range.
  plannedDateMs: number
```

and after `cost: string | null`:

```ts
  // The raw cost and its unit behind `cost`, for per-area roll-ups.
  costAmount: number | null
  costUnit: CostUnit | null
```

(f2) In `ReportPreviousEvaluation.actions[number]` add `number: number` after `id`, and in the `previousEvaluation` map inside `assemblePayMappingReport` add `number: action.number,` after `id: action.actionId,`.

(g) `ReportPraxisRow` gains:

```ts
  // The first non-erased action anchored to the area, or null.
  action: { number: number; plannedAction: string; plannedDate: string } | null
```

(h) In `PayMappingReportDoc`: replace `population: { total: number; women: number; men: number; priced: number }` with

```ts
  population: {
    total: number
    women: number
    men: number
    priced: number
    womenPriced: number
    menPriced: number
  }
  // The identity block's raw parts, formatted; the templates compose the
  // labeled lines.
  identity: {
    systemVersion: string
    approvedAt: string | null
    referenceDate: string
    extractedAt: string
  }
```

replace `collaboration: { participants: string; description: string } | null` with

```ts
  collaboration: {
    participants: string
    description: string
    date: string | null
  } | null
```

add after `actionTotals`:

```ts
  // The cost roll-up per chapter (the signing plan's per-area figure),
  // through the same costTotalsText as actionTotals.cost.
  actionCostByScope: Record<"equalWork" | "equivalentWork" | "praxis", string | null>
```

and replace the `method` member with:

```ts
  method: {
    criteria: {
      name: string
      dimensionKey: string | null
      weightPoints: number
      sharePct: string
    }[]
    // Weight share per dimension, in first-appearance order of the
    // dimensions among the criteria.
    dimensionShares: { dimensionKey: string; sharePct: string }[]
    pointBudget: number
    levelRules: { level: number; minScore: number }[]
    zoneProfileRules: { zone: string; minStep: number }[]
    workingConditions: {
      status: "active" | "testedNotMaterial"
      motivation: string
    } | null
    approvedAt: string | null
    maskedGroupCount: number
    singletonCount: number
    genderPureCount: number
    reverseCount: number
    hourlyRowCount: number
    ownHoursCount: number
  }
```

(i) Replace `metricText` and `tccMedianText` (drop the `masked` parameter and its branch):

```ts
function metricText(
  metric: GapMetric,
  formatters: ReportFormatters,
  signed = false
): ReportMetricText {
  const pct = signed ? formatters.signedPct : formatters.pct
  return {
    womenMean:
      metric.womenMean === null ? null : formatters.money(metric.womenMean),
    menMean: metric.menMean === null ? null : formatters.money(metric.menMean),
    gapPct: metric.gapPct === null ? null : pct(metric.gapPct),
    gapKr:
      metric.gapKr === null
        ? null
        : formatters.money(signed ? metric.gapKr : Math.abs(metric.gapKr)),
  }
}
```

```ts
function tccMedianText(
  members: PayMappingSnapshotRow[],
  formatters: ReportFormatters,
  signed = false
): ReportMedianText {
  const women = genderStats(
    members.filter((row) => row.gender === "Kvinna").map(fteTotalMonthly)
  )
  const men = genderStats(
    members.filter((row) => row.gender === "Man").map(fteTotalMonthly)
  )
  const gap = signedGapPctOf(women?.median ?? null, men?.median ?? null)
  return {
    women: women === null ? null : formatters.money(women.median),
    men: men === null ? null : formatters.money(men.median),
    gapPct:
      gap === null
        ? null
        : (signed ? formatters.signedPct : formatters.pct)(gap),
  }
}
```

(j) Add the cost roll-up after `signedGapPctOf`, and a linked-actions helper after `analysisFor`:

```ts
// The cost roll-up of a set of action rows, per recurrence unit: a lump sum
// and a monthly figure cannot share one total, so the text enumerates the
// units that occur, in COST_UNITS order. Null when no row carries a cost.
// Reads the rows' raw parts and the formatter that produced their display
// text, so a roll-up can never print in a different format than its rows.
export function costTotalsText(
  rows: readonly Pick<ReportActionRow, "costAmount" | "costUnit">[],
  formatters: Pick<ReportFormatters, "money" | "costUnitSuffix">
): string | null {
  const byUnit: Record<CostUnit, number> = {
    oneOff: 0,
    perMonth: 0,
    perYear: 0,
  }
  let any = false
  for (const row of rows) {
    if (row.costAmount === null) continue
    any = true
    byUnit[row.costUnit ?? "oneOff"] += row.costAmount
  }
  if (!any) return null
  const parts = (Object.keys(byUnit) as CostUnit[])
    .filter((unit) => byUnit[unit] > 0)
    .map(
      (unit) => formatters.money(byUnit[unit]) + formatters.costUnitSuffix(unit)
    )
  return parts.join(", ") || formatters.money(0)
}
```

```ts
// The non-erased actions anchored to exactly one target, as the citation
// rows a group or comparison prints, ordered by number.
function linkedActions(
  actions: PayMappingActionWire[],
  target: PayMappingActionWire["target"],
  formatters: ReportFormatters
): ReportLinkedAction[] {
  return actions
    .filter((action) => !action.erased && targetMatches(action.target, target))
    .sort((a, b) => a.number - b.number)
    .map((action) => ({
      number: action.number,
      ownerName: action.ownerName,
      plannedDate: formatters.date(action.plannedDate),
    }))
}
```

(k) Replace `groupRow` with:

```ts
function groupRow(
  group: GapGroup,
  input: {
    analysis: GroupAnalysis | undefined
    rows: PayMappingSnapshotRow[]
    previousGapPct: number | null
    // The scope the group's actions anchor under; null for the per-level
    // context table, which takes no actions and carries no duty.
    scope: "equalWork" | "equivalentWork" | null
    analyses: GroupAnalysis[]
    actions: PayMappingActionWire[]
    formatters: ReportFormatters
    signed?: boolean
  }
): ReportGroupRow {
  const { analysis, rows, previousGapPct, scope, analyses, actions } = input
  const { formatters } = input
  const signed = input.signed ?? false
  const pct = signed ? formatters.signedPct : formatters.pct
  const linked =
    scope === null
      ? []
      : [
          ...linkedActions(
            actions,
            { kind: "group", scope, groupKey: group.key },
            formatters
          ),
          ...actions
            .filter(
              (action) =>
                !action.erased &&
                action.target.kind === "person" &&
                action.target.scope === scope &&
                action.target.groupKey === group.key
            )
            .sort((a, b) => a.number - b.number)
            .map((action) => ({
              number: action.number,
              ownerName: action.ownerName,
              plannedDate: formatters.date(action.plannedDate),
            })),
        ].sort((a, b) => a.number - b.number)
  return {
    key: group.key,
    label: groupLabel(group),
    level: group.level,
    womenCount: group.womenCount,
    menCount: group.menCount,
    masked: exportMasksGenderMeans(group),
    tcc: metricText(group.tcc, formatters, signed),
    tccMedian: tccMedianText(memberRows(rows, group), formatters, signed),
    base: metricText(group.base, formatters, signed),
    flag: group.flag,
    baseDriven: group.baseDriven,
    previousGapPct: previousGapPct === null ? null : pct(previousGapPct),
    reasons: analysis?.reasons ?? [],
    note: analysis?.note ?? null,
    done: analysis?.done ?? false,
    status:
      scope === "equalWork"
        ? equalWorkGroupStatus(group, analyses, actions)
        : "noActionNeeded",
    actions: linked,
  }
}
```

(l) Replace `womenDominatedRow` with:

```ts
function womenDominatedRow(
  group: WomenDominatedGroupWire,
  analyses: GroupAnalysis[],
  actions: PayMappingActionWire[],
  rows: PayMappingSnapshotRow[],
  formatters: ReportFormatters
): ReportWomenDominatedGroup {
  const masked = exportMasksWholeGroupMean(group.headcount)
  const own = analysisFor(analyses, "equivalentWork", group.key)
  return {
    key: group.key,
    label: groupLabel(group),
    level: group.level,
    headcount: group.headcount,
    womenSharePct: formatters.pct(group.womenSharePct),
    meanComp: formatters.money(group.meanComp),
    spread: spreadSpan(memberRows(rows, group), formatters),
    masked,
    reasons: own?.reasons ?? [],
    note: own?.note ?? null,
    done: own?.done ?? false,
    actions: linkedActions(
      actions,
      { kind: "group", scope: "equivalentWork", groupKey: group.key },
      formatters
    ),
    comparisons: group.comparisons.map((comparison) => {
      // The difference reads against the dominated group's own mean, so the
      // flag is set when EITHER side's whole-group mean is under the floor.
      const comparisonMasked =
        masked || exportMasksWholeGroupMean(comparison.headcount)
      const row = analysisFor(
        analyses,
        "equivalentWork",
        group.key,
        comparison.key
      )
      return {
        key: comparison.key,
        label: groupLabel(comparison),
        level: comparison.level,
        headcount: comparison.headcount,
        womenSharePct: formatters.pct(comparison.womenSharePct),
        meanComp: formatters.money(comparison.meanComp),
        spread: spreadSpan(memberRows(rows, comparison), formatters),
        diffPct:
          comparison.diffPct === null
            ? null
            : formatters.pct(comparison.diffPct),
        diffKr: formatters.money(comparison.diffSek),
        masked: comparisonMasked,
        reasons: row?.reasons ?? [],
        note: row?.note ?? null,
        status: comparisonStatus(group, comparison.key, analyses, actions),
        actions: linkedActions(
          actions,
          {
            kind: "comparison",
            groupKey: group.key,
            comparisonKey: comparison.key,
          },
          formatters
        ),
      }
    }),
  }
}
```

(m) In `populationSpreadNums`, delete the line `if (values.length < EXPORT_MIN_GROUP_SIZE) return null` and change its comment to `// One gender's population five-point spread as raw numbers; null only when the gender has no priced rows.`

(n) In `assemblePayMappingReport`:

- The `previousGapByKey` loop: replace `exportMasksGenderMeans(group) ? null : group.tcc.gapPct` with `group.tcc.gapPct` and its comment with `// The previous run's mean total-comp gap per group key, for the year-over-year figure on rows whose group existed last time.`
- The four `groupRow(...)` call sites become:

```ts
  const equalWork = gap.equalWork.map((group) =>
    groupRow(group, {
      analysis: analysisFor(analyses, "equalWork", group.key),
      rows: pricedRows,
      previousGapPct: previousGapFor(group.key),
      scope: "equalWork",
      analyses,
      actions,
      formatters,
    })
  )
  const reverseGroups = gap.excluded.reverse.map((group) =>
    groupRow(group, {
      analysis: undefined,
      rows: pricedRows,
      previousGapPct: previousGapFor(group.key),
      scope: null,
      analyses,
      actions,
      formatters,
    })
  )
  const equivalentWorkLevels = gap.equivalentWork.map((group) =>
    groupRow(group, {
      analysis: undefined,
      rows: pricedRows,
      previousGapPct: previousGapFor(group.key),
      scope: null,
      analyses,
      actions,
      formatters,
      signed: true,
    })
  )
  const womenDominated = gap.womenDominated.map((group) =>
    womenDominatedRow(group, analyses, actions, pricedRows, formatters)
  )
```

- The action rows map gains `number: action.number,` (after `id`), `plannedDateMs: action.plannedDate,` (after `plannedDate`), and after `cost:` the two raw parts:

```ts
      costAmount: action.estimatedCost,
      costUnit: action.estimatedCostUnit,
```

- Replace the `costByUnit`/`costParts`/`actionTotals` block with:

```ts
  const actionTotals = {
    count: actions.length,
    cost: costTotalsText(actionRows, formatters),
    notStarted: actions.filter((a) => a.status === "notStarted").length,
    inProgress: actions.filter((a) => a.status === "inProgress").length,
    done: actions.filter((a) => a.status === "done").length,
  }
  const costForScope = (scope: ReportActionRow["scope"]) =>
    costTotalsText(
      actionRows.filter((action) => action.scope === scope),
      formatters
    )
```

  and add to the returned object, after `actionTotals,`:

```ts
    actionCostByScope: {
      equalWork: costForScope("equalWork"),
      equivalentWork: costForScope("equivalentWork"),
      praxis: costForScope("praxis"),
    },
```

- The praxis rows become:

```ts
  const praxis: ReportPraxisRow[] = BASE_PRAXIS_AREA_KEYS.map((key) => {
    const row = analysisFor(analyses, "praxis", key)
    const action = [...actions]
      .filter(
        (candidate) =>
          !candidate.erased &&
          candidate.target.kind === "praxis" &&
          candidate.target.area === key
      )
      .sort((a, b) => a.number - b.number)[0]
    return {
      key,
      finding: row?.finding ?? null,
      note: row?.note ?? null,
      done: row?.done ?? false,
      action:
        action === undefined
          ? null
          : {
              number: action.number,
              plannedAction: action.plannedAction,
              plannedDate: formatters.date(action.plannedDate),
            },
    }
  })
```

- Replace the `totalWeight` block and the org-median block: `totalWeight` reads `run.frozenMethod.criteria` (Task 4 did this). Replace the org-median derivation (`const orgWomenMedian = womenSpreadNums?.median ?? null` and the `orgMenMedian` line) with

```ts
  // Org-level medians over the priced population's total compensation,
  // unmasked like everything else here; the signing projection applies the
  // per-gender floor.
  const orgWomenMedian = percentileOf(orgWomenValues, 50)
  const orgMenMedian = percentileOf(orgMenValues, 50)
```

- Add the dimension-share derivation before the `return`:

```ts
  const sharePct = (points: number): string =>
    totalWeight === 0
      ? formatters.pct(0)
      : formatters.pct((points / totalWeight) * 100)
  const dimensionOrder: string[] = []
  const pointsByDimension = new Map<string, number>()
  for (const criterion of run.frozenMethod.criteria) {
    if (criterion.dimensionKey === null) continue
    if (!pointsByDimension.has(criterion.dimensionKey)) {
      dimensionOrder.push(criterion.dimensionKey)
      pointsByDimension.set(criterion.dimensionKey, 0)
    }
    pointsByDimension.set(
      criterion.dimensionKey,
      (pointsByDimension.get(criterion.dimensionKey) ?? 0) +
        criterion.weightPoints
    )
  }
```

- In the returned object:
  - `population` becomes `{ total: run.populationCount, women: gap.population.women, men: gap.population.men, priced: pricedRows.length, womenPriced: orgWomenValues.length, menPriced: orgMenValues.length }`.
  - Add after `population`:

```ts
    identity: {
      systemVersion: run.systemVersion,
      approvedAt:
        run.frozenMethod.approvedAt === null
          ? null
          : formatters.date(run.frozenMethod.approvedAt),
      referenceDate: formatters.date(run.referenceDate),
      extractedAt: formatters.dateTime(run.referenceDate),
    },
```

  - `collaboration` becomes:

```ts
    collaboration:
      run.collaboration === null
        ? null
        : {
            participants: run.collaboration.participants,
            description: run.collaboration.description,
            date:
              run.collaboration.date === null
                ? null
                : formatters.date(run.collaboration.date),
          },
```

  - `method` becomes:

```ts
    method: {
      criteria: run.frozenMethod.criteria.map((criterion) => ({
        name: criterion.name,
        dimensionKey: criterion.dimensionKey,
        weightPoints: criterion.weightPoints,
        sharePct: sharePct(criterion.weightPoints),
      })),
      dimensionShares: dimensionOrder.map((dimensionKey) => ({
        dimensionKey,
        sharePct: sharePct(pointsByDimension.get(dimensionKey) ?? 0),
      })),
      pointBudget: totalWeight,
      levelRules: run.frozenMethod.levelRules,
      zoneProfileRules: run.frozenMethod.zoneProfileRules,
      workingConditions: run.frozenMethod.workingConditions,
      approvedAt:
        run.frozenMethod.approvedAt === null
          ? null
          : formatters.date(run.frozenMethod.approvedAt),
      maskedGroupCount,
      singletonCount: gap.excluded.singletonCount,
      genderPureCount: gap.excluded.genderPure.length,
      reverseCount: gap.excluded.reverse.length,
      hourlyRowCount: hourlyRows.length,
      ownHoursCount,
    },
```

  - `summary.equalWorkRequired` uses the core rule: `equalWork.filter((row) => equalWorkGroupRequiresDocumentation(row.flag)).length`.

(o) The `orgVariablePayStats` export, `signedGapPctOf`, `memberRows`, `hourlyNoteLabel`, `computeHeaderBreaks` and `unionReportDoc` stay untouched in this task.

- [ ] **Step 4: Thread the new formatter through the two callers**

In `apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx`, in the `formatters` object add after `date`:

```ts
        dateTime: (epochMs) =>
          format.dateTime(new Date(epochMs), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
```

In `apps/dashboard/components/pay-mapping/pay-mapping-report-render.test.tsx`'s formatters add `dateTime: (epochMs) => new Date(epochMs).toISOString(),`.

- [ ] **Step 5: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pay-mapping`; `bunx biome check apps/dashboard/components/pay-mapping`
Expected: PASS, no diagnostics. The union-variant tests in the data test file still pass (the transform is unchanged). From here until Task 11c deletes them, the retired documentation and union PDFs render the unmasked assembly: the staged chain of Global Constraints, in which nothing is committed or deployed.

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `refactor(pay-mapping): assemble the report unmasked with statuses, linked actions and the frozen method`

---

### Task 8: The two projections and the masking module

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-masking.ts`
- Create: `apps/dashboard/components/pay-mapping/signing-report-data.ts`
- Create: `apps/dashboard/components/pay-mapping/signing-report-data.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (remove the constants and the two predicates; import them)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-metrics-export.ts`, `pay-mapping-report-export.tsx`, `pay-mapping-report-data.test.ts` (imports)

**Interfaces:**
- Produces in `lib/pay-mapping-masking.ts` (a plain module, no react-pdf import; the overview redesign plan's Task 5 consumes it from this path): `EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER`, `exportMasksGenderMeans`, `exportMasksWholeGroupMean` (moved, unchanged values).
- Produces in `signing-report-data.ts`: `SigningReportDoc`, `SigningActionArea`, `SIGNING_ACTION_AREAS`, `signingReportDoc(full: PayMappingReportDoc): SigningReportDoc`; `DetailAppendixDoc` and `detailAppendixDoc(full): DetailAppendixDoc`.
- Consumes: `costTotalsText` and `actionCostByScope` from Task 7.

- [ ] **Step 1: Write the failing projection tests**

Create `apps/dashboard/components/pay-mapping/signing-report-data.test.ts`:

```ts
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"
import {
  makeFrozenCriterion,
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"
import {
  EXPORT_MIN_GROUP_SIZE,
  EXPORT_MIN_PER_GENDER,
  exportMasksGenderMeans,
  exportMasksWholeGroupMean,
} from "@/lib/pay-mapping-masking"
import {
  assemblePayMappingReport,
  type ReportFormatters,
} from "./pay-mapping-report-data"
import { detailAppendixDoc, signingReportDoc } from "./signing-report-data"

// Marker formatters: every money figure is "M<n>", so a group amount that
// leaks into the signing doc is a string the scan below can find.
const formatters: ReportFormatters = {
  money: (value) => `M${value}`,
  pct: (value) => `P${value}`,
  signedPct: (value) => `S${value}`,
  date: (epochMs) => `D${epochMs}`,
  dateTime: (epochMs) => `T${epochMs}`,
  costUnitSuffix: (unit) =>
    unit === null || unit === "oneOff" ? "" : `/${unit}`,
}

function row(
  index: number,
  gender: "Kvinna" | "Man",
  roleTitle: string,
  level: number,
  pay: number
): PayMappingSnapshotRow {
  return {
    personPublicId: `p${index}`,
    displayName: `Person ${index}`,
    erased: false,
    gender,
    roleTitle,
    trackKey: "ic",
    seniority: "Mid",
    level,
    basicMonthly: pay,
    components: [],
  }
}

// Two equal-work groups: SWE (2 women, 2 men, above the thresholds) and QA
// (1 woman, 3 men, under the per-gender floor); one women-dominated group
// (Nurse, 5 people) measured against Support (4) and Clerk (3, under the
// whole-group floor).
const ROWS: PayMappingSnapshotRow[] = [
  row(1, "Kvinna", "SWE", 3, 90000),
  row(2, "Kvinna", "SWE", 3, 90000),
  row(3, "Man", "SWE", 3, 100000),
  row(4, "Man", "SWE", 3, 100000),
  row(5, "Kvinna", "QA", 4, 50000),
  row(6, "Man", "QA", 4, 52000),
  row(7, "Man", "QA", 4, 52000),
  row(8, "Man", "QA", 4, 52000),
  row(9, "Kvinna", "Nurse", 2, 40000),
  row(10, "Kvinna", "Nurse", 2, 40000),
  row(11, "Kvinna", "Nurse", 2, 40000),
  row(12, "Kvinna", "Nurse", 2, 40000),
  row(13, "Man", "Nurse", 2, 40000),
]

function makeAction(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    number: 1,
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
    problem: "Unexplained gap",
    plannedAction: "Salary review",
    reason: "experience",
    ownerUserId: "u1",
    ownerName: "HR Person",
    plannedDate: 1000,
    estimatedCost: 42000,
    estimatedCostUnit: "oneOff",
    priority: "high",
    status: "notStarted",
    erased: false,
    createdAt: 1,
    ...overrides,
  }
}

const ANALYSES: GroupAnalysis[] = [
  {
    scope: "equalWork",
    groupKey: "SWE|3",
    comparisonKey: null,
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  },
  {
    scope: "equivalentWork",
    groupKey: "Nurse|2",
    comparisonKey: null,
    reasons: [],
    note: null,
    done: true,
    finding: null,
  },
  {
    scope: "equivalentWork",
    groupKey: "Nurse|2",
    comparisonKey: "Support|3",
    reasons: ["historicalPay"],
    note: null,
    done: false,
    finding: null,
  },
  {
    scope: "praxis",
    groupKey: "payPolicy",
    comparisonKey: null,
    reasons: [],
    note: "Unclear criteria",
    done: true,
    finding: "found",
  },
  {
    scope: "praxis",
    groupKey: "benefits",
    comparisonKey: null,
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
]

const ACTIONS: PayMappingActionWire[] = [
  makeAction(),
  makeAction({
    actionId: "a2" as Id<"payMappingActions">,
    number: 2,
    target: { kind: "comparison", groupKey: "Nurse|2", comparisonKey: "Clerk|3" },
    estimatedCost: 500,
    estimatedCostUnit: "perMonth",
    status: "inProgress",
    plannedDate: 3000,
  }),
  makeAction({
    actionId: "a3" as Id<"payMappingActions">,
    number: 3,
    target: { kind: "praxis", area: "payPolicy" },
    plannedAction: "Rewrite the pay policy",
    estimatedCost: null,
    estimatedCostUnit: null,
    plannedDate: 2000,
  }),
]

function full() {
  return assemblePayMappingReport({
    run: makeRunDetail({
      status: "active",
      rows: ROWS,
      populationCount: 13,
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: 4000,
      },
      frozenMethod: {
        criteria: [
          makeFrozenCriterion({ name: "Knowledge", weightPoints: 4 }),
          makeFrozenCriterion({ name: "Responsibility", weightPoints: 2 }),
        ],
        levelRules: [],
        zoneProfileRules: [],
        workingConditions: null,
        approvedAt: 1_700_000_000_000,
      },
    }),
    gap: makeGapResult({
      org: {
        womenCount: 7,
        menCount: 6,
        womenMeanComp: 60000,
        menMeanComp: 76000,
        gapPct: 21,
        flag: "critical",
      },
      population: { women: 7, men: 6 },
      equalWork: [
        makeGapGroup({ key: "SWE|3", roleTitle: "SWE", level: 3 }),
        makeGapGroup({
          key: "QA|4",
          roleTitle: "QA",
          level: 4,
          womenCount: 1,
          menCount: 3,
          flag: "ok",
          metric: {
            womenMean: 50000,
            menMean: 52000,
            gapPct: 3.8,
            gapKr: 2000,
          },
        }),
      ],
      womenDominated: [
        {
          key: "Nurse|2",
          roleTitle: "Nurse",
          seniority: null,
          level: 2,
          headcount: 5,
          womenSharePct: 80,
          meanComp: 40000,
          comparisons: [
            {
              key: "Support|3",
              roleTitle: "Support",
              seniority: null,
              level: 3,
              headcount: 4,
              womenSharePct: 25,
              meanComp: 45000,
              diffPct: 12.5,
              diffSek: 5000,
            },
            {
              key: "Clerk|3",
              roleTitle: "Clerk",
              seniority: null,
              level: 3,
              headcount: 3,
              womenSharePct: 33,
              meanComp: 47000,
              diffPct: 17.5,
              diffSek: 7000,
            },
          ],
        },
      ],
      quartiles: [
        { women: 3, men: 0 },
        { women: 2, men: 1 },
        { women: 1, men: 2 },
        { women: 1, men: 3 },
      ],
    }),
    analyses: ANALYSES,
    actions: ACTIONS,
    notes: [],
    previous: null,
    formatters,
    praxisAreaLabel: (area) => `Area ${area}`,
  })
}

describe("export-boundary thresholds (ADR-0012, lib/pay-mapping-masking.ts)", () => {
  it("keeps the values 4 and 2", () => {
    expect(EXPORT_MIN_GROUP_SIZE).toBe(4)
    expect(EXPORT_MIN_PER_GENDER).toBe(2)
  })
  it("masks per-gender means below the small-cell minimums", () => {
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 2 })).toBe(false)
    expect(exportMasksGenderMeans({ womenCount: 1, menCount: 3 })).toBe(true)
    expect(exportMasksGenderMeans({ womenCount: 3, menCount: 1 })).toBe(true)
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 1 })).toBe(true)
  })
  it("masks a whole-group mean only below the total minimum", () => {
    expect(exportMasksWholeGroupMean(4)).toBe(false)
    expect(exportMasksWholeGroupMean(3)).toBe(true)
  })
})

describe("signingReportDoc", () => {
  it("carries no amount from any group, on the typed shape and in its text", () => {
    const doc = full()
    const signing = signingReportDoc(doc)
    const text = JSON.stringify(signing)
    // Every group-level money marker the full doc carries.
    for (const amount of [
      "M90000",
      "M100000",
      "M10000",
      "M50000",
      "M52000",
      "M2000",
      "M40000",
      "M45000",
      "M5000",
      "M47000",
      "M7000",
    ]) {
      expect(text, amount).not.toContain(amount)
    }
    // No group names either: the signing report is counts and statuses.
    for (const name of ["SWE", "QA", "Nurse", "Support", "Clerk"]) {
      expect(text, name).not.toContain(name)
    }
    // The only money is the aggregated action cost per area.
    expect(
      signing.actionPlan.find((area) => area.area === "equalWork")?.cost
    ).toBe("M42000")
    expect(
      signing.actionPlan.find((area) => area.area === "equivalentWork")?.cost
    ).toBe("M500/perMonth")
  })

  it("masks the org pay position only under the per-gender floor", () => {
    const signing = signingReportDoc(full())
    expect(signing.payPosition.masked).toBe(false)
    expect(signing.payPosition.womenShareOfMenMeanPct).toBe(
      `P${(60000 / 76000) * 100}`
    )
    const tiny = signingReportDoc({
      ...full(),
      population: { ...full().population, menPriced: 3 },
    })
    expect(tiny.payPosition.masked).toBe(true)
    expect(tiny.payPosition.womenShareOfMenMeanPct).toBeNull()
    expect(tiny.payPosition.womenShareOfMenMedianPct).toBeNull()
  })

  it("counts the equal-work and equivalent-work measures from the statuses", () => {
    const signing = signingReportDoc(full())
    expect(signing.equalWork).toEqual({
      groups: 2,
      required: 1,
      assessed: 1,
      objectiveReasons: 0,
      actionsDecided: 1,
      insufficientBasis: 1,
      statuses: {
        noActionNeeded: 1,
        objectiveReason: 0,
        actionDecided: 1,
        furtherAnalysis: 0,
      },
    })
    expect(signing.equivalentWork).toEqual({
      womenDominatedGroups: 1,
      comparisons: 2,
      completed: 1,
      objectiveReasons: 1,
      actionsDecided: 1,
      statuses: {
        noActionNeeded: 0,
        objectiveReason: 1,
        actionDecided: 1,
        furtherAnalysis: 0,
      },
    })
  })

  it("builds the practice table, the action plan per area and the checklist", () => {
    const signing = signingReportDoc(full())
    expect(signing.praxis.map((area) => [area.key, area.finding, area.done])).toEqual([
      ["payPolicy", "found", true],
      ["collectiveAgreements", null, false],
      ["benefits", "none", true],
      ["payPractices", null, false],
    ])
    expect(signing.praxis[0]?.action).toEqual({
      number: 3,
      plannedAction: "Rewrite the pay policy",
      plannedDate: "D2000",
    })
    expect(signing.collaboration).toEqual({
      participants: "Union rep",
      description: "Monthly",
      date: "D4000",
    })
    expect(signing.actionPlan).toEqual([
      {
        area: "equalWork",
        observations: 1,
        count: 1,
        notStarted: 1,
        inProgress: 0,
        done: 0,
        cost: "M42000",
        earliest: "D1000",
        latest: "D1000",
      },
      {
        area: "equivalentWork",
        observations: 2,
        count: 1,
        notStarted: 0,
        inProgress: 1,
        done: 0,
        cost: "M500/perMonth",
        earliest: "D3000",
        latest: "D3000",
      },
      {
        area: "praxis",
        observations: 1,
        count: 1,
        notStarted: 1,
        inProgress: 0,
        done: 0,
        cost: null,
        earliest: "D2000",
        latest: "D2000",
      },
    ])
    expect(signing.checklist).toEqual({
      allRequiredAssessed: true,
      reasonsOrActionsLinked: true,
      collaborationDocumented: true,
      sameFrozenVersion: true,
    })
    expect(signing.openItems).toEqual({ openAnalyses: 0, actionsInProgress: 1 })
    expect(signing.exclusions).toEqual({
      withoutPay: 0,
      singletonCount: 0,
      genderPureCount: 0,
      maskedGroupCount: 2,
    })
  })
})

describe("detailAppendixDoc", () => {
  it("keeps every group with its figures", () => {
    const doc = full()
    const appendix = detailAppendixDoc(doc)
    expect(appendix.equalWork.map((row) => row.tcc.womenMean)).toEqual([
      "M90000",
      "M50000",
    ])
    expect(appendix.womenDominated[0]?.comparisons.map((c) => c.diffKr)).toEqual([
      "M5000",
      "M7000",
    ])
    expect(appendix.method.criteria.map((c) => c.name)).toEqual([
      "Knowledge",
      "Responsibility",
    ])
  })
})
```

Check the fixture arithmetic before running: `maskedGroupCount` is 2 (QA per gender, Clerk whole-group; SWE, Nurse and Support are over the floors); `equalWork.required` is 1 because `equalWorkGroupRequiresDocumentation` returns `flag !== "ok"` and QA is `ok`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bun run test -- signing-report-data`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the two modules**

Create `apps/dashboard/lib/pay-mapping-masking.ts` (a plain module: no React, no react-pdf, no Convex, so the signing projection, the assembly, the key-figures workbook and the coming overview redesign can all read it):

```ts
// The export-boundary small-cell minimums (ADR-0012, tillägg 2026-07-16): a
// PER-GENDER group mean/gap leaves the HR context only when the group has at
// least this many people in total AND at least this many per gender. A
// whole-group mean (the women-dominated comparison ranks whole groups, not
// genders) has no per-gender leg; it masks below the total minimum alone,
// because a small group's mean approaches an individual's salary. The rule
// is this product's own conservative disclosure choice: no Swedish statute,
// DO guidance, or social-partner material prescribes a numeric threshold,
// and real employer documents commonly list every group unmasked. Never
// present it as an industry standard.
//
// Who acts on it: the report assembly only FLAGS rows with these predicates
// (ADR-0030: it never nulls a value for size), the signing projection
// (signing-report-data.ts) is the one document projection that masks, and
// the key-figures workbook keeps its own ADR-0012 masking unchanged.
export const EXPORT_MIN_GROUP_SIZE = 4
export const EXPORT_MIN_PER_GENDER = 2

export function exportMasksGenderMeans(group: {
  womenCount: number
  menCount: number
}): boolean {
  return (
    group.womenCount + group.menCount < EXPORT_MIN_GROUP_SIZE ||
    group.womenCount < EXPORT_MIN_PER_GENDER ||
    group.menCount < EXPORT_MIN_PER_GENDER
  )
}

export function exportMasksWholeGroupMean(headcount: number): boolean {
  return headcount < EXPORT_MIN_GROUP_SIZE
}
```

Create `apps/dashboard/components/pay-mapping/signing-report-data.ts`:

```ts
// The two projections of the unmasked report assembly (ADR-0030, approach
// C): the detail appendix is the identity projection; the signing report
// reduces everything to counts, shares, statuses and org-level aggregates.
// This module is the ONLY document projection that masks. Its output type
// has no field for a group-level amount, so a leak is a compile error
// rather than a review finding; the projection test string-scans the
// output as the second guard.
import { BASE_PRAXIS_AREA_KEYS, type PraxisAreaKey } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { EXPORT_MIN_GROUP_SIZE } from "@/lib/pay-mapping-masking"
import { type AnalysisStatus, countByStatus } from "./analysis-status"
import type {
  PayMappingReportDoc,
  ReportActionRow,
  ReportPraxisRow,
} from "./pay-mapping-report-data"

// The detail appendix prints the assembly as it is: every group, amount,
// reason, action and the frozen method. The alias and the identity function
// exist so the export seam names the projection it renders, and a future
// reduction has one place to live.
export type DetailAppendixDoc = PayMappingReportDoc

export function detailAppendixDoc(full: PayMappingReportDoc): DetailAppendixDoc {
  return full
}

export const SIGNING_ACTION_AREAS = [
  "equalWork",
  "equivalentWork",
  "praxis",
] as const
export type SigningActionArea = (typeof SIGNING_ACTION_AREAS)[number]

export interface SigningMeasures {
  groups: number
  required: number
  // Required groups marked done.
  assessed: number
  objectiveReasons: number
  actionsDecided: number
  // Groups the export thresholds bite (masked in this document, shown in
  // full in the appendix).
  insufficientBasis: number
  statuses: Record<AnalysisStatus, number>
}

export interface SigningEquivalentMeasures {
  womenDominatedGroups: number
  comparisons: number
  // Women-dominated groups with comparisons whose own row is marked done.
  completed: number
  objectiveReasons: number
  actionsDecided: number
  statuses: Record<AnalysisStatus, number>
}

export interface SigningActionAreaRow {
  area: SigningActionArea
  // The aggregated observation the actions answer: required equal-work
  // groups, comparisons, or practice areas with a found deficiency.
  observations: number
  count: number
  notStarted: number
  inProgress: number
  done: number
  // Summed per unit, display text; null when no action in the area carries
  // a cost.
  cost: string | null
  earliest: string | null
  latest: string | null
}

export interface SigningPraxisRow {
  key: PraxisAreaKey
  finding: "none" | "found" | null
  done: boolean
  action: ReportPraxisRow["action"]
}

// Everything the signing report prints. Deliberately without any per-group
// field: no group name, no group amount, no person-near value can be
// expressed in this type.
export interface SigningReportDoc {
  status: "draft" | "final"
  runLabel: string
  currency: string | null
  identity: PayMappingReportDoc["identity"]
  population: PayMappingReportDoc["population"]
  payPosition: {
    womenShareOfMenMeanPct: string | null
    womenShareOfMenMedianPct: string | null
    // True when a gender has fewer priced rows than EXPORT_MIN_GROUP_SIZE.
    masked: boolean
  }
  quartiles: { women: number; men: number }[]
  exclusions: {
    withoutPay: number
    singletonCount: number
    genderPureCount: number
    maskedGroupCount: number
  }
  collaboration: PayMappingReportDoc["collaboration"]
  praxis: SigningPraxisRow[]
  equalWork: SigningMeasures
  equivalentWork: SigningEquivalentMeasures
  actionPlan: SigningActionAreaRow[]
  method: {
    criteria: { name: string; weightPoints: number }[]
    pointBudget: number
  }
  checklist: {
    allRequiredAssessed: boolean
    reasonsOrActionsLinked: boolean
    collaborationDocumented: boolean
    // Both documents derive from the one assembly of the one frozen run.
    sameFrozenVersion: true
  }
  openItems: { openAnalyses: number; actionsInProgress: number }
}

function actionArea(action: ReportActionRow): SigningActionArea {
  return action.scope
}

export function signingReportDoc(full: PayMappingReportDoc): SigningReportDoc {
  const payMasked =
    full.population.womenPriced < EXPORT_MIN_GROUP_SIZE ||
    full.population.menPriced < EXPORT_MIN_GROUP_SIZE

  const equalRequired = full.equalWork.filter((row) =>
    equalWorkGroupRequiresDocumentation(row.flag)
  )
  const equalStatuses = full.equalWork.map((row) => row.status)
  const equalWork: SigningMeasures = {
    groups: full.equalWork.length,
    required: equalRequired.length,
    assessed: equalRequired.filter((row) => row.done).length,
    objectiveReasons: equalStatuses.filter((s) => s === "objectiveReason")
      .length,
    actionsDecided: equalStatuses.filter((s) => s === "actionDecided").length,
    insufficientBasis: full.equalWork.filter((row) => row.masked).length,
    statuses: countByStatus(equalStatuses),
  }

  const comparisons = full.womenDominated.flatMap((group) => group.comparisons)
  const comparisonStatuses = comparisons.map((row) => row.status)
  const equivalentWork: SigningEquivalentMeasures = {
    womenDominatedGroups: full.womenDominated.length,
    comparisons: comparisons.length,
    completed: full.womenDominated.filter(
      (group) =>
        womenDominatedGroupRequiresDocumentation(group.comparisons.length) &&
        group.done
    ).length,
    objectiveReasons: comparisonStatuses.filter((s) => s === "objectiveReason")
      .length,
    actionsDecided: comparisonStatuses.filter((s) => s === "actionDecided")
      .length,
    statuses: countByStatus(comparisonStatuses),
  }

  const praxis: SigningPraxisRow[] = BASE_PRAXIS_AREA_KEYS.map((key) => {
    const row = full.praxis.find((candidate) => candidate.key === key)
    return {
      key,
      finding: row?.finding ?? null,
      done: row?.done ?? false,
      action: row?.action ?? null,
    }
  })

  const observationsByArea: Record<SigningActionArea, number> = {
    equalWork: equalRequired.length,
    equivalentWork: comparisons.length,
    praxis: full.praxis.filter((row) => row.finding === "found").length,
  }
  const actionPlan: SigningActionAreaRow[] = SIGNING_ACTION_AREAS.map(
    (area) => {
      const rows = full.actions.filter((action) => actionArea(action) === area)
      const dates = rows.map((action) => action.plannedDateMs)
      const earliestMs = dates.length === 0 ? null : Math.min(...dates)
      const latestMs = dates.length === 0 ? null : Math.max(...dates)
      const byDate = (ms: number | null) =>
        ms === null
          ? null
          : (rows.find((action) => action.plannedDateMs === ms)?.plannedDate ??
            null)
      return {
        area,
        observations: observationsByArea[area],
        count: rows.length,
        notStarted: rows.filter((a) => a.status === "notStarted").length,
        inProgress: rows.filter((a) => a.status === "inProgress").length,
        done: rows.filter((a) => a.status === "done").length,
        cost: full.actionCostByScope[area],
        earliest: byDate(earliestMs),
        latest: byDate(latestMs),
      }
    }
  )

  const openAnalyses =
    equalStatuses.filter((s) => s === "furtherAnalysis").length +
    comparisonStatuses.filter((s) => s === "furtherAnalysis").length

  const closed = (status: AnalysisStatus) =>
    status === "objectiveReason" || status === "actionDecided"

  return {
    status: full.status,
    runLabel: full.runLabel,
    currency: full.currency,
    identity: full.identity,
    population: full.population,
    payPosition: {
      womenShareOfMenMeanPct: payMasked
        ? null
        : full.summary.womenShareOfMenMeanPct,
      womenShareOfMenMedianPct: payMasked
        ? null
        : full.summary.womenShareOfMenMedianPct,
      masked: payMasked,
    },
    quartiles: full.quartiles,
    exclusions: {
      withoutPay: full.population.total - full.population.priced,
      singletonCount: full.method.singletonCount,
      genderPureCount: full.method.genderPureCount,
      maskedGroupCount: full.method.maskedGroupCount,
    },
    collaboration: full.collaboration,
    praxis,
    equalWork,
    equivalentWork,
    actionPlan,
    method: {
      criteria: full.method.criteria.map((criterion) => ({
        name: criterion.name,
        weightPoints: criterion.weightPoints,
      })),
      pointBudget: full.method.pointBudget,
    },
    checklist: {
      allRequiredAssessed:
        equalRequired.every((row) => row.done) &&
        full.womenDominated
          .filter((group) =>
            womenDominatedGroupRequiresDocumentation(group.comparisons.length)
          )
          .every((group) => group.done),
      reasonsOrActionsLinked:
        equalRequired.every((row) => closed(row.status)) &&
        comparisons.every((row) => closed(row.status)),
      collaborationDocumented:
        full.collaboration !== null &&
        full.collaboration.participants.trim() !== "" &&
        full.collaboration.description.trim() !== "",
      sameFrozenVersion: true,
    },
    openItems: {
      openAnalyses,
      actionsInProgress: full.actions.filter((a) => a.status === "inProgress")
        .length,
    },
  }
}
```

The per-area cost comes pre-formatted from the assembly (`actionCostByScope`, Task 7): the projection has no formatters and must not grow any.

- [ ] **Step 4: Move the constants out of the assembly**

In `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` delete `EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER`, `exportMasksGenderMeans`, `exportMasksWholeGroupMean` and their comment block, and add

```ts
import {
  EXPORT_MIN_GROUP_SIZE,
  exportMasksGenderMeans,
  exportMasksWholeGroupMean,
} from "@/lib/pay-mapping-masking"
```

(`EXPORT_MIN_GROUP_SIZE` is still read by `orgVariablePayStats`, the workbook's per-gender floor, which keeps its ADR-0012 masking unchanged: the key-figures export is out of this plan's scope). Update the imports in `pay-mapping-metrics-export.ts` (`EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER`, `exportMasksGenderMeans` now come from `@/lib/pay-mapping-masking`; `memberRows`, `orgVariablePayStats`, `signedGapPctOf` stay from `./pay-mapping-report-data`), in `pay-mapping-report-export.tsx` (`EXPORT_MIN_GROUP_SIZE`, `EXPORT_MIN_PER_GENDER` from `@/lib/pay-mapping-masking`, until Task 11c rewrites that file), and in `pay-mapping-report-data.test.ts` (delete the `export-boundary masking (ADR-0012)` describe, which now lives in the new test file, and the two predicate imports).

- [ ] **Step 5: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- pay-mapping signing-report`; `bunx biome check apps/dashboard/components/pay-mapping apps/dashboard/lib/pay-mapping-masking.ts`
Expected: PASS, no diagnostics. `grep -rn "react-pdf" apps/dashboard/lib/pay-mapping-masking.ts` prints nothing.

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): project the signing report and the detail appendix from one assembly`

---

### Task 9: The signing report document

**Files:**
- Create: `apps/dashboard/components/pay-mapping/signing-report-doc.tsx`
- Create: `apps/dashboard/components/pay-mapping/signing-report-render.test.tsx`

**Interfaces:**
- Consumes: `SigningReportDoc` (Task 8), `IdentityBlock`, `SignatureBlock`, `tableStyles` (Task 6), `PairedBarsChart`, `PdfGenderLegend` (existing, `pay-mapping-report-charts.tsx`).
- Produces: `SigningReportLabels`, `SigningReportPdf({ doc, labels, onResolvePage? })`, `SIGNING_SECTIONS` (the eight section ids in order).

Every label is a resolved string (or a row list of resolved strings); the component is layout only. The eight sections are the spec's eight pages, each its own `BrandedPage`.

- [ ] **Step 1: Write the failing render test**

Create `apps/dashboard/components/pay-mapping/signing-report-render.test.tsx`:

```tsx
import { pdf } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"
import type { SigningReportDoc } from "./signing-report-data"
import {
  SIGNING_SECTIONS,
  type SigningReportLabels,
  SigningReportPdf,
} from "./signing-report-doc"

const DOC: SigningReportDoc = {
  status: "draft",
  runLabel: "Pay mapping 2026",
  currency: "SEK",
  identity: {
    systemVersion: "v2-slice1",
    approvedAt: "12 Jun 2026",
    referenceDate: "1 Jul 2026",
    extractedAt: "1 Jul 2026, 09:12",
  },
  population: {
    total: 13,
    women: 7,
    men: 6,
    priced: 13,
    womenPriced: 7,
    menPriced: 6,
  },
  payPosition: {
    womenShareOfMenMeanPct: "79%",
    womenShareOfMenMedianPct: "81%",
    masked: false,
  },
  quartiles: [
    { women: 3, men: 0 },
    { women: 2, men: 1 },
    { women: 1, men: 2 },
    { women: 1, men: 3 },
  ],
  exclusions: {
    withoutPay: 0,
    singletonCount: 2,
    genderPureCount: 1,
    maskedGroupCount: 2,
  },
  collaboration: {
    participants: "Union rep",
    description: "Monthly",
    date: "15 Sep 2026",
  },
  praxis: [
    {
      key: "payPolicy",
      finding: "found",
      done: true,
      action: {
        number: 3,
        plannedAction: "Rewrite the pay policy",
        plannedDate: "1 Dec 2026",
      },
    },
    { key: "collectiveAgreements", finding: null, done: false, action: null },
    { key: "benefits", finding: "none", done: true, action: null },
    { key: "payPractices", finding: "none", done: true, action: null },
  ],
  equalWork: {
    groups: 2,
    required: 1,
    assessed: 1,
    objectiveReasons: 0,
    actionsDecided: 1,
    insufficientBasis: 1,
    statuses: {
      noActionNeeded: 1,
      objectiveReason: 0,
      actionDecided: 1,
      furtherAnalysis: 0,
    },
  },
  equivalentWork: {
    womenDominatedGroups: 1,
    comparisons: 2,
    completed: 1,
    objectiveReasons: 1,
    actionsDecided: 1,
    statuses: {
      noActionNeeded: 0,
      objectiveReason: 1,
      actionDecided: 1,
      furtherAnalysis: 0,
    },
  },
  actionPlan: [
    {
      area: "equalWork",
      observations: 1,
      count: 1,
      notStarted: 1,
      inProgress: 0,
      done: 0,
      cost: "42 000 kr",
      earliest: "1 Dec 2026",
      latest: "1 Dec 2026",
    },
    {
      area: "equivalentWork",
      observations: 2,
      count: 1,
      notStarted: 0,
      inProgress: 1,
      done: 0,
      cost: "500 kr/mo",
      earliest: "1 Mar 2027",
      latest: "1 Mar 2027",
    },
    {
      area: "praxis",
      observations: 1,
      count: 1,
      notStarted: 1,
      inProgress: 0,
      done: 0,
      cost: null,
      earliest: "1 Dec 2026",
      latest: "1 Dec 2026",
    },
  ],
  method: {
    criteria: [
      { name: "Knowledge", weightPoints: 4 },
      { name: "Responsibility", weightPoints: 2 },
    ],
    pointBudget: 6,
  },
  checklist: {
    allRequiredAssessed: true,
    reasonsOrActionsLinked: true,
    collaborationDocumented: true,
    sameFrozenVersion: true,
  },
  openItems: { openAnalyses: 0, actionsInProgress: 1 },
}

const LABELS: SigningReportLabels = {
  docTitle: "Signing report",
  footer: "Signing report",
  identity: {
    docTitle: "Signing report",
    organizationName: "Acme AB",
    runLabel: "Pay mapping 2026",
    referenceDateLine: "Reference date 1 Jul 2026",
    extractedAtLine: "Data extracted 1 Jul 2026, 09:12",
    methodVersionLine: "Method version v2-slice1, model approved 12 Jun 2026",
    generatedOn: "Generated on 3 Sep 2026",
    statusTag: "DRAFT",
  },
  formalitiesTitle: "Formalities and signing",
  collaborationDateLine: "Collaboration date: 15 Sep 2026",
  participantsLabel: "Who takes part in the collaboration?",
  descriptionLabel: "How does the collaboration happen?",
  notDocumented: "Not yet documented.",
  appendixReference:
    "The detailed comparisons and the basis for every figure are in the detail appendix.",
  signature: {
    employer: "For the employer",
    union: "For the union party",
    name: "Name",
    signature: "Signature",
    place: "Place",
    date: "Date",
  },
  summaryTitle: "Summary and result picture",
  boxes: [
    {
      title: "Overall pay position",
      rows: [
        { label: "Women's median pay as a share of men's", value: "81%" },
        { label: "Women's average pay as a share of men's", value: "79%" },
      ],
    },
    {
      title: "Representation",
      rows: [
        { label: "Quartile 1 (lowest paid)", value: "100% women" },
        { label: "Quartile 4 (highest paid)", value: "25% women" },
      ],
    },
    {
      title: "Equal work",
      rows: [
        { label: "Groups compared", value: "2" },
        { label: "Assessments completed", value: "1 of 1" },
        { label: "Objective reasons documented", value: "0" },
        { label: "Actions decided", value: "1" },
      ],
    },
    {
      title: "Equivalent work",
      rows: [
        { label: "Women-dominated groups in scope", value: "1" },
        { label: "Relevant comparisons", value: "2" },
        { label: "Completed", value: "1" },
        { label: "Objective reasons documented", value: "1" },
        { label: "Actions decided", value: "1" },
      ],
    },
  ],
  quartilesTitle: "Distribution per pay quartile",
  quartileRow: (index) => `Quartile ${index + 1}`,
  colWomen: "Women",
  colMen: "Men",
  chartQuartilesCaption: "Number of women and men in each pay quartile.",
  closingSentences: [
    "2 equal-work groups and 2 equivalent-work comparisons were assessed.",
    "1 action is in progress.",
  ],
  scopeTitle: "Scope, method and confidentiality",
  scopeRows: [
    { label: "Reference date", value: "1 Jul 2026" },
    { label: "Population", value: "13 people (7 women, 6 men), 13 with pay" },
    { label: "Pay elements", value: "Base salary and recorded pay components" },
    { label: "Exclusions", value: "0 without pay, 2 single-person, 1 single-gender" },
  ],
  confidentialityNote:
    "Small groups are masked here but analysed, and shown in full in the appendix. 2 groups have insufficient basis for broad reporting.",
  praxisTitle: "Provisions, practice and collaboration",
  colArea: "Area",
  colConclusion: "Conclusion",
  colFollowUp: "Action or follow-up",
  praxisRows: [
    {
      area: "Pay policy",
      conclusion: "Needs review",
      followUp: "#3 Rewrite the pay policy, 1 Dec 2026",
    },
    { area: "Collective agreements", conclusion: "Pending", followUp: "–" },
    { area: "Benefits and variable pay", conclusion: "Clear", followUp: "–" },
    { area: "Pay-setting practice", conclusion: "Clear", followUp: "–" },
    { area: "Collaboration", conclusion: "Performed", followUp: "15 Sep 2026" },
  ],
  equalWorkTitle: "Equal work",
  equalWorkRows: [
    { label: "Comparable groups", value: "2" },
    { label: "Assessments completed", value: "1 of 1" },
    { label: "Objective reasons documented", value: "0" },
    { label: "Actions decided", value: "1" },
    { label: "Groups with insufficient basis for broad reporting", value: "1" },
  ],
  equalWorkConclusion:
    "Every relevant difference has one of four statuses. Results are symmetric regardless of which gender is paid more.",
  equivalentTitle: "Equivalent work",
  chainLine:
    "Role evaluation, women-dominated group, relevant higher-paid comparison group, assessment, action or close.",
  equivalentRows: [
    { label: "Women-dominated groups in scope", value: "1" },
    { label: "Relevant comparisons", value: "2" },
    { label: "Completed", value: "1" },
    { label: "Objective reasons documented", value: "1" },
    { label: "Actions decided", value: "1" },
  ],
  actionPlanTitle: "Action plan and follow-up",
  colObservation: "Observation",
  colActions: "Actions",
  colStatusSplit: "Status",
  colCost: "Estimated cost",
  colDates: "Planned",
  actionPlanRows: [
    {
      area: "Equal work",
      observation: "1 group requiring assessment",
      actions: "1",
      statusSplit: "1 not started",
      cost: "42 000 kr",
      dates: "1 Dec 2026",
    },
    {
      area: "Equivalent work",
      observation: "2 comparisons",
      actions: "1",
      statusSplit: "1 in progress",
      cost: "500 kr/mo",
      dates: "1 Mar 2027",
    },
    {
      area: "Practice",
      observation: "1 area with a finding",
      actions: "1",
      statusSplit: "1 not started",
      cost: "–",
      dates: "1 Dec 2026",
    },
  ],
  noActions: "No actions recorded.",
  methodTitle: "Method note",
  methodLines: [
    "Equal work is role and level.",
    "Equivalent work is the documented gender-neutral evaluation of demands: Knowledge (4), Responsibility (2).",
    "Pay elements: base salary and recorded pay components, FTE-adjusted.",
  ],
  checklistTitle: "Before signing",
  checklistRows: [
    { label: "All comparisons requiring documentation are assessed", done: true },
    { label: "Reasons or actions are linked", done: true },
    { label: "Collaboration is documented", done: true },
    { label: "Both documents derive from the same frozen version", done: true },
  ],
  checklistDone: "Done",
  checklistOpen: "Open",
  maskedCell: "–",
}

describe("SigningReportPdf (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(<SigningReportPdf doc={DOC} labels={LABELS} />).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("captures every section's page number, in document order, within eight pages", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <SigningReportPdf
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    let previous = 0
    for (const id of SIGNING_SECTIONS) {
      expect(pageRefs[id], id).toBeGreaterThanOrEqual(previous)
      previous = pageRefs[id] ?? 0
    }
    expect(pageRefs.formalities).toBe(1)
    expect(pageRefs.method).toBeLessThanOrEqual(8)
  })

  it("renders without a collaboration record and with an empty action plan", async () => {
    const blob = await pdf(
      <SigningReportPdf
        doc={{ ...DOC, collaboration: null, actionPlan: [] }}
        labels={{ ...LABELS, actionPlanRows: [] }}
      />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("grows by whole pages when the collaboration description exceeds a page", async () => {
    const pageCount = async (doc: SigningReportDoc) => {
      const blob = await pdf(<SigningReportPdf doc={doc} labels={LABELS} />).toBlob()
      return ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const short = await pageCount(DOC)
    const long = await pageCount({
      ...DOC,
      collaboration: {
        participants: "Union rep",
        description: "word ".repeat(2400).trim(),
        date: null,
      },
    })
    expect(long).toBeGreaterThan(short)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bun run test -- signing-report-render`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the component**

Create `apps/dashboard/components/pay-mapping/signing-report-doc.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import { type IdentityLabels, IdentityBlock } from "@/components/pdf/identity-block"
import { cellText, tableStyles as s } from "@/components/pdf/pdf-table"
import {
  type SignatureLabels,
  SignatureBlock,
} from "@/components/pdf/signature-block"
import { PairedBarsChart, PdfGenderLegend } from "./pay-mapping-report-charts"
import type { SigningReportDoc } from "./signing-report-data"

// The signing report (signeringsrapport, ADR-0030): six to eight pages
// shared with the employer and the union parties for samverkan and signing.
// Aggregates, counts, statuses, conclusions and the action plan; never a
// group name or a group amount (the projection's type cannot carry one).
// Every section is its own page. i18n-free like the rest of the kit: every
// string arrives resolved through `labels`, most of them already composed
// into the rows the tables print, so this file is layout only.

// A4 content width (595pt minus the page's 48pt horizontal padding).
const CHART_WIDTH = 480

export const SIGNING_SECTIONS = [
  "formalities",
  "summary",
  "scope",
  "praxis",
  "equalWork",
  "equivalentWork",
  "actionPlan",
  "method",
] as const

type LabeledRow = { label: string; value: string }

export type SigningReportLabels = {
  docTitle: string
  footer: string
  identity: IdentityLabels
  // 1. Formalities and signing.
  formalitiesTitle: string
  collaborationDateLine: string
  participantsLabel: string
  descriptionLabel: string
  notDocumented: string
  appendixReference: string
  signature: SignatureLabels & { employer: string; union: string }
  // 2. Summary and result picture: four boxes, the quartile chart, the
  // closing sentences.
  summaryTitle: string
  boxes: { title: string; rows: LabeledRow[] }[]
  quartilesTitle: string
  quartileRow: (index: number) => string
  colWomen: string
  colMen: string
  chartQuartilesCaption: string
  closingSentences: string[]
  // 3. Scope, method and confidentiality.
  scopeTitle: string
  scopeRows: LabeledRow[]
  confidentialityNote: string
  // 4. Provisions, practice and collaboration.
  praxisTitle: string
  colArea: string
  colConclusion: string
  colFollowUp: string
  praxisRows: { area: string; conclusion: string; followUp: string }[]
  // 5. Equal work.
  equalWorkTitle: string
  equalWorkRows: LabeledRow[]
  equalWorkConclusion: string
  // 6. Equivalent work.
  equivalentTitle: string
  chainLine: string
  equivalentRows: LabeledRow[]
  // 7. Action plan and follow-up.
  actionPlanTitle: string
  colObservation: string
  colActions: string
  colStatusSplit: string
  colCost: string
  colDates: string
  actionPlanRows: {
    area: string
    observation: string
    actions: string
    statusSplit: string
    cost: string
    dates: string
  }[]
  noActions: string
  // 8. Method note and the pre-signing checklist.
  methodTitle: string
  methodLines: string[]
  checklistTitle: string
  checklistRows: { label: string; done: boolean }[]
  checklistDone: string
  checklistOpen: string
  maskedCell: string
}

function LabeledRows({ rows }: { rows: LabeledRow[] }) {
  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={s.row} wrap={false}>
          <Text style={[{ flex: 4 }, s.tableText]}>{row.label}</Text>
          <Text style={[s.cellMoney, s.tableText]}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

export function SigningReportPdf({
  doc,
  labels,
  onResolvePage,
}: {
  doc: SigningReportDoc
  labels: SigningReportLabels
  onResolvePage?: (id: string, page: number) => void
}) {
  const resolve = (id: (typeof SIGNING_SECTIONS)[number]) =>
    onResolvePage ? (page: number) => onResolvePage(id, page) : undefined
  const num = (id: (typeof SIGNING_SECTIONS)[number]) =>
    String(SIGNING_SECTIONS.indexOf(id) + 1)

  return (
    <BrandedDocument>
      {/* 1. Formalities and signing: the identity block, the samverkan
          record and the signature lines, on the cover page itself. */}
      <BrandedPage footerLeft={labels.footer}>
        <IdentityBlock labels={labels.identity} />
        <Section
          title={labels.formalitiesTitle}
          number={num("formalities")}
          onRenderPage={resolve("formalities")}
        >
          <Text style={s.para}>{labels.collaborationDateLine}</Text>
          {doc.collaboration === null ? (
            <Text style={s.para}>{labels.notDocumented}</Text>
          ) : (
            <View>
              <Text style={s.fieldLabel}>{labels.participantsLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.participants}</Text>
              <Text style={s.fieldLabel}>{labels.descriptionLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.description}</Text>
            </View>
          )}
          <Text style={s.note}>{labels.appendixReference}</Text>
          <SignatureBlock
            columns={[labels.signature.employer, labels.signature.union]}
            labels={labels.signature}
          />
        </Section>
      </BrandedPage>

      {/* 2. Summary and result picture. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.summaryTitle}
          number={num("summary")}
          onRenderPage={resolve("summary")}
        >
          <View style={s.boxGrid}>
            {labels.boxes.map((box) => (
              <View key={box.title} style={s.box} wrap={false}>
                <Text style={s.boxTitle}>{box.title}</Text>
                {box.rows.map((row) => (
                  <View key={row.label} style={s.boxRow}>
                    <Text style={[s.tableText, { flex: 3 }]}>{row.label}</Text>
                    <Text style={[s.tableText, s.cellNum]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          {doc.quartiles.length > 0 && (
            <View wrap={false} style={s.chartBlock}>
              <Text style={s.subHeading}>{labels.quartilesTitle}</Text>
              <PairedBarsChart
                width={CHART_WIDTH}
                rows={doc.quartiles.map((quartile, index) => ({
                  label: labels.quartileRow(index),
                  women: quartile.women,
                  men: quartile.men,
                  womenText: String(quartile.women),
                  menText: String(quartile.men),
                }))}
              />
              <PdfGenderLegend
                womenLabel={labels.colWomen}
                menLabel={labels.colMen}
              />
              <Text style={s.note}>{labels.chartQuartilesCaption}</Text>
            </View>
          )}
          {labels.closingSentences.map((sentence) => (
            <Text key={sentence} style={s.para}>
              {sentence}
            </Text>
          ))}
        </Section>
      </BrandedPage>

      {/* 3. Scope, method and confidentiality. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.scopeTitle}
          number={num("scope")}
          onRenderPage={resolve("scope")}
        >
          <LabeledRows rows={labels.scopeRows} />
          <Text style={s.note}>{labels.confidentialityNote}</Text>
        </Section>
      </BrandedPage>

      {/* 4. Provisions, practice and collaboration. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.praxisTitle}
          number={num("praxis")}
          onRenderPage={resolve("praxis")}
        >
          <View style={s.headerRow}>
            <Text style={[s.cellGroup, s.label, s.tableText]}>
              {labels.colArea}
            </Text>
            <Text style={[s.cellMoney, s.label, s.tableText]}>
              {labels.colConclusion}
            </Text>
            <Text style={[s.cellWide, s.label, s.tableText]}>
              {labels.colFollowUp}
            </Text>
          </View>
          {labels.praxisRows.map((row) => (
            <View key={row.area} style={s.row} wrap={false}>
              <Text style={[s.cellGroup, s.tableText]}>{row.area}</Text>
              <Text style={[s.cellMoney, s.tableText]}>{row.conclusion}</Text>
              <Text style={[s.cellWide, s.tableText, { paddingLeft: 6 }]}>
                {row.followUp}
              </Text>
            </View>
          ))}
        </Section>
      </BrandedPage>

      {/* 5. Equal work: the measures table and the conclusion box. No
          group names, no amounts. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equalWorkTitle}
          number={num("equalWork")}
          onRenderPage={resolve("equalWork")}
        >
          <LabeledRows rows={labels.equalWorkRows} />
          <View style={[s.box, { width: "100%", marginTop: 16 }]} wrap={false}>
            <Text style={s.docText}>{labels.equalWorkConclusion}</Text>
          </View>
        </Section>
      </BrandedPage>

      {/* 6. Equivalent work: the chain line and the measures table. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equivalentTitle}
          number={num("equivalentWork")}
          onRenderPage={resolve("equivalentWork")}
        >
          <Text style={s.para}>{labels.chainLine}</Text>
          <LabeledRows rows={labels.equivalentRows} />
        </Section>
      </BrandedPage>

      {/* 7. Action plan and follow-up: one row per area, counts and cost
          only, never an owner name. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.actionPlanTitle}
          number={num("actionPlan")}
          onRenderPage={resolve("actionPlan")}
        >
          {labels.actionPlanRows.length === 0 ? (
            <Text style={s.para}>{labels.noActions}</Text>
          ) : (
            <View>
              <View style={s.headerRow}>
                <Text style={[s.cellMoney, s.label, s.tableText]}>
                  {labels.colArea}
                </Text>
                <Text style={[s.cellGroup, s.label, s.tableText]}>
                  {labels.colObservation}
                </Text>
                <Text style={[s.cellNum, s.label, s.tableText]}>
                  {labels.colActions}
                </Text>
                <Text style={[s.cellSpread, s.label, s.tableText]}>
                  {labels.colStatusSplit}
                </Text>
                <Text style={[s.cellMoney, s.label, s.tableText]}>
                  {labels.colCost}
                </Text>
                <Text style={[s.cellSpread, s.label, s.tableText]}>
                  {labels.colDates}
                </Text>
              </View>
              {labels.actionPlanRows.map((row) => (
                <View key={row.area} style={s.row} wrap={false}>
                  <Text style={[s.cellMoney, s.tableText, { textAlign: "left" }]}>
                    {row.area}
                  </Text>
                  <Text style={[s.cellGroup, s.tableText]}>{row.observation}</Text>
                  <Text style={[s.cellNum, s.tableText]}>{row.actions}</Text>
                  <Text style={[s.cellSpread, s.tableText]}>{row.statusSplit}</Text>
                  <Text style={[s.cellMoney, s.tableText]}>
                    {cellText(row.cost, labels.maskedCell)}
                  </Text>
                  <Text style={[s.cellSpread, s.tableText]}>{row.dates}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
      </BrandedPage>

      {/* 8. Method note (half a page) and the pre-signing checklist. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodTitle}
          number={num("method")}
          onRenderPage={resolve("method")}
        >
          {labels.methodLines.map((line) => (
            <Text key={line} style={s.para}>
              {line}
            </Text>
          ))}
          <Text style={s.subHeading}>{labels.checklistTitle}</Text>
          {labels.checklistRows.map((row) => (
            <View key={row.label} style={s.row} wrap={false}>
              <Text style={[{ flex: 4 }, s.tableText]}>{row.label}</Text>
              <Text style={[s.cellMoney, s.tableText, s.label]}>
                {row.done ? labels.checklistDone : labels.checklistOpen}
              </Text>
            </View>
          ))}
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}
```

`doc.checklist` is consumed by the export hook when it composes `checklistRows` (Task 11c); the component prints the composed rows so the same booleans can never render two ways.

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- signing-report`; `bunx biome check apps/dashboard/components/pay-mapping/signing-report-doc.tsx apps/dashboard/components/pay-mapping/signing-report-render.test.tsx`
Expected: PASS, no diagnostics. If the eight-page assertion fails, tighten the box or signature spacing (the summary page and the formalities page are the only ones that can grow) rather than loosening the bound.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): render the signing report`

---

### Task 10: The detail appendix document

**Files:**
- Create: `apps/dashboard/components/pay-mapping/detail-appendix-doc.tsx`
- Create: `apps/dashboard/components/pay-mapping/detail-appendix-render.test.tsx`

**Interfaces:**
- Consumes: `DetailAppendixDoc` (Task 8), the kit primitives (Task 6).
- Produces: `DetailAppendixLabels`, `DetailAppendixPdf({ doc, labels, pageRefs?, onResolvePage?, onRowPage?, headerBreaks? })`, `APPENDIX_SECTIONS`, `detailAppendixTables(doc): string[][]` (the row-id lists for `computeHeaderBreaks`).

- [ ] **Step 1: Write the failing render test**

Create `apps/dashboard/components/pay-mapping/detail-appendix-render.test.tsx`:

```tsx
import { pdf } from "@react-pdf/renderer"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"
import {
  makeFrozenCriterion,
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import { computeHeaderBreaks } from "@/components/pdf/pdf-table"
import {
  APPENDIX_SECTIONS,
  type DetailAppendixLabels,
  DetailAppendixPdf,
  detailAppendixTables,
} from "./detail-appendix-doc"
import type {
  PayMappingActionWire,
  PayMappingNoteWire,
} from "./pay-mapping-gap-types"
import { assemblePayMappingReport } from "./pay-mapping-report-data"
import { detailAppendixDoc } from "./signing-report-data"

// Eight priced people (4 women, 4 men) in one group, so the medians and
// spread compute through the real engine.
const ROWS = Array.from({ length: 8 }, (_, index) => ({
  personPublicId: `p${index}`,
  displayName: `Person ${index}`,
  erased: false,
  gender: (index < 4 ? "Kvinna" : "Man") as "Kvinna" | "Man",
  roleTitle: "SWE",
  trackKey: "ic",
  seniority: "Senior",
  level: 3,
  basicMonthly: 40000 + index * 2000,
  components: [],
}))

// A builder rather than one const: the pagination regression renders the
// same document again with an action's free text grown past a page.
function buildDoc(problemText = "Unexplained gap") {
  return detailAppendixDoc(
    assemblePayMappingReport({
      run: makeRunDetail({
        status: "completed",
        collaboration: {
          participants: "Union rep",
          description: "Monthly sync",
          date: 1_700_000_000_000,
        },
        frozenMethod: {
          criteria: [
            makeFrozenCriterion({
              name: "Knowledge",
              weightPoints: 4,
              dimensionKey: "competence",
            }),
            makeFrozenCriterion({
              name: "Responsibility",
              weightPoints: 2,
              dimensionKey: "responsibility",
            }),
          ],
          levelRules: [
            { level: 1, minScore: 90 },
            { level: 2, minScore: 80 },
          ],
          zoneProfileRules: [{ zone: "A", minStep: 4 }],
          workingConditions: { status: "active", motivation: "Exposure" },
          approvedAt: 1_690_000_000_000,
        },
        rows: ROWS,
      }),
      gap: makeGapResult({
        equalWork: [
          makeGapGroup({ key: "SWE|3" }),
          makeGapGroup({ key: "QA|4", roleTitle: "QA", level: 4, flag: "ok" }),
        ],
        equivalentWork: [
          makeGapGroup({ key: "3", roleTitle: null, level: 3, flag: "ok" }),
        ],
        womenDominated: [
          {
            key: "Nurse|2",
            roleTitle: "Nurse",
            seniority: null,
            level: 2,
            headcount: 5,
            womenSharePct: 80,
            meanComp: 40000,
            comparisons: [
              {
                key: "Support|3",
                roleTitle: "Support",
                seniority: null,
                level: 3,
                headcount: 4,
                womenSharePct: 25,
                meanComp: 45000,
                diffPct: 12.5,
                diffSek: 5000,
              },
            ],
          },
        ],
        quartiles: [
          { women: 2, men: 0 },
          { women: 1, men: 1 },
          { women: 0, men: 1 },
          { women: 0, men: 2 },
        ],
      }),
      analyses: [
        {
          scope: "equalWork",
          groupKey: "SWE|3",
          comparisonKey: null,
          reasons: ["experience"],
          note: "Documented",
          done: true,
          finding: null,
        },
        {
          scope: "praxis",
          groupKey: "payPolicy",
          comparisonKey: null,
          reasons: [],
          note: "Unclear criteria",
          done: true,
          finding: "found",
        },
      ],
      actions: [
        {
          actionId: "a1" as Id<"payMappingActions">,
          number: 1,
          target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          problem: problemText,
          plannedAction: "Salary review",
          reason: "experience",
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: 42000,
          estimatedCostUnit: "oneOff",
          priority: "high",
          status: "notStarted",
          erased: false,
          createdAt: 1,
        },
        // An erasure-tombstoned person-targeted action (ADR-0027).
        {
          actionId: "a2" as Id<"payMappingActions">,
          number: 2,
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "SWE|3",
            personPublicId: "p1",
          },
          problem: "",
          plannedAction: "",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: 500,
          estimatedCostUnit: "perMonth",
          priority: "medium",
          status: "inProgress",
          erased: true,
          createdAt: 2,
        },
        {
          actionId: "a3" as Id<"payMappingActions">,
          number: 3,
          target: { kind: "praxis", area: "payPolicy" },
          problem: "Managers read the policy differently",
          plannedAction: "Rewrite the pay policy",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: null,
          estimatedCostUnit: null,
          priority: "medium",
          status: "notStarted",
          erased: false,
          createdAt: 3,
        },
      ],
      notes: [
        {
          noteId: "n1" as PayMappingNoteWire["noteId"],
          target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          text: "Discuss at the next samverkan meeting",
          noteType: "discussionNeeded",
          erased: false,
          createdBy: "u1",
          createdByName: "HR Person",
          createdAt: 3,
        },
      ],
      previous: {
        runLabel: "Pay mapping 2025",
        referenceDate: 1_680_000_000_000,
        actions: [
          {
            actionId: "b1" as Id<"payMappingActions">,
            number: 1,
            target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
            problem: "Last year's gap",
            plannedAction: "Adjust",
            reason: null,
            ownerUserId: "u1",
            ownerName: "HR Person",
            plannedDate: 1_690_000_000_000,
            estimatedCost: 1000,
            estimatedCostUnit: "perMonth",
            priority: "low",
            status: "done",
            erased: false,
            createdAt: 1,
          } satisfies PayMappingActionWire,
        ],
        gap: makeGapResult({
          equalWork: [
            makeGapGroup({ key: "SWE|3", metric: { gapPct: 12, gapKr: 12000 } }),
          ],
        }),
      },
      formatters: {
        money: (value) => `${Math.round(value)} kr`,
        pct: (value) => `${value}%`,
        signedPct: (value) => `${value > 0 ? "+" : ""}${value}%`,
        date: (epochMs) => new Date(epochMs).toISOString().slice(0, 10),
        dateTime: (epochMs) => new Date(epochMs).toISOString(),
        costUnitSuffix: (unit) =>
          unit === null || unit === "oneOff" ? "" : `/${unit}`,
      },
      praxisAreaLabel: (area) => `Area ${area}`,
    })
  )
}

const DOC = buildDoc()

const LABELS: DetailAppendixLabels = {
  docTitle: "Detail appendix",
  footer: "Detail appendix",
  identity: {
    docTitle: "Detail appendix",
    organizationName: "Acme AB",
    runLabel: "Pay mapping 2026",
    referenceDateLine: "Reference date 2026-07-01",
    extractedAtLine: "Data extracted 2026-07-01T00:00:00.000Z",
    methodVersionLine: "Method version v2-slice1, model approved 2023-07-22",
    generatedOn: "Generated on 2026-09-03",
    statusTag: "FINAL",
  },
  classification:
    "Internal document. Contains person-near pay data. Every download is logged.",
  contentsTitle: "Contents",
  equalWorkTitle: "Equal work, in full",
  equivalentTitle: "Equivalent work, in full",
  praxisTitle: "Practice, collaboration remarks and actions",
  methodTitle: "Method and calculation basis",
  colGroup: "Group",
  colLevel: "Level",
  colWomen: "Women",
  colMen: "Men",
  colBaseWomen: "Base W",
  colBaseMen: "Base M",
  colBaseGap: "Base gap",
  colTccWomen: "Total W",
  colTccMen: "Total M",
  colTccGapKr: "Gap",
  colTccGapPct: "Gap %",
  colStatus: "Status",
  medianLine: (median) =>
    `Median: women ${median.women ?? "-"}, men ${median.men ?? "-"}, gap ${median.gapPct ?? "-"}`,
  flagLabel: (flag) => flag,
  statusLabel: (status) => status,
  baseDrivenMarker: "*",
  baseDrivenNote: "* flagged on base salary",
  prevYearLine: (gapPct) => `Previous pay mapping: ${gapPct}`,
  reasonsLabel: "Objective reasons",
  noteLabel: "Note",
  actionsLabel: "Actions",
  reasonLabel: (reason) => reason,
  linkedActionLine: (action) =>
    `#${action.number} ${action.ownerName}, ${action.plannedDate}`,
  undocumented: "Not documented yet.",
  levelText: (level) => (level === null ? "-" : String(level)),
  emptyEqualWork: "No groups.",
  reverseTitle: "Groups where women are ahead",
  genderPureTitle: "Single-gender groups",
  genderPureRow: (row) => `${row.label} (level ${row.level}): ${row.count}`,
  wdGroupLine: (group) =>
    `${group.label} (level ${group.level}, ${group.headcount} people, ${group.womenSharePct} women, mean ${group.meanComp}, spread ${group.spread ?? "-"})`,
  colComparator: "Compared group",
  colHeadcount: "Headcount",
  colWomenShare: "Share women",
  colMean: "Avg pay",
  colSpread: "Spread",
  colDiffPct: "Diff %",
  colDiffKr: "Diff",
  noComparators: "No comparators.",
  emptyWomenDominated: "No women-dominated groups.",
  praxisAreaTitle: (key) => `Area ${key}`,
  findingLabel: (finding) =>
    finding === "none" ? "Clear" : finding === "found" ? "Needs review" : "Pending",
  praxisActionLine: (action) =>
    `#${action.number} ${action.plannedAction}, ${action.plannedDate}`,
  previousEvaluationTitle: "Previous actions (Pay mapping 2025)",
  noPreviousActions: "No measures in the previous mapping.",
  collaborationTitle: "Collaboration",
  participantsLabel: "Who takes part?",
  descriptionLabel: "How does it happen?",
  collaborationDateLabel: "Collaboration date",
  notDocumented: "Not yet documented.",
  actionsTitle: "Actions",
  colNumber: "No.",
  colTarget: "Linked to",
  colProblem: "Problem and measure",
  colReason: "Reason",
  colOwner: "Owner",
  colDate: "Date",
  colCost: "Cost",
  colPriority: "Priority",
  colActionStatus: "Status",
  targetKindLabel: (kind) => kind,
  actionStatusLabel: (status) => status,
  priorityLabel: (priority) => priority,
  erasedContent: "Content removed when the person was erased.",
  noActions: "No measures recorded.",
  notesTitle: "Notes",
  noteTypeLabel: (type) => type,
  noNotes: "No notes recorded.",
  criteriaTitle: "Criteria and weights",
  colCriterion: "Criterion",
  colDimension: "Dimension",
  colWeight: "Weight",
  colShare: "Share",
  dimensionLabel: (key) => key,
  pointBudgetLine: "Weight points sum to 6.",
  dimensionSharesTitle: "Share per dimension",
  levelRulesTitle: "Level rules",
  colMinScore: "Min score",
  zoneRulesTitle: "Zone rules",
  zoneRuleLine: (rule) => `Zone ${rule.zone}: at least step ${rule.minStep}`,
  workingConditionsLine: "Working conditions: judged material. Exposure",
  scaleNote: "Criteria are rated on a 1 to 5 scale; steps 2 and 4 are midpoints.",
  measuresNote: "FTE-adjusted monthly amounts in SEK.",
  thresholdsNote: "Flags at 10% and 5%; women-dominated at 60% women.",
  hourlyDefaultLine: "Full-time hours per month: 165.",
  hourlyNote: null,
  coverageNote: "0 singletons, 0 single-gender, 0 reverse.",
  unmaskedNote: "Nothing is masked in this document.",
  maskedCell: "-",
}

describe("DetailAppendixPdf (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(
      <DetailAppendixPdf doc={DOC} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("captures every chapter's page number after the cover, in order", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <DetailAppendixPdf
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    let previous = 1
    for (const id of APPENDIX_SECTIONS) {
      expect(pageRefs[id], id).toBeGreaterThan(1)
      expect(pageRefs[id], id).toBeGreaterThanOrEqual(previous)
      previous = pageRefs[id] ?? 0
    }
  })

  it("flows a page-exceeding action text instead of clipping it (wrap fallback)", async () => {
    const pageCount = async (doc: ReturnType<typeof buildDoc>) => {
      const blob = await pdf(
        <DetailAppendixPdf doc={doc} labels={LABELS} />
      ).toBlob()
      return ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const short = await pageCount(DOC)
    const long = await pageCount(buildDoc("word ".repeat(2400).trim()))
    expect(long).toBeGreaterThan(short + 1)
  })

  it("reports every table row's page so continuation headers can be derived", async () => {
    const rowPages: Record<string, number> = {}
    await pdf(
      <DetailAppendixPdf
        doc={DOC}
        labels={LABELS}
        onRowPage={(id, page) => {
          rowPages[id] = page
        }}
      />
    ).toBlob()
    for (const ids of detailAppendixTables(DOC)) {
      for (const id of ids) expect(rowPages[id], id).toBeGreaterThan(1)
    }
    // A one-page table never breaks.
    expect(computeHeaderBreaks(detailAppendixTables(DOC), rowPages).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bun run test -- detail-appendix-render`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the component**

Create `apps/dashboard/components/pay-mapping/detail-appendix-doc.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer"
import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import type { PayGapFlag } from "@workspace/core"
import {
  BrandedDocument,
  BrandedPage,
  Section,
} from "@/components/pdf/branded-document"
import { type IdentityLabels, IdentityBlock } from "@/components/pdf/identity-block"
import {
  BREAKABLE_ROW_TEXT_LENGTH,
  CapturedText,
  cellText,
  type RowPaginationProps,
  tableStyles as s,
  TocRow,
} from "@/components/pdf/pdf-table"
import type { AnalysisStatus } from "./analysis-status"
import type {
  ActionPriority,
  ActionStatus,
  NoteType,
} from "./pay-mapping-gap-types"
import type {
  ReportGenderPureRow,
  ReportGroupRow,
  ReportLinkedAction,
  ReportMedianText,
  ReportPraxisRow,
  ReportWomenDominatedGroup,
} from "./pay-mapping-report-data"
import type { DetailAppendixDoc } from "./signing-report-data"

// The detail appendix (detaljbilaga, ADR-0030): the complete written
// documentation behind the signing report. Every comparison, group, amount,
// reason, action and the frozen method; nothing masked. Four chapters after
// the cover, each its own page. i18n-free like the rest of the kit.
//
// Page-break protection: a table ROW (figures + meta) is an unbreakable
// unit, and every table re-renders its own header at each page it continues
// onto. The continuation headers come from a MULTI-PASS render: each row
// reports the page it landed on through a render-prop capture (onRowPage),
// the export hook derives which rows start a new page (headerBreaks, from
// computeHeaderBreaks over detailAppendixTables) and re-renders until the
// layout is stable.

export const APPENDIX_SECTIONS = [
  "equalWork",
  "equivalentWork",
  "praxis",
  "method",
] as const

export type DetailAppendixLabels = {
  docTitle: string
  footer: string
  identity: IdentityLabels
  classification: string
  contentsTitle: string
  equalWorkTitle: string
  equivalentTitle: string
  praxisTitle: string
  methodTitle: string
  // The group table.
  colGroup: string
  colLevel: string
  colWomen: string
  colMen: string
  colBaseWomen: string
  colBaseMen: string
  colBaseGap: string
  colTccWomen: string
  colTccMen: string
  colTccGapKr: string
  colTccGapPct: string
  colStatus: string
  medianLine: (median: ReportMedianText) => string
  flagLabel: (flag: PayGapFlag) => string
  statusLabel: (status: AnalysisStatus) => string
  baseDrivenMarker: string
  baseDrivenNote: string
  prevYearLine: (gapPct: string) => string
  reasonsLabel: string
  noteLabel: string
  actionsLabel: string
  reasonLabel: (reason: PayGapReason) => string
  linkedActionLine: (action: ReportLinkedAction) => string
  undocumented: string
  levelText: (level: number | null) => string
  emptyEqualWork: string
  reverseTitle: string
  genderPureTitle: string
  genderPureRow: (row: ReportGenderPureRow) => string
  // Equivalent work.
  wdGroupLine: (group: ReportWomenDominatedGroup) => string
  colComparator: string
  colHeadcount: string
  colWomenShare: string
  colMean: string
  colSpread: string
  colDiffPct: string
  colDiffKr: string
  noComparators: string
  emptyWomenDominated: string
  // Practice, collaboration, actions, notes.
  praxisAreaTitle: (key: PraxisAreaKey) => string
  findingLabel: (finding: "none" | "found" | null) => string
  praxisActionLine: (action: NonNullable<ReportPraxisRow["action"]>) => string
  previousEvaluationTitle: string
  noPreviousActions: string
  collaborationTitle: string
  participantsLabel: string
  descriptionLabel: string
  collaborationDateLabel: string
  notDocumented: string
  actionsTitle: string
  colNumber: string
  colTarget: string
  colProblem: string
  colReason: string
  colOwner: string
  colDate: string
  colCost: string
  colPriority: string
  colActionStatus: string
  targetKindLabel: (kind: "person" | "comparison" | "praxis") => string
  actionStatusLabel: (status: ActionStatus) => string
  priorityLabel: (priority: ActionPriority) => string
  erasedContent: string
  noActions: string
  notesTitle: string
  noteTypeLabel: (type: NoteType) => string
  noNotes: string
  // Method and calculation basis.
  criteriaTitle: string
  colCriterion: string
  colDimension: string
  colWeight: string
  colShare: string
  dimensionLabel: (key: string) => string
  pointBudgetLine: string
  dimensionSharesTitle: string
  levelRulesTitle: string
  colMinScore: string
  zoneRulesTitle: string
  zoneRuleLine: (rule: { zone: string; minStep: number }) => string
  workingConditionsLine: string
  scaleNote: string
  measuresNote: string
  thresholdsNote: string
  hourlyDefaultLine: string
  hourlyNote: string | null
  coverageNote: string
  unmaskedNote: string
  maskedCell: string
}

// The row-id lists every table reports through onRowPage, in document
// order, for computeHeaderBreaks.
export function detailAppendixTables(doc: DetailAppendixDoc): string[][] {
  return [
    doc.equalWork.map((row) => `equalWork:${row.key}`),
    doc.reverseGroups.map((row) => `reverse:${row.key}`),
    ...doc.womenDominated.map((group) =>
      group.comparisons.map((comparison) => `wd:${group.key}:${comparison.key}`)
    ),
    doc.actions.map((action) => `actions:${action.id}`),
    doc.previousEvaluation?.actions.map(
      (action) => `prevActions:${action.id}`
    ) ?? [],
  ]
}

// The reasons, note and cited actions under a group or comparison row.
// Renders nothing when the row carries no documentation and needs none; a
// row with a duty and nothing on file states that openly. Breakable (a long
// note may exceed a page), but it never starts with less than a couple of
// lines of room.
function DocumentationBlock({
  reasons,
  note,
  actions,
  required,
  labels,
}: {
  reasons: PayGapReason[]
  note: string | null
  actions: ReportLinkedAction[]
  required: boolean
  labels: DetailAppendixLabels
}) {
  const empty = reasons.length === 0 && note === null && actions.length === 0
  if (empty && !required) return null
  return (
    <View style={s.docBlock} minPresenceAhead={30}>
      {reasons.length > 0 && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.reasonsLabel}: </Text>
          {reasons.map((reason) => labels.reasonLabel(reason)).join(", ")}
        </Text>
      )}
      {note !== null && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.noteLabel}: </Text>
          {note}
        </Text>
      )}
      {actions.length > 0 && (
        <Text style={s.docText}>
          <Text style={s.docLabel}>{labels.actionsLabel}: </Text>
          {actions.map((action) => labels.linkedActionLine(action)).join("; ")}
        </Text>
      )}
      {empty && required && (
        <Text style={s.docText}>{labels.undocumented}</Text>
      )}
    </View>
  )
}

function GroupTableHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colGroup}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colLevel}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colWomen}</Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colMen}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colBaseWomen}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colBaseMen}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colBaseGap}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colTccWomen}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colTccMen}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>
        {labels.colTccGapKr}
      </Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colTccGapPct}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>{labels.colStatus}</Text>
    </View>
  )
}

function GroupTableRow({
  row,
  labels,
  required,
  pageId,
  onRowPage,
  continuationHeader,
}: {
  row: ReportGroupRow
  labels: DetailAppendixLabels
  required: boolean
  pageId: string
  onRowPage?: (id: string, page: number) => void
  // The re-rendered table header joins the row's unbreakable unit: as a
  // preceding sibling it strands at the previous page's bottom, because
  // minPresenceAhead is silently ignored on a wrapper's first child.
  continuationHeader: boolean
}) {
  const dash = labels.maskedCell
  const labelText = `${row.label}${row.baseDriven ? ` ${labels.baseDrivenMarker}` : ""}`
  return (
    <View>
      {/* The figures row, its median line and its meta lines are ONE
          unbreakable unit: a page break must never split a group's numbers
          from each other. */}
      <View wrap={false}>
        {continuationHeader && <GroupTableHeader labels={labels} />}
        <View style={s.row}>
          <CapturedText
            style={[s.cellGroup, s.tableText]}
            id={pageId}
            onRowPage={onRowPage}
            text={labelText}
          />
          <Text style={[s.cellCount, s.tableText]}>
            {labels.levelText(row.level)}
          </Text>
          <Text style={[s.cellCount, s.tableText]}>{row.womenCount}</Text>
          <Text style={[s.cellCount, s.tableText]}>{row.menCount}</Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.base.womenMean, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.base.menMean, dash)}
          </Text>
          <Text style={[s.cellNum, s.tableText]}>
            {cellText(row.base.gapPct, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.womenMean, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.menMean, dash)}
          </Text>
          <Text style={[s.cellMoney, s.tableText]}>
            {cellText(row.tcc.gapKr, dash)}
          </Text>
          <Text style={[s.cellNum, s.tableText]}>
            {cellText(row.tcc.gapPct, dash)}
          </Text>
          <Text style={[s.cellStatus, s.tableText]}>
            {labels.flagLabel(row.flag)}
          </Text>
        </View>
        <View style={s.docBlock}>
          <Text style={s.medianText}>{labels.medianLine(row.tccMedian)}</Text>
          <Text style={s.medianText}>{labels.statusLabel(row.status)}</Text>
          {row.previousGapPct !== null && (
            <Text style={s.medianText}>
              {labels.prevYearLine(row.previousGapPct)}
            </Text>
          )}
        </View>
      </View>
      <DocumentationBlock
        reasons={row.reasons}
        note={row.note}
        actions={row.actions}
        required={required}
        labels={labels}
      />
    </View>
  )
}

function GroupTable({
  tableId,
  rows,
  labels,
  requiresDocumentation,
  onRowPage,
  headerBreaks,
}: {
  tableId: string
  rows: ReportGroupRow[]
  labels: DetailAppendixLabels
  requiresDocumentation: (row: ReportGroupRow) => boolean
} & RowPaginationProps) {
  return (
    <View>
      <GroupTableHeader labels={labels} />
      {rows.map((row) => (
        <GroupTableRow
          key={row.key}
          row={row}
          labels={labels}
          required={requiresDocumentation(row)}
          pageId={`${tableId}:${row.key}`}
          onRowPage={onRowPage}
          continuationHeader={
            headerBreaks?.has(`${tableId}:${row.key}`) ?? false
          }
        />
      ))}
    </View>
  )
}

function ComparatorHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellGroup, s.label, s.tableText]}>
        {labels.colComparator}
      </Text>
      <Text style={[s.cellCount, s.label, s.tableText]}>{labels.colLevel}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colHeadcount}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>
        {labels.colWomenShare}
      </Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colMean}</Text>
      <Text style={[s.cellSpread, s.label, s.tableText]}>{labels.colSpread}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colDiffPct}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDiffKr}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>{labels.colStatus}</Text>
    </View>
  )
}

function ActionsHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellCount, s.label, s.tableText, { textAlign: "left" }]}>
        {labels.colNumber}
      </Text>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colTarget}</Text>
      <Text style={[s.cellWide, s.label, s.tableText]}>{labels.colProblem}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colOwner}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDate}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colCost}</Text>
      <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colPriority}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colActionStatus}
      </Text>
    </View>
  )
}

function PrevActionsHeader({ labels }: { labels: DetailAppendixLabels }) {
  return (
    <View style={s.headerRow} minPresenceAhead={40}>
      <Text style={[s.cellCount, s.label, s.tableText, { textAlign: "left" }]}>
        {labels.colNumber}
      </Text>
      <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colTarget}</Text>
      <Text style={[s.cellWide, s.label, s.tableText]}>{labels.colProblem}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colDate}</Text>
      <Text style={[s.cellMoney, s.label, s.tableText]}>{labels.colCost}</Text>
      <Text style={[s.cellStatus, s.label, s.tableText]}>
        {labels.colActionStatus}
      </Text>
    </View>
  )
}

export function DetailAppendixPdf({
  doc,
  labels,
  pageRefs,
  onResolvePage,
  onRowPage,
  headerBreaks,
}: {
  doc: DetailAppendixDoc
  labels: DetailAppendixLabels
  pageRefs?: Record<string, number>
  onResolvePage?: (id: string, page: number) => void
} & RowPaginationProps) {
  const resolve = (id: (typeof APPENDIX_SECTIONS)[number]) =>
    onResolvePage ? (page: number) => onResolvePage(id, page) : undefined
  const num = (id: (typeof APPENDIX_SECTIONS)[number]) =>
    String(APPENDIX_SECTIONS.indexOf(id) + 1)
  const dash = labels.maskedCell
  // A flagged group is one the gate requires documentation for (ADR-0012);
  // the appendix states an empty documentation block on those instead of
  // hiding it.
  const requiresDocumentation = (row: ReportGroupRow) => row.flag !== "ok"

  return (
    <BrandedDocument>
      {/* 1. Cover: identity block, classification line, contents. */}
      <BrandedPage footerLeft={labels.footer}>
        <IdentityBlock
          labels={labels.identity}
          classification={labels.classification}
        />
        <View style={s.contents}>
          <Text style={s.contentsTitle}>{labels.contentsTitle}</Text>
          <TocRow
            number={num("equalWork")}
            label={labels.equalWorkTitle}
            page={pageRefs?.equalWork}
          />
          <TocRow
            number={num("equivalentWork")}
            label={labels.equivalentTitle}
            page={pageRefs?.equivalentWork}
          />
          <TocRow
            number={num("praxis")}
            label={labels.praxisTitle}
            page={pageRefs?.praxis}
          />
          <TocRow
            number={num("method")}
            label={labels.methodTitle}
            page={pageRefs?.method}
          />
        </View>
      </BrandedPage>

      {/* 2. Equal work, in full. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equalWorkTitle}
          number={num("equalWork")}
          onRenderPage={resolve("equalWork")}
        >
          {doc.equalWork.length === 0 ? (
            <Text style={s.para}>{labels.emptyEqualWork}</Text>
          ) : (
            <GroupTable
              tableId="equalWork"
              rows={doc.equalWork}
              labels={labels}
              requiresDocumentation={requiresDocumentation}
              onRowPage={onRowPage}
              headerBreaks={headerBreaks}
            />
          )}
          <Text style={s.note}>{labels.baseDrivenNote}</Text>
          {doc.reverseGroups.length > 0 && (
            // Its own page: a second full table squeezed under the main one
            // read as one wall, and its tail spilled anyway.
            <View break>
              <Text style={s.subHeading}>{labels.reverseTitle}</Text>
              <GroupTable
                tableId="reverse"
                rows={doc.reverseGroups}
                labels={labels}
                requiresDocumentation={() => false}
                onRowPage={onRowPage}
                headerBreaks={headerBreaks}
              />
            </View>
          )}
          {doc.genderPureGroups.length > 0 && (
            <View>
              <Text style={s.subHeading} minPresenceAhead={60}>
                {labels.genderPureTitle}
              </Text>
              {doc.genderPureGroups.map((row) => (
                <View key={row.key} style={s.row} wrap={false}>
                  <Text style={s.tableText}>{labels.genderPureRow(row)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
      </BrandedPage>

      {/* 3. Equivalent work, in full: one block per women-dominated group,
          one row per comparison. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.equivalentTitle}
          number={num("equivalentWork")}
          onRenderPage={resolve("equivalentWork")}
        >
          {doc.womenDominated.length === 0 ? (
            <Text style={s.para}>{labels.emptyWomenDominated}</Text>
          ) : (
            doc.womenDominated.map((group) => {
              const [firstComparison, ...restComparisons] = group.comparisons
              // The heading travels atomically with its first content while
              // the unit is BOUNDED; a documented group (unbounded note) turns
              // breakable, because react-pdf draws an oversized wrap={false}
              // block off the page edge and the overflow is silently lost.
              const groupDocumented =
                group.reasons.length > 0 ||
                group.note !== null ||
                group.actions.length > 0
              const comparisonRow = (
                comparison: ReportWomenDominatedGroup["comparisons"][number],
                continuationHeader: boolean
              ) => (
                <View wrap={false}>
                  {continuationHeader && <ComparatorHeader labels={labels} />}
                  <View style={s.row}>
                    <CapturedText
                      style={[s.cellGroup, s.tableText]}
                      id={`wd:${group.key}:${comparison.key}`}
                      onRowPage={onRowPage}
                      text={comparison.label}
                    />
                    <Text style={[s.cellCount, s.tableText]}>
                      {labels.levelText(comparison.level)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {comparison.headcount}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {comparison.womenSharePct}
                    </Text>
                    <Text style={[s.cellMoney, s.tableText]}>
                      {cellText(comparison.meanComp, dash)}
                    </Text>
                    <Text style={[s.cellSpread, s.tableText]}>
                      {cellText(comparison.spread, dash)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {cellText(comparison.diffPct, dash)}
                    </Text>
                    <Text style={[s.cellMoney, s.tableText]}>
                      {cellText(comparison.diffKr, dash)}
                    </Text>
                    <Text style={[s.cellStatus, s.tableText]}>
                      {labels.statusLabel(comparison.status)}
                    </Text>
                  </View>
                </View>
              )
              return (
                <View key={group.key}>
                  <View wrap={groupDocumented}>
                    <Text style={s.groupHeading}>{labels.wdGroupLine(group)}</Text>
                    <DocumentationBlock
                      reasons={group.reasons}
                      note={group.note}
                      actions={group.actions}
                      required={false}
                      labels={labels}
                    />
                    {firstComparison === undefined ? (
                      <Text style={s.note}>{labels.noComparators}</Text>
                    ) : (
                      <View wrap={false}>
                        <ComparatorHeader labels={labels} />
                        {comparisonRow(firstComparison, false)}
                      </View>
                    )}
                  </View>
                  {firstComparison !== undefined && (
                    <>
                      <DocumentationBlock
                        reasons={firstComparison.reasons}
                        note={firstComparison.note}
                        actions={firstComparison.actions}
                        required={true}
                        labels={labels}
                      />
                      {restComparisons.map((comparison) => (
                        <View key={comparison.key}>
                          {comparisonRow(
                            comparison,
                            headerBreaks?.has(
                              `wd:${group.key}:${comparison.key}`
                            ) ?? false
                          )}
                          <DocumentationBlock
                            reasons={comparison.reasons}
                            note={comparison.note}
                            actions={comparison.actions}
                            required={true}
                            labels={labels}
                          />
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )
            })
          )}
        </Section>
      </BrandedPage>

      {/* 4. Practice, collaboration remarks and actions. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.praxisTitle}
          number={num("praxis")}
          onRenderPage={resolve("praxis")}
        >
          {doc.praxis.map((area) => (
            <View key={area.key} wrap={false}>
              <Text style={s.groupHeading}>{labels.praxisAreaTitle(area.key)}</Text>
              <Text style={s.para}>{labels.findingLabel(area.finding)}</Text>
              {area.note !== null && <Text style={s.note}>{area.note}</Text>}
              {area.action !== null && (
                <Text style={s.note}>{labels.praxisActionLine(area.action)}</Text>
              )}
            </View>
          ))}
          {doc.previousEvaluation !== null && (
            <View>
              <Text style={s.groupHeading} minPresenceAhead={60}>
                {labels.previousEvaluationTitle}
              </Text>
              <Text style={s.para}>
                {labels.findingLabel(doc.previousEvaluation.finding)}
              </Text>
              {doc.previousEvaluation.note !== null && (
                <Text style={s.note}>{doc.previousEvaluation.note}</Text>
              )}
              {doc.previousEvaluation.actions.length === 0 ? (
                <Text style={s.note}>{labels.noPreviousActions}</Text>
              ) : (
                <View>
                  <PrevActionsHeader labels={labels} />
                  {doc.previousEvaluation.actions.map((action) => (
                    <View
                      key={action.id}
                      wrap={
                        action.plannedAction.length > BREAKABLE_ROW_TEXT_LENGTH
                      }
                    >
                      {headerBreaks?.has(`prevActions:${action.id}`) && (
                        <PrevActionsHeader labels={labels} />
                      )}
                      <View style={s.row}>
                        <CapturedText
                          style={[s.cellCount, s.tableText, { textAlign: "left" }]}
                          id={`prevActions:${action.id}`}
                          onRowPage={onRowPage}
                          text={`#${action.number}`}
                        />
                        <Text style={[s.cellGroup, s.tableText]}>{action.label}</Text>
                        <Text style={[s.cellWide, s.tableText]}>
                          {action.erased ? labels.erasedContent : action.plannedAction}
                        </Text>
                        <Text style={[s.cellMoney, s.tableText]}>
                          {action.plannedDate}
                        </Text>
                        <Text style={[s.cellMoney, s.tableText]}>
                          {cellText(action.cost, dash)}
                        </Text>
                        <Text style={[s.cellStatus, s.tableText]}>
                          {labels.actionStatusLabel(action.status)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.collaborationTitle}
          </Text>
          {doc.collaboration === null ? (
            <Text style={s.para}>{labels.notDocumented}</Text>
          ) : (
            <View>
              <Text style={s.fieldLabel}>{labels.participantsLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.participants}</Text>
              <Text style={s.fieldLabel}>{labels.descriptionLabel}</Text>
              <Text style={s.fieldValue}>{doc.collaboration.description}</Text>
              <Text style={s.fieldLabel}>{labels.collaborationDateLabel}</Text>
              <Text style={s.fieldValue}>
                {cellText(doc.collaboration.date, dash)}
              </Text>
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.actionsTitle}
          </Text>
          {doc.actions.length === 0 ? (
            <Text style={s.para}>{labels.noActions}</Text>
          ) : (
            <View>
              <ActionsHeader labels={labels} />
              {doc.actions.map((action) => (
                <View
                  key={action.id}
                  wrap={
                    action.problem.length + action.plannedAction.length >
                    BREAKABLE_ROW_TEXT_LENGTH
                  }
                >
                  {headerBreaks?.has(`actions:${action.id}`) && (
                    <ActionsHeader labels={labels} />
                  )}
                  <View style={s.row}>
                    <CapturedText
                      style={[s.cellCount, s.tableText, { textAlign: "left" }]}
                      id={`actions:${action.id}`}
                      onRowPage={onRowPage}
                      text={`#${action.number}`}
                    />
                    <View style={s.cellGroup}>
                      <Text style={s.tableText}>{action.label}</Text>
                      {action.kind !== "group" && (
                        <Text style={s.medianText}>
                          {labels.targetKindLabel(action.kind)}
                        </Text>
                      )}
                    </View>
                    <View style={s.cellWide}>
                      {action.erased ? (
                        <Text style={[s.tableText, { color: "#555" }]}>
                          {labels.erasedContent}
                        </Text>
                      ) : (
                        <>
                          <Text style={s.tableText}>{action.problem}</Text>
                          <Text style={[s.tableText, { color: "#555" }]}>
                            {action.plannedAction}
                          </Text>
                        </>
                      )}
                      {action.reason !== null && (
                        <Text style={[s.tableText, { color: "#555" }]}>
                          {labels.colReason}: {labels.reasonLabel(action.reason)}
                        </Text>
                      )}
                    </View>
                    <Text style={[s.cellMoney, s.tableText]}>{action.ownerName}</Text>
                    <Text style={[s.cellMoney, s.tableText]}>{action.plannedDate}</Text>
                    <Text style={[s.cellMoney, s.tableText]}>
                      {cellText(action.cost, dash)}
                    </Text>
                    <Text style={[s.cellNum, s.tableText]}>
                      {labels.priorityLabel(action.priority)}
                    </Text>
                    <Text style={[s.cellStatus, s.tableText]}>
                      {labels.actionStatusLabel(action.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={s.subHeading} minPresenceAhead={60}>
            {labels.notesTitle}
          </Text>
          {doc.notes.length === 0 ? (
            <Text style={s.para}>{labels.noNotes}</Text>
          ) : (
            doc.notes.map((note) => (
              <View
                key={note.id}
                style={s.row}
                wrap={note.text.length > BREAKABLE_ROW_TEXT_LENGTH}
              >
                <Text style={[s.cellGroup, s.tableText]}>{note.label}</Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {labels.noteTypeLabel(note.noteType)}
                </Text>
                <View style={s.cellWide}>
                  <Text style={s.tableText}>
                    {note.erased ? labels.erasedContent : note.text}
                  </Text>
                  <Text style={[s.tableText, { color: "#555" }]}>
                    {note.authorName}, {note.date}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </BrandedPage>

      {/* 5. Method and calculation basis. */}
      <BrandedPage footerLeft={labels.footer} runningHeader>
        <Section
          title={labels.methodTitle}
          number={num("method")}
          onRenderPage={resolve("method")}
        >
          <View wrap={false}>
            <Text style={s.subHeading}>{labels.criteriaTitle}</Text>
            <View style={s.headerRow}>
              <Text style={[s.cellGroup, s.label, s.tableText]}>
                {labels.colCriterion}
              </Text>
              <Text style={[s.cellMoney, s.label, s.tableText]}>
                {labels.colDimension}
              </Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colWeight}</Text>
              <Text style={[s.cellNum, s.label, s.tableText]}>{labels.colShare}</Text>
            </View>
            {doc.method.criteria.map((criterion) => (
              <View key={criterion.name} style={s.row}>
                <Text style={[s.cellGroup, s.tableText]}>{criterion.name}</Text>
                <Text style={[s.cellMoney, s.tableText]}>
                  {criterion.dimensionKey === null
                    ? dash
                    : labels.dimensionLabel(criterion.dimensionKey)}
                </Text>
                <Text style={[s.cellNum, s.tableText]}>{criterion.weightPoints}</Text>
                <Text style={[s.cellNum, s.tableText]}>{criterion.sharePct}</Text>
              </View>
            ))}
            <Text style={s.note}>{labels.pointBudgetLine}</Text>
          </View>
          {doc.method.dimensionShares.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.dimensionSharesTitle}</Text>
              {doc.method.dimensionShares.map((share) => (
                <View key={share.dimensionKey} style={s.row}>
                  <Text style={[s.cellGroup, s.tableText]}>
                    {labels.dimensionLabel(share.dimensionKey)}
                  </Text>
                  <Text style={[s.cellNum, s.tableText]}>{share.sharePct}</Text>
                </View>
              ))}
            </View>
          )}
          {doc.method.levelRules.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.levelRulesTitle}</Text>
              <View style={s.headerRow}>
                <Text style={[s.cellGroup, s.label, s.tableText]}>{labels.colLevel}</Text>
                <Text style={[s.cellNum, s.label, s.tableText]}>
                  {labels.colMinScore}
                </Text>
              </View>
              {doc.method.levelRules.map((rule) => (
                <View key={rule.level} style={s.row}>
                  <Text style={[s.cellGroup, s.tableText]}>{rule.level}</Text>
                  <Text style={[s.cellNum, s.tableText]}>{rule.minScore}</Text>
                </View>
              ))}
            </View>
          )}
          {doc.method.zoneProfileRules.length > 0 && (
            <View wrap={false}>
              <Text style={s.subHeading}>{labels.zoneRulesTitle}</Text>
              {doc.method.zoneProfileRules.map((rule) => (
                <Text key={rule.zone} style={s.note}>
                  {labels.zoneRuleLine(rule)}
                </Text>
              ))}
            </View>
          )}
          <Text style={s.note}>{labels.workingConditionsLine}</Text>
          <Text style={s.note}>{labels.scaleNote}</Text>
          <Text style={s.note}>{labels.measuresNote}</Text>
          <Text style={s.note}>{labels.thresholdsNote}</Text>
          <Text style={s.note}>{labels.hourlyDefaultLine}</Text>
          {labels.hourlyNote !== null && (
            <Text style={s.note}>{labels.hourlyNote}</Text>
          )}
          <Text style={s.note}>{labels.coverageNote}</Text>
          <Text style={s.note}>{labels.unmaskedNote}</Text>
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}
```

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- detail-appendix`; `bunx biome check apps/dashboard/components/pay-mapping/detail-appendix-doc.tsx apps/dashboard/components/pay-mapping/detail-appendix-render.test.tsx`
Expected: PASS, no diagnostics.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): render the detail appendix`

---

### Task 11a: Backend export events, their labels and the report-level strings

**Files:**
- Modify: `packages/backend/convex/lib/audit.ts`, `packages/backend/convex/lib/auditPayloads.ts`, `packages/backend/convex/payMapping/report.ts`, `packages/backend/convex/payMapping/report.test.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (audit event labels, help texts, `dashboard.payMapping.report` additions, `actions.number`, `review.collaborationDate`)

**Interfaces:**
- Produces: `AUDIT_EVENTS.payMappingSigningReportExported = "payMapping.signingReportExported"`, `AUDIT_EVENTS.payMappingDetailAppendixExported = "payMapping.detailAppendixExported"`; mutations `api.payMapping.report.logPayMappingSigningReportExport({ runId })` and `logPayMappingDetailAppendixExport({ runId })`; the report-level i18n keys Task 11c's surfaces read.
- The retired events, mutations, payload entries, labels and keys STAY in this task: the retired hook and panels still call and read them, and Task 11c deletes everything together with its callers. Old and new coexist for exactly the span of the staged chain.

- [ ] **Step 1: Write the failing backend test**


`packages/backend/convex/payMapping/report.test.ts`: add these tests (the existing report and union tests stay until Task 11c deletes them with their mutations):

```ts
  it("writes the signing report's export-boundary audit row, subject-keyed to the run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(
      api.payMapping.report.logPayMappingSigningReportExport,
      { orgId, runId }
    )

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.signingReportExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    // Marker payload only: the run id, nothing else (no document content).
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("writes the detail appendix's own audit row at the same boundary", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    await asHr.mutation(
      api.payMapping.report.logPayMappingDetailAppendixExport,
      { orgId, runId }
    )

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.detailAppendixExported")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subject).toEqual({ kind: "payMappingRun", id: runId })
    expect(audits[0]?.payload).toEqual({ runId })
  })

  it("rejects a detail appendix export for a run id from another org", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr2@other.se", name: "Other HR", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })

    await expect(
      asOther.mutation(
        api.payMapping.report.logPayMappingDetailAppendixExport,
        { orgId: otherOrg, runId }
      )
    ).rejects.toThrow(/errors.notFound/)
  })
```

The existing `rejects a run id from another org` test keeps calling the retired mutation until Task 11c deletes both.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bun run test -- payMapping/report.test.ts`
Expected: FAIL (the two new mutations do not exist).

- [ ] **Step 3: Backend events and mutations**

`packages/backend/convex/lib/audit.ts`: in `AUDIT_EVENTS` add, after `payMappingArchiveExported`, `payMappingSigningReportExported: "payMapping.signingReportExported",` and `payMappingDetailAppendixExported: "payMapping.detailAppendixExported",` (the retired `payMappingReportExported` and `payMappingUnionReportExported` stay until Task 11c). In `AUDIT_SUBJECTS` add two entries with the same `payMappingRun` deriver as `payMapping.archiveExported`, keyed `"payMapping.signingReportExported"` and `"payMapping.detailAppendixExported"`.

`packages/backend/convex/lib/auditPayloads.ts`: add after the `payMapping.archiveExported` entry (the retired two stay until Task 11c):

```ts
  // The export boundary (ADR-0011 p.3): the trail records THAT a document
  // left the system, keyed to its run, with its own event kind per document
  // so the trail says WHICH one. Pure marker payload: the document's
  // contents are the frozen run itself. The detail appendix is unmasked
  // and downloadable by every member; this row is its only control.
  "payMapping.signingReportExported": { runId: string }
  "payMapping.detailAppendixExported": { runId: string }
```

`packages/backend/convex/payMapping/report.ts`: add after `logPayMappingArchiveExport` (the retired `logPayMappingReportExport` and `logPayMappingUnionReportExport` stay until Task 11c deletes them with their callers):

```ts
// The export boundary's log (ADR-0011 p.3): a document export is recorded
// in the audit trail at the moment the document leaves the system. The
// client calls this BEFORE handing the generated PDF to the browser, so a
// download without a trail row cannot happen; the row is this mutation's
// only write. Both a draft (active run) and a final (completed run) export
// are loggable: the statutory duty is on the boundary, not on the document's
// maturity.
export const logPayMappingSigningReportExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    // Org isolation: a run id from another tenant reads as absent.
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingSigningReportExported,
      payload: { runId },
    })
    return null
  },
})

// The detail appendix is unmasked (every group, every amount) and available
// to every organization member (ADR-0030): this row is the control. Same
// rule, its own event kind.
export const logPayMappingDetailAppendixExport = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingDetailAppendixExported,
      payload: { runId },
    })
    return null
  },
})
```

(`logPayMappingMetricsExport` and `logPayMappingArchiveExport` stay; update the archive comment's "the statutory PDF" to "the signing report, the detail appendix".)

- [ ] **Step 4: The i18n strings**

In `packages/i18n/messages/en.json`:

`dashboard.auditLog.events`: add `"payMappingSigningReportExported": "Signing report exported"` and `"payMappingDetailAppendixExported": "Detail appendix exported"` after `payMappingArchiveExported` (the retired `payMappingReportExported` and `payMappingUnionReportExported` labels stay until Task 11c).
sv: `"payMappingSigningReportExported": "Signeringsrapport exporterad"`, `"payMappingDetailAppendixExported": "Detaljbilaga exporterad"`. nb: `"Signeringsrapport eksportert"`, `"Detaljvedlegg eksportert"`. da: `"Signeringsrapport eksporteret"`, `"Detaljebilag eksporteret"`. fi: `"Allekirjoitusraportti viety"`, `"Yksityiskohtaliite viety"`.

`dashboard.help`: add (the retired `payMappingReportLabel`, `payMappingReportBody`, `unionReportLabel` and `unionReportBody` stay until Task 11c)

en:
```json
      "signingReportLabel": "What is the signing report?",
      "signingReportBody": "The document the employer and the union parties sign: aggregates, statuses and the action plan, never a group's amount. Draft until the pay mapping is completed.",
      "detailAppendixLabel": "What is the detail appendix?",
      "detailAppendixBody": "The complete written documentation: every group, amount, reason and action, unmasked. Every download is recorded in the audit log.",
```
sv:
```json
      "signingReportLabel": "Vad är signeringsrapporten?",
      "signingReportBody": "Dokumentet som arbetsgivaren och de fackliga parterna signerar: aggregat, statusar och handlingsplan, aldrig en grupps belopp. Utkast tills kartläggningen är slutförd.",
      "detailAppendixLabel": "Vad är detaljbilagan?",
      "detailAppendixBody": "Den fullständiga skriftliga dokumentationen: varje grupp, belopp, skäl och åtgärd, omaskerat. Varje nedladdning registreras i revisionsloggen.",
```
nb:
```json
      "signingReportLabel": "Hva er signeringsrapporten?",
      "signingReportBody": "Dokumentet arbeidsgiveren og fagforeningspartene signerer: aggregater, statuser og handlingsplan, aldri en gruppes beløp. Utkast inntil kartleggingen er fullført.",
      "detailAppendixLabel": "Hva er detaljvedlegget?",
      "detailAppendixBody": "Den fullstendige skriftlige dokumentasjonen: hver gruppe, hvert beløp, hver grunn og hvert tiltak, umaskert. Hver nedlasting registreres i revisjonsloggen.",
```
da:
```json
      "signingReportLabel": "Hvad er signeringsrapporten?",
      "signingReportBody": "Dokumentet, som arbejdsgiveren og fagforeningsparterne underskriver: aggregater, statusser og handlingsplan, aldrig en gruppes beløb. Udkast, indtil kortlægningen er afsluttet.",
      "detailAppendixLabel": "Hvad er detaljebilaget?",
      "detailAppendixBody": "Den fuldstændige skriftlige dokumentation: hver gruppe, hvert beløb, hver grund og hvert tiltag, umaskeret. Hver download registreres i revisionsloggen.",
```
fi:
```json
      "signingReportLabel": "Mikä on allekirjoitusraportti?",
      "signingReportBody": "Asiakirja, jonka työnantaja ja ammattiliitto-osapuolet allekirjoittavat: kokonaisluvut, tilat ja toimenpideohjelma, ei koskaan ryhmän summaa. Luonnos, kunnes kartoitus on valmis.",
      "detailAppendixLabel": "Mikä on yksityiskohtaliite?",
      "detailAppendixBody": "Täydellinen kirjallinen dokumentaatio: jokainen ryhmä, summa, peruste ja toimenpide peittämättä. Jokainen lataus kirjataan lokiin.",
```
(Every body above is under its cap; check the lengths with `node -e 'console.log("...".length)'` after pasting.)

`dashboard.payMapping.report`: add (en) (the retired `docTitle`, `docDescription`, `downloadReport`, `downloadReportItem` and every `union*` key stay until Task 11c):

```json
      "signingTitle": "Signing report",
      "signingDescription": "The document for collaboration and signing: aggregates, statuses and the action plan (PDF).",
      "downloadSigning": "Download signing report",
      "downloadSigningItem": "Signing report (PDF)",
      "detailTitle": "Detail appendix",
      "detailDescription": "The complete written documentation, unmasked; every download is logged (PDF).",
      "downloadDetail": "Download detail appendix",
      "downloadDetailItem": "Detail appendix (PDF)",
      "extractedAtLine": "Data extracted {dateTime}",
      "methodVersionLine": "Method version {version}, model approved {date}",
      "methodVersionUnapproved": "Method version {version}",
```

and change `archiveDescription` to `"The signing report, the detail appendix and the key figures in one package for archiving, with checksums (ZIP)."` and `archiveNotice` to `"Archive package for the statutory pay-mapping documentation (Swedish Discrimination Act ch. 3 §§ 8-14): the signing report, the detail appendix and the key-figures workbook. The manifest lists the package's files with SHA-256 checksums so their integrity can be verified. Keep the package for at least five years."`.

(The en language-purity test denylists the bare word "samverkan"; every en string above says "collaboration".)

sv:
```json
      "signingTitle": "Signeringsrapport",
      "signingDescription": "Dokumentet för samverkan och signering: aggregat, statusar och handlingsplan (PDF).",
      "downloadSigning": "Ladda ner signeringsrapport",
      "downloadSigningItem": "Signeringsrapport (PDF)",
      "detailTitle": "Detaljbilaga",
      "detailDescription": "Den fullständiga skriftliga dokumentationen, omaskerad; varje nedladdning loggas (PDF).",
      "downloadDetail": "Ladda ner detaljbilaga",
      "downloadDetailItem": "Detaljbilaga (PDF)",
      "extractedAtLine": "Data uttagna {dateTime}",
      "methodVersionLine": "Metodversion {version}, modellen godkänd {date}",
      "methodVersionUnapproved": "Metodversion {version}",
```
with `archiveDescription`: `"Signeringsrapporten, detaljbilagan och nyckeltalen i ett paket för arkivering, med kontrollsummor (ZIP)."` and `archiveNotice`: `"Arkivpaket för den lagstadgade lönekartläggningsdokumentationen (diskrimineringslagen 3 kap. 8-14 §§): signeringsrapporten, detaljbilagan och nyckeltalsarbetsboken. Manifestet anger paketets filer med SHA-256-kontrollsummor så att innehållet kan verifieras. Bevara paketet i minst fem år."`.

nb (same keys; `archiveDescription`: `"Signeringsrapporten, detaljvedlegget og nøkkeltallene i én pakke for arkivering, med kontrollsummer (ZIP)."`; `archiveNotice`: `"Arkivpakke for den lovpålagte lønnskartleggingsdokumentasjonen (diskrimineringsloven 3 kap. 8-14 §§): signeringsrapporten, detaljvedlegget og nøkkeltallsarbeidsboken. Manifestet lister pakkens filer med SHA-256-kontrollsummer slik at innholdet kan verifiseres. Oppbevar pakken i minst fem år."`):

```json
      "signingTitle": "Signeringsrapport",
      "signingDescription": "Dokumentet for samarbeid og signering: aggregater, statuser og handlingsplan (PDF).",
      "downloadSigning": "Last ned signeringsrapport",
      "downloadSigningItem": "Signeringsrapport (PDF)",
      "detailTitle": "Detaljvedlegg",
      "detailDescription": "Den fullstendige skriftlige dokumentasjonen, umaskert; hver nedlasting logges (PDF).",
      "downloadDetail": "Last ned detaljvedlegg",
      "downloadDetailItem": "Detaljvedlegg (PDF)",
      "extractedAtLine": "Data hentet ut {dateTime}",
      "methodVersionLine": "Metodeversjon {version}, modellen godkjent {date}",
      "methodVersionUnapproved": "Metodeversjon {version}",
```

da (`archiveDescription`: `"Signeringsrapporten, detaljebilaget og nøgletallene i én pakke til arkivering, med kontrolsummer (ZIP)."`; `archiveNotice`: `"Arkivpakke til den lovpligtige lønkortlægningsdokumentation (diskrimineringsloven kap. 3 §§ 8-14): signeringsrapporten, detaljebilaget og nøgletalsarbejdsbogen. Manifestet angiver pakkens filer med SHA-256-kontrolsummer, så indholdet kan verificeres. Opbevar pakken i mindst fem år."`):

```json
      "signingTitle": "Signeringsrapport",
      "signingDescription": "Dokumentet til samarbejde og underskrift: aggregater, statusser og handlingsplan (PDF).",
      "downloadSigning": "Hent signeringsrapport",
      "downloadSigningItem": "Signeringsrapport (PDF)",
      "detailTitle": "Detaljebilag",
      "detailDescription": "Den fuldstændige skriftlige dokumentation, umaskeret; hver download logges (PDF).",
      "downloadDetail": "Hent detaljebilag",
      "downloadDetailItem": "Detaljebilag (PDF)",
      "extractedAtLine": "Data udtrukket {dateTime}",
      "methodVersionLine": "Metodeversion {version}, modellen godkendt {date}",
      "methodVersionUnapproved": "Metodeversion {version}",
```

fi (`archiveDescription`: `"Allekirjoitusraportti, yksityiskohtaliite ja tunnusluvut yhdessä paketissa arkistointia varten, tarkistussummineen (ZIP)."`; `archiveNotice`: `"Arkistopaketti lakisääteiselle palkkakartoitusdokumentaatiolle (Ruotsin syrjintälaki 3 luku 8-14 §): allekirjoitusraportti, yksityiskohtaliite ja tunnuslukutyökirja. Manifesti luettelee paketin tiedostot SHA-256-tarkistussummineen, jotta sisältö voidaan todentaa. Säilytä paketti vähintään viisi vuotta."`):

```json
      "signingTitle": "Allekirjoitusraportti",
      "signingDescription": "Asiakirja yhteistoimintaan ja allekirjoitukseen: kokonaisluvut, tilat ja toimenpideohjelma (PDF).",
      "downloadSigning": "Lataa allekirjoitusraportti",
      "downloadSigningItem": "Allekirjoitusraportti (PDF)",
      "detailTitle": "Yksityiskohtaliite",
      "detailDescription": "Täydellinen kirjallinen dokumentaatio peittämättä; jokainen lataus kirjataan lokiin (PDF).",
      "downloadDetail": "Lataa yksityiskohtaliite",
      "downloadDetailItem": "Yksityiskohtaliite (PDF)",
      "extractedAtLine": "Tiedot poimittu {dateTime}",
      "methodVersionLine": "Menetelmäversio {version}, malli hyväksytty {date}",
      "methodVersionUnapproved": "Menetelmäversio {version}",
```

`dashboard.payMapping.actions`: add `"number": "No."` (sv `"Nr"`, nb `"Nr."`, da `"Nr."`, fi `"Nro"`).

Run `cd packages/i18n && bun run test` after every file.

- [ ] **Step 5: Run everything**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping/report.test.ts lib/audit.test.ts`; `cd packages/i18n && bun run test`; `cd apps/dashboard && bunx tsc --noEmit && bun run test -- audit-labels`; `bunx biome check packages/backend/convex packages/i18n/messages`
Expected: PASS. Both the retired and the new event labels exist, so the orphan-label test passes; the dashboard still compiles against the retired hook.

- [ ] **Step 6: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): add the signing report and detail appendix export events`

---

### Task 11b: The signing report and detail appendix strings in every locale

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (the `dashboard.payMapping.signingReport` and `dashboard.payMapping.detailAppendix` namespaces)

**Interfaces:**
- Produces: every key the export hook reads through `useTranslations("dashboard.payMapping.signingReport")` and `useTranslations("dashboard.payMapping.detailAppendix")` in Task 11c, in all five locales, at production quality (no locale is "the same keys translated": every string below is the string that ships).

- [ ] **Step 1: Write the two namespaces in every locale**

New namespace `dashboard.payMapping.signingReport` (en), placed after `analysisStatus`:

```json
    "signingReport": {
      "docTitle": "Signing report",
      "formalitiesTitle": "Formalities and signing",
      "collaborationDateLine": "Collaboration date: {date}",
      "collaborationDateMissing": "Collaboration date: not recorded",
      "appendixReference": "The detailed comparisons and the basis for every figure in this report are in the detail appendix, held by the organization's HR function and available to the collaboration parties on request.",
      "signatureEmployer": "For the employer",
      "signatureUnion": "For the union party",
      "signatureName": "Name",
      "signatureSignature": "Signature",
      "signaturePlace": "Place",
      "signatureDate": "Date",
      "summaryTitle": "Summary and result picture",
      "boxPayPosition": "Overall pay position",
      "payPositionMedian": "Women's median pay as a share of men's",
      "payPositionMean": "Women's average pay as a share of men's",
      "boxRepresentation": "Representation",
      "representationRow": "{share} women",
      "boxEqualWork": "Equal work",
      "boxEquivalentWork": "Equivalent work",
      "groupsCompared": "Groups compared",
      "assessmentsCompleted": "Assessments completed",
      "countOf": "{done} of {total}",
      "objectiveReasons": "Objective reasons documented",
      "actionsDecided": "Actions decided",
      "insufficientBasis": "Groups with insufficient basis for broad reporting",
      "wdInScope": "Women-dominated groups in scope",
      "relevantComparisons": "Relevant comparisons",
      "completed": "Completed",
      "stateSentence": "{groups, plural, one {# equal-work group} other {# equal-work groups}} and {comparisons, plural, one {# equivalent-work comparison} other {# equivalent-work comparisons}} are in scope; {open, plural, =0 {none is} one {# is} other {# are}} still under analysis.",
      "nextStepOpen": "Next step: complete the open analyses before signing.",
      "nextStepActions": "Next step: {count, plural, one {# action is} other {# actions are}} in progress and followed up in the action plan.",
      "nextStepDone": "Next step: sign the report; the action plan is followed up in the coming pay mappings.",
      "scopeTitle": "Scope, method and confidentiality",
      "scopeReferenceDate": "Reference date",
      "scopePopulation": "Population",
      "populationValue": "{total, plural, one {# person} other {# people}} ({women} women, {men} men), {priced} with a recorded salary",
      "scopePayElements": "Pay elements",
      "payElementsValue": "Base salary plus recorded pay components as total compensation, FTE-adjusted monthly amounts; hourly pay converted to full-time-equivalent monthly pay.",
      "scopeExclusions": "Exclusions",
      "exclusionsValue": "{withoutPay, plural, one {# person} other {# people}} without a recorded salary; {singletons, plural, one {# single-person group} other {# single-person groups}} and {genderPure, plural, one {# single-gender group} other {# single-gender groups}} without a within-group comparison.",
      "confidentialityNote": "Small groups are masked in this document but analysed, and shown in full in the detail appendix. {count, plural, =0 {No group has} one {# group has} other {# groups have}} insufficient basis for broad reporting.",
      "praxisTitle": "Provisions, practice and collaboration",
      "colArea": "Area",
      "colConclusion": "Conclusion",
      "colFollowUp": "Action or follow-up",
      "conclusionClear": "Clear",
      "conclusionReview": "Needs review",
      "conclusionPending": "Pending",
      "praxisAction": "#{number} {action}, {date}",
      "collaborationRow": "Collaboration",
      "collaborationPerformed": "Performed",
      "collaborationInProgress": "In progress",
      "equalWorkTitle": "Equal work",
      "equalWorkConclusion": "Every relevant difference has one of four statuses: no action needed, objective reason documented, action decided, or further analysis. Results are symmetric regardless of which gender is paid more.",
      "equivalentTitle": "Equivalent work",
      "chainLine": "Role evaluation, women-dominated group, relevant higher-paid comparison group, assessment, and then action or close.",
      "actionPlanTitle": "Action plan and follow-up",
      "colObservation": "Observation",
      "colActions": "Actions",
      "colStatusSplit": "Status",
      "colDates": "Planned",
      "areaEqualWork": "Equal work",
      "areaEquivalentWork": "Equivalent work",
      "areaPraxis": "Practice",
      "observationEqualWork": "{count, plural, one {# group requiring assessment} other {# groups requiring assessment}}",
      "observationEquivalentWork": "{count, plural, one {# comparison} other {# comparisons}}",
      "observationPraxis": "{count, plural, one {# area with a finding} other {# areas with a finding}}",
      "statusSplit": "{notStarted} not started, {inProgress} in progress, {done} done",
      "dateRange": "{earliest} to {latest}",
      "methodTitle": "Method note",
      "methodEqualWork": "Equal work is the same role at the same level.",
      "methodEquivalentWork": "Equivalent work is the documented gender-neutral evaluation of demands, frozen with this pay mapping: {criteria}.",
      "criterionWithWeight": "{name} ({points})",
      "methodPayElements": "Pay elements: base salary and recorded pay components, FTE-adjusted monthly amounts in {currency}.",
      "checklistTitle": "Before signing",
      "checkAssessed": "All comparisons requiring documentation are assessed",
      "checkLinked": "Reasons or actions are linked to every relevant difference",
      "checkCollaboration": "Collaboration is documented",
      "checkSameVersion": "Both documents derive from the same frozen version",
      "checklistDone": "Done",
      "checklistOpen": "Open"
    },
```

sv:

```json
    "signingReport": {
      "docTitle": "Signeringsrapport",
      "formalitiesTitle": "Formalia och signering",
      "collaborationDateLine": "Samverkansdatum: {date}",
      "collaborationDateMissing": "Samverkansdatum: ej angivet",
      "appendixReference": "De detaljerade jämförelserna och underlaget till varje siffra i den här rapporten finns i detaljbilagan, som förvaras av organisationens HR-funktion och lämnas till samverkansparterna på begäran.",
      "signatureEmployer": "För arbetsgivaren",
      "signatureUnion": "För den fackliga parten",
      "signatureName": "Namn",
      "signatureSignature": "Underskrift",
      "signaturePlace": "Ort",
      "signatureDate": "Datum",
      "summaryTitle": "Sammanfattning och resultatbild",
      "boxPayPosition": "Löneläget totalt",
      "payPositionMedian": "Kvinnors medianlön i procent av männens",
      "payPositionMean": "Kvinnors medellön i procent av männens",
      "boxRepresentation": "Representation",
      "representationRow": "{share} kvinnor",
      "boxEqualWork": "Lika arbete",
      "boxEquivalentWork": "Likvärdigt arbete",
      "groupsCompared": "Jämförda grupper",
      "assessmentsCompleted": "Bedömningar klara",
      "countOf": "{done} av {total}",
      "objectiveReasons": "Sakliga skäl dokumenterade",
      "actionsDecided": "Åtgärder beslutade",
      "insufficientBasis": "Grupper med otillräckligt underlag för bred redovisning",
      "wdInScope": "Kvinnodominerade grupper i omfånget",
      "relevantComparisons": "Relevanta jämförelser",
      "completed": "Klara",
      "stateSentence": "{groups, plural, one {# grupp med lika arbete} other {# grupper med lika arbete}} och {comparisons, plural, one {# jämförelse av likvärdigt arbete} other {# jämförelser av likvärdigt arbete}} ingår; {open, plural, =0 {ingen är} one {# är} other {# är}} fortfarande under analys.",
      "nextStepOpen": "Nästa steg: slutför de öppna analyserna före signering.",
      "nextStepActions": "Nästa steg: {count, plural, one {# åtgärd pågår} other {# åtgärder pågår}} och följs upp i handlingsplanen.",
      "nextStepDone": "Nästa steg: signera rapporten; handlingsplanen följs upp i kommande lönekartläggningar.",
      "scopeTitle": "Omfång, metod och sekretess",
      "scopeReferenceDate": "Referensdatum",
      "scopePopulation": "Population",
      "populationValue": "{total, plural, one {# person} other {# personer}} ({women} kvinnor, {men} män), {priced} med registrerad lön",
      "scopePayElements": "Lönedelar",
      "payElementsValue": "Grundlön plus registrerade lönekomponenter som total ersättning, FTE-justerade månadsbelopp; timlön omräknad till heltidsekvivalent månadslön.",
      "scopeExclusions": "Undantag",
      "exclusionsValue": "{withoutPay, plural, one {# person} other {# personer}} utan registrerad lön; {singletons, plural, one {# enpersonsgrupp} other {# enpersonsgrupper}} och {genderPure, plural, one {# enkönad grupp} other {# enkönade grupper}} utan jämförelse inom grupp.",
      "confidentialityNote": "Små grupper maskeras i det här dokumentet men är analyserade och redovisas i sin helhet i detaljbilagan. {count, plural, =0 {Ingen grupp har} one {# grupp har} other {# grupper har}} otillräckligt underlag för bred redovisning.",
      "praxisTitle": "Bestämmelser, praxis och samverkan",
      "colArea": "Område",
      "colConclusion": "Slutsats",
      "colFollowUp": "Åtgärd eller uppföljning",
      "conclusionClear": "Utan anmärkning",
      "conclusionReview": "Behöver ses över",
      "conclusionPending": "Ej granskat",
      "praxisAction": "#{number} {action}, {date}",
      "collaborationRow": "Samverkan",
      "collaborationPerformed": "Genomförd",
      "collaborationInProgress": "Pågår",
      "equalWorkTitle": "Lika arbete",
      "equalWorkConclusion": "Varje relevant skillnad har en av fyra statusar: ingen åtgärd behövs, sakligt skäl dokumenterat, åtgärd beslutad eller fortsatt analys. Resultaten är symmetriska oavsett vilket kön som har högre lön.",
      "equivalentTitle": "Likvärdigt arbete",
      "chainLine": "Arbetsvärdering, kvinnodominerad grupp, relevant högre betald jämförelsegrupp, bedömning, och därefter åtgärd eller avslut.",
      "actionPlanTitle": "Handlingsplan och uppföljning",
      "colObservation": "Iakttagelse",
      "colActions": "Åtgärder",
      "colStatusSplit": "Status",
      "colDates": "Planerat",
      "areaEqualWork": "Lika arbete",
      "areaEquivalentWork": "Likvärdigt arbete",
      "areaPraxis": "Praxis",
      "observationEqualWork": "{count, plural, one {# grupp som kräver bedömning} other {# grupper som kräver bedömning}}",
      "observationEquivalentWork": "{count, plural, one {# jämförelse} other {# jämförelser}}",
      "observationPraxis": "{count, plural, one {# område med anmärkning} other {# områden med anmärkning}}",
      "statusSplit": "{notStarted} ej påbörjade, {inProgress} pågående, {done} klara",
      "dateRange": "{earliest} till {latest}",
      "methodTitle": "Metodnot",
      "methodEqualWork": "Lika arbete är samma roll på samma nivå.",
      "methodEquivalentWork": "Likvärdigt arbete är den dokumenterade könsneutrala värderingen av kraven, fryst med den här lönekartläggningen: {criteria}.",
      "criterionWithWeight": "{name} ({points})",
      "methodPayElements": "Lönedelar: grundlön och registrerade lönekomponenter, FTE-justerade månadsbelopp i {currency}.",
      "checklistTitle": "Före signering",
      "checkAssessed": "Alla jämförelser som kräver dokumentation är bedömda",
      "checkLinked": "Skäl eller åtgärder är kopplade till varje relevant skillnad",
      "checkCollaboration": "Samverkan är dokumenterad",
      "checkSameVersion": "Båda dokumenten härrör från samma frysta version",
      "checklistDone": "Klart",
      "checklistOpen": "Öppet"
    },
```

nb:

```json
    "signingReport": {
      "docTitle": "Signeringsrapport",
      "formalitiesTitle": "Formalia og signering",
      "collaborationDateLine": "Samarbeidsdato: {date}",
      "collaborationDateMissing": "Samarbeidsdato: ikke registrert",
      "appendixReference": "De detaljerte sammenligningene og grunnlaget for hvert tall i denne rapporten finnes i detaljvedlegget, som oppbevares av organisasjonens HR-funksjon og gis til samarbeidspartene på forespørsel.",
      "signatureEmployer": "For arbeidsgiveren",
      "signatureUnion": "For fagforeningsparten",
      "signatureName": "Navn",
      "signatureSignature": "Underskrift",
      "signaturePlace": "Sted",
      "signatureDate": "Dato",
      "summaryTitle": "Sammendrag og resultatbilde",
      "boxPayPosition": "Samlet lønnsposisjon",
      "payPositionMedian": "Kvinners medianlønn i prosent av menns",
      "payPositionMean": "Kvinners gjennomsnittslønn i prosent av menns",
      "boxRepresentation": "Representasjon",
      "representationRow": "{share} kvinner",
      "boxEqualWork": "Likt arbeid",
      "boxEquivalentWork": "Likeverdig arbeid",
      "groupsCompared": "Sammenlignede grupper",
      "assessmentsCompleted": "Vurderinger fullført",
      "countOf": "{done} av {total}",
      "objectiveReasons": "Saklige grunner dokumentert",
      "actionsDecided": "Tiltak besluttet",
      "insufficientBasis": "Grupper med utilstrekkelig grunnlag for bred rapportering",
      "wdInScope": "Kvinnedominerte grupper i omfanget",
      "relevantComparisons": "Relevante sammenligninger",
      "completed": "Fullført",
      "stateSentence": "{groups, plural, one {# gruppe med likt arbeid} other {# grupper med likt arbeid}} og {comparisons, plural, one {# sammenligning av likeverdig arbeid} other {# sammenligninger av likeverdig arbeid}} inngår; {open, plural, =0 {ingen er} one {# er} other {# er}} fortsatt under analyse.",
      "nextStepOpen": "Neste steg: fullfør de åpne analysene før signering.",
      "nextStepActions": "Neste steg: {count, plural, one {# tiltak pågår} other {# tiltak pågår}} og følges opp i handlingsplanen.",
      "nextStepDone": "Neste steg: signer rapporten; handlingsplanen følges opp i kommende lønnskartlegginger.",
      "scopeTitle": "Omfang, metode og konfidensialitet",
      "scopeReferenceDate": "Referansedato",
      "scopePopulation": "Populasjon",
      "populationValue": "{total, plural, one {# person} other {# personer}} ({women} kvinner, {men} menn), {priced} med registrert lønn",
      "scopePayElements": "Lønnselementer",
      "payElementsValue": "Grunnlønn pluss registrerte lønnskomponenter som total godtgjørelse, FTE-justerte månedsbeløp; timelønn omregnet til heltidsekvivalent månedslønn.",
      "scopeExclusions": "Unntak",
      "exclusionsValue": "{withoutPay, plural, one {# person} other {# personer}} uten registrert lønn; {singletons, plural, one {# enpersonsgruppe} other {# enpersonsgrupper}} og {genderPure, plural, one {# enkjønnet gruppe} other {# enkjønnede grupper}} uten sammenligning innenfor gruppen.",
      "confidentialityNote": "Små grupper maskeres i dette dokumentet, men er analysert og vises i sin helhet i detaljvedlegget. {count, plural, =0 {Ingen gruppe har} one {# gruppe har} other {# grupper har}} utilstrekkelig grunnlag for bred rapportering.",
      "praxisTitle": "Bestemmelser, praksis og samarbeid",
      "colArea": "Område",
      "colConclusion": "Konklusjon",
      "colFollowUp": "Tiltak eller oppfølging",
      "conclusionClear": "Ingen merknad",
      "conclusionReview": "Må gjennomgås",
      "conclusionPending": "Ikke gjennomgått",
      "praxisAction": "#{number} {action}, {date}",
      "collaborationRow": "Samarbeid",
      "collaborationPerformed": "Gjennomført",
      "collaborationInProgress": "Pågår",
      "equalWorkTitle": "Likt arbeid",
      "equalWorkConclusion": "Hver relevant forskjell har én av fire statuser: ingen tiltak nødvendig, saklig grunn dokumentert, tiltak besluttet eller videre analyse. Resultatene er symmetriske uansett hvilket kjønn som har høyest lønn.",
      "equivalentTitle": "Likeverdig arbeid",
      "chainLine": "Arbeidsvurdering, kvinnedominert gruppe, relevant høyere lønnet sammenligningsgruppe, vurdering, og deretter tiltak eller avslutning.",
      "actionPlanTitle": "Handlingsplan og oppfølging",
      "colObservation": "Observasjon",
      "colActions": "Tiltak",
      "colStatusSplit": "Status",
      "colDates": "Planlagt",
      "areaEqualWork": "Likt arbeid",
      "areaEquivalentWork": "Likeverdig arbeid",
      "areaPraxis": "Praksis",
      "observationEqualWork": "{count, plural, one {# gruppe som krever vurdering} other {# grupper som krever vurdering}}",
      "observationEquivalentWork": "{count, plural, one {# sammenligning} other {# sammenligninger}}",
      "observationPraxis": "{count, plural, one {# område med merknad} other {# områder med merknad}}",
      "statusSplit": "{notStarted} ikke påbegynt, {inProgress} pågår, {done} fullført",
      "dateRange": "{earliest} til {latest}",
      "methodTitle": "Metodenotat",
      "methodEqualWork": "Likt arbeid er samme rolle på samme nivå.",
      "methodEquivalentWork": "Likeverdig arbeid er den dokumenterte kjønnsnøytrale vurderingen av kravene, fryst med denne lønnskartleggingen: {criteria}.",
      "criterionWithWeight": "{name} ({points})",
      "methodPayElements": "Lønnselementer: grunnlønn og registrerte lønnskomponenter, FTE-justerte månedsbeløp i {currency}.",
      "checklistTitle": "Før signering",
      "checkAssessed": "Alle sammenligninger som krever dokumentasjon er vurdert",
      "checkLinked": "Grunner eller tiltak er koblet til hver relevant forskjell",
      "checkCollaboration": "Samarbeidet er dokumentert",
      "checkSameVersion": "Begge dokumentene stammer fra samme fryste versjon",
      "checklistDone": "Fullført",
      "checklistOpen": "Åpen"
    },
```

da:

```json
    "signingReport": {
      "docTitle": "Signeringsrapport",
      "formalitiesTitle": "Formalia og underskrift",
      "collaborationDateLine": "Samarbejdsdato: {date}",
      "collaborationDateMissing": "Samarbejdsdato: ikke registreret",
      "appendixReference": "De detaljerede sammenligninger og grundlaget for hvert tal i denne rapport findes i detaljebilaget, som opbevares af organisationens HR-funktion og udleveres til samarbejdsparterne på anmodning.",
      "signatureEmployer": "For arbejdsgiveren",
      "signatureUnion": "For fagforeningsparten",
      "signatureName": "Navn",
      "signatureSignature": "Underskrift",
      "signaturePlace": "Sted",
      "signatureDate": "Dato",
      "summaryTitle": "Sammenfatning og resultatbillede",
      "boxPayPosition": "Samlet lønposition",
      "payPositionMedian": "Kvinders medianløn i procent af mænds",
      "payPositionMean": "Kvinders gennemsnitsløn i procent af mænds",
      "boxRepresentation": "Repræsentation",
      "representationRow": "{share} kvinder",
      "boxEqualWork": "Lige arbejde",
      "boxEquivalentWork": "Ligeværdigt arbejde",
      "groupsCompared": "Sammenlignede grupper",
      "assessmentsCompleted": "Vurderinger afsluttet",
      "countOf": "{done} af {total}",
      "objectiveReasons": "Saglige grunde dokumenteret",
      "actionsDecided": "Tiltag besluttet",
      "insufficientBasis": "Grupper med utilstrækkeligt grundlag for bred rapportering",
      "wdInScope": "Kvindedominerede grupper i omfanget",
      "relevantComparisons": "Relevante sammenligninger",
      "completed": "Afsluttet",
      "stateSentence": "{groups, plural, one {# gruppe med lige arbejde} other {# grupper med lige arbejde}} og {comparisons, plural, one {# sammenligning af ligeværdigt arbejde} other {# sammenligninger af ligeværdigt arbejde}} indgår; {open, plural, =0 {ingen er} one {# er} other {# er}} fortsat under analyse.",
      "nextStepOpen": "Næste skridt: afslut de åbne analyser før underskrift.",
      "nextStepActions": "Næste skridt: {count, plural, one {# tiltag er i gang} other {# tiltag er i gang}} og følges op i handlingsplanen.",
      "nextStepDone": "Næste skridt: underskriv rapporten; handlingsplanen følges op i de kommende lønkortlægninger.",
      "scopeTitle": "Omfang, metode og fortrolighed",
      "scopeReferenceDate": "Referencedato",
      "scopePopulation": "Population",
      "populationValue": "{total, plural, one {# person} other {# personer}} ({women} kvinder, {men} mænd), {priced} med registreret løn",
      "scopePayElements": "Lønelementer",
      "payElementsValue": "Grundløn plus registrerede lønkomponenter som samlet aflønning, FTE-justerede månedsbeløb; timeløn omregnet til fuldtidsækvivalent månedsløn.",
      "scopeExclusions": "Undtagelser",
      "exclusionsValue": "{withoutPay, plural, one {# person} other {# personer}} uden registreret løn; {singletons, plural, one {# enpersonsgruppe} other {# enpersonsgrupper}} og {genderPure, plural, one {# enkønnet gruppe} other {# enkønnede grupper}} uden sammenligning inden for gruppen.",
      "confidentialityNote": "Små grupper maskeres i dette dokument, men er analyseret og vises i deres helhed i detaljebilaget. {count, plural, =0 {Ingen gruppe har} one {# gruppe har} other {# grupper har}} utilstrækkeligt grundlag for bred rapportering.",
      "praxisTitle": "Bestemmelser, praksis og samarbejde",
      "colArea": "Område",
      "colConclusion": "Konklusion",
      "colFollowUp": "Tiltag eller opfølgning",
      "conclusionClear": "Ingen bemærkning",
      "conclusionReview": "Skal gennemgås",
      "conclusionPending": "Ikke gennemgået",
      "praxisAction": "#{number} {action}, {date}",
      "collaborationRow": "Samarbejde",
      "collaborationPerformed": "Gennemført",
      "collaborationInProgress": "I gang",
      "equalWorkTitle": "Lige arbejde",
      "equalWorkConclusion": "Hver relevant forskel har én af fire statusser: intet tiltag nødvendigt, saglig grund dokumenteret, tiltag besluttet eller videre analyse. Resultaterne er symmetriske, uanset hvilket køn der har den højeste løn.",
      "equivalentTitle": "Ligeværdigt arbejde",
      "chainLine": "Jobvurdering, kvindedomineret gruppe, relevant højere lønnet sammenligningsgruppe, vurdering, og derefter tiltag eller afslutning.",
      "actionPlanTitle": "Handlingsplan og opfølgning",
      "colObservation": "Observation",
      "colActions": "Tiltag",
      "colStatusSplit": "Status",
      "colDates": "Planlagt",
      "areaEqualWork": "Lige arbejde",
      "areaEquivalentWork": "Ligeværdigt arbejde",
      "areaPraxis": "Praksis",
      "observationEqualWork": "{count, plural, one {# gruppe, der kræver vurdering} other {# grupper, der kræver vurdering}}",
      "observationEquivalentWork": "{count, plural, one {# sammenligning} other {# sammenligninger}}",
      "observationPraxis": "{count, plural, one {# område med bemærkning} other {# områder med bemærkning}}",
      "statusSplit": "{notStarted} ikke påbegyndt, {inProgress} i gang, {done} afsluttet",
      "dateRange": "{earliest} til {latest}",
      "methodTitle": "Metodenote",
      "methodEqualWork": "Lige arbejde er samme rolle på samme niveau.",
      "methodEquivalentWork": "Ligeværdigt arbejde er den dokumenterede kønsneutrale vurdering af kravene, frosset sammen med denne lønkortlægning: {criteria}.",
      "criterionWithWeight": "{name} ({points})",
      "methodPayElements": "Lønelementer: grundløn og registrerede lønkomponenter, FTE-justerede månedsbeløb i {currency}.",
      "checklistTitle": "Før underskrift",
      "checkAssessed": "Alle sammenligninger, der kræver dokumentation, er vurderet",
      "checkLinked": "Grunde eller tiltag er koblet til hver relevant forskel",
      "checkCollaboration": "Samarbejdet er dokumenteret",
      "checkSameVersion": "Begge dokumenter stammer fra samme frosne version",
      "checklistDone": "Afsluttet",
      "checklistOpen": "Åben"
    },
```

fi:

```json
    "signingReport": {
      "docTitle": "Allekirjoitusraportti",
      "formalitiesTitle": "Muodollisuudet ja allekirjoitus",
      "collaborationDateLine": "Yhteistoiminnan päivä: {date}",
      "collaborationDateMissing": "Yhteistoiminnan päivä: ei kirjattu",
      "appendixReference": "Yksityiskohtaiset vertailut ja tämän raportin jokaisen luvun perusteet ovat yksityiskohtaliitteessä, jota organisaation HR-toiminto säilyttää ja joka annetaan yhteistoimintaosapuolille pyynnöstä.",
      "signatureEmployer": "Työnantajan puolesta",
      "signatureUnion": "Ammattiliitto-osapuolen puolesta",
      "signatureName": "Nimi",
      "signatureSignature": "Allekirjoitus",
      "signaturePlace": "Paikka",
      "signatureDate": "Päivämäärä",
      "summaryTitle": "Yhteenveto ja tuloskuva",
      "boxPayPosition": "Palkka-asema kokonaisuutena",
      "payPositionMedian": "Naisten mediaanipalkka prosentteina miesten palkasta",
      "payPositionMean": "Naisten keskipalkka prosentteina miesten palkasta",
      "boxRepresentation": "Edustus",
      "representationRow": "{share} naisia",
      "boxEqualWork": "Sama työ",
      "boxEquivalentWork": "Samanarvoinen työ",
      "groupsCompared": "Vertaillut ryhmät",
      "assessmentsCompleted": "Arvioinnit valmiit",
      "countOf": "{done} / {total}",
      "objectiveReasons": "Asialliset perusteet dokumentoitu",
      "actionsDecided": "Toimenpiteet päätetty",
      "insufficientBasis": "Ryhmät, joilla on riittämätön pohja laajaan raportointiin",
      "wdInScope": "Naisvaltaiset ryhmät laajuudessa",
      "relevantComparisons": "Relevantit vertailut",
      "completed": "Valmiit",
      "stateSentence": "Laajuuteen kuuluu {groups, plural, one {# samaa työtä tekevä ryhmä} other {# samaa työtä tekevää ryhmää}} ja {comparisons, plural, one {# samanarvoisen työn vertailu} other {# samanarvoisen työn vertailua}}; {open, plural, =0 {yksikään ei ole} one {# on} other {# on}} yhä analysoitavana.",
      "nextStepOpen": "Seuraava askel: vie avoimet analyysit loppuun ennen allekirjoitusta.",
      "nextStepActions": "Seuraava askel: {count, plural, one {# toimenpide on} other {# toimenpidettä on}} käynnissä, ja niitä seurataan toimenpideohjelmassa.",
      "nextStepDone": "Seuraava askel: allekirjoita raportti; toimenpideohjelmaa seurataan tulevissa palkkakartoituksissa.",
      "scopeTitle": "Laajuus, menetelmä ja luottamuksellisuus",
      "scopeReferenceDate": "Viitepäivä",
      "scopePopulation": "Populaatio",
      "populationValue": "{total, plural, one {# henkilö} other {# henkilöä}} ({women} naista, {men} miestä), {priced} kirjatulla palkalla",
      "scopePayElements": "Palkanosat",
      "payElementsValue": "Peruspalkka ja kirjatut palkanosat kokonaiskorvauksena, FTE-korjattuina kuukausisummina; tuntipalkka muunnettuna kokoaikaista vastaavaksi kuukausipalkaksi.",
      "scopeExclusions": "Rajaukset",
      "exclusionsValue": "{withoutPay, plural, one {# henkilö} other {# henkilöä}} ilman kirjattua palkkaa; {singletons, plural, one {# yhden hengen ryhmä} other {# yhden hengen ryhmää}} ja {genderPure, plural, one {# yhden sukupuolen ryhmä} other {# yhden sukupuolen ryhmää}} ilman ryhmän sisäistä vertailua.",
      "confidentialityNote": "Pienet ryhmät peitetään tässä asiakirjassa, mutta ne on analysoitu ja näytetään kokonaisuudessaan yksityiskohtaliitteessä. {count, plural, =0 {Yhdelläkään ryhmällä ei ole} one {# ryhmällä on} other {# ryhmällä on}} riittämätön pohja laajaan raportointiin.",
      "praxisTitle": "Säännöt, käytäntö ja yhteistoiminta",
      "colArea": "Alue",
      "colConclusion": "Johtopäätös",
      "colFollowUp": "Toimenpide tai seuranta",
      "conclusionClear": "Ei huomautuksia",
      "conclusionReview": "Vaatii tarkastelua",
      "conclusionPending": "Ei tarkastettu",
      "praxisAction": "#{number} {action}, {date}",
      "collaborationRow": "Yhteistoiminta",
      "collaborationPerformed": "Toteutettu",
      "collaborationInProgress": "Käynnissä",
      "equalWorkTitle": "Sama työ",
      "equalWorkConclusion": "Jokaisella relevantilla erolla on yksi neljästä tilasta: toimenpidettä ei tarvita, asiallinen peruste dokumentoitu, toimenpide päätetty tai jatkoanalyysi. Tulokset ovat symmetrisiä riippumatta siitä, kummalle sukupuolelle maksetaan enemmän.",
      "equivalentTitle": "Samanarvoinen työ",
      "chainLine": "Työn vaativuuden arviointi, naisvaltainen ryhmä, relevantti paremmin palkattu verrokkiryhmä, arviointi, ja sen jälkeen toimenpide tai päättäminen.",
      "actionPlanTitle": "Toimenpideohjelma ja seuranta",
      "colObservation": "Havainto",
      "colActions": "Toimenpiteet",
      "colStatusSplit": "Tila",
      "colDates": "Suunniteltu",
      "areaEqualWork": "Sama työ",
      "areaEquivalentWork": "Samanarvoinen työ",
      "areaPraxis": "Käytäntö",
      "observationEqualWork": "{count, plural, one {# arviointia vaativa ryhmä} other {# arviointia vaativaa ryhmää}}",
      "observationEquivalentWork": "{count, plural, one {# vertailu} other {# vertailua}}",
      "observationPraxis": "{count, plural, one {# alue, jolla on huomautus} other {# aluetta, joilla on huomautus}}",
      "statusSplit": "{notStarted} aloittamatta, {inProgress} käynnissä, {done} valmis",
      "dateRange": "{earliest} - {latest}",
      "methodTitle": "Menetelmähuomautus",
      "methodEqualWork": "Sama työ on sama rooli samalla vaativuustasolla.",
      "methodEquivalentWork": "Samanarvoinen työ on dokumentoitu sukupuolineutraali vaatimusten arviointi, joka on jäädytetty tämän palkkakartoituksen kanssa: {criteria}.",
      "criterionWithWeight": "{name} ({points})",
      "methodPayElements": "Palkanosat: peruspalkka ja kirjatut palkanosat, FTE-korjatut kuukausisummat valuutassa {currency}.",
      "checklistTitle": "Ennen allekirjoitusta",
      "checkAssessed": "Kaikki dokumentointia vaativat vertailut on arvioitu",
      "checkLinked": "Perusteet tai toimenpiteet on kytketty jokaiseen relevanttiin eroon",
      "checkCollaboration": "Yhteistoiminta on dokumentoitu",
      "checkSameVersion": "Molemmat asiakirjat perustuvat samaan jäädytettyyn versioon",
      "checklistDone": "Valmis",
      "checklistOpen": "Avoin"
    },
```

New namespace `dashboard.payMapping.detailAppendix` (en):

```json
    "detailAppendix": {
      "docTitle": "Detail appendix",
      "classification": "Internal document. Contains person-near pay data. Every download is recorded in the audit log. Intended for the organization's HR function and, on request, the collaboration parties.",
      "equalWorkTitle": "Equal work, in full",
      "equivalentTitle": "Equivalent work, in full",
      "praxisTitle": "Practice, collaboration remarks and actions",
      "methodTitle": "Method and calculation basis",
      "colBaseWomen": "Base W",
      "colBaseMen": "Base M",
      "colBaseGap": "Base gap %",
      "colTccWomen": "Total W",
      "colTccMen": "Total M",
      "colTccGapKr": "Gap",
      "colTccGapPct": "Gap %",
      "medianLine": "Median: women {women}, men {men}, difference {gap}",
      "baseDrivenNote": "Groups marked * are flagged on base salary.",
      "actionsLabel": "Actions",
      "linkedAction": "#{number} {owner}, {date}",
      "praxisAction": "#{number} {action}, {date}",
      "previousEvaluationTitle": "Previous actions ({run}, reference date {date})",
      "colTarget": "Linked to",
      "colDimension": "Dimension",
      "dimensionSharesTitle": "Weight share per dimension",
      "levelRulesTitle": "Level rules",
      "colMinScore": "Minimum weighting",
      "zoneRulesTitle": "Zone profile rules",
      "zoneRule": "Zone {zone}: at least step {step} on every profile criterion.",
      "wcMaterial": "Working conditions: judged material. {motivation}",
      "wcNotMaterial": "Working conditions: tested and found not material. {motivation}",
      "wcNone": "Working conditions: not decided.",
      "scaleNote": "Each criterion is rated on a 1 to 5 scale; steps 2 and 4 count as midpoints between the anchored steps around them.",
      "thresholdsNote": "Status thresholds: a difference over 10% is critical and 5 to 10% elevated (this tool's ordering of attention, not a legal floor); a group counts as women-dominated at 60% women or more.",
      "hourlyDefaultLine": "Full-time hours per month: {hours, number}.",
      "unmaskedNote": "Nothing is masked in this document: every figure the analysis computed is printed."
    },
```

sv:

```json
    "detailAppendix": {
      "docTitle": "Detaljbilaga",
      "classification": "Internt dokument. Innehåller personnära löneuppgifter. Varje nedladdning registreras i revisionsloggen. Avsett för organisationens HR-funktion och, på begäran, samverkansparterna.",
      "equalWorkTitle": "Lika arbete, i sin helhet",
      "equivalentTitle": "Likvärdigt arbete, i sin helhet",
      "praxisTitle": "Praxis, samverkansanteckningar och åtgärder",
      "methodTitle": "Metod och beräkningsunderlag",
      "colBaseWomen": "Grundlön K",
      "colBaseMen": "Grundlön M",
      "colBaseGap": "Grundlön skillnad %",
      "colTccWomen": "Total K",
      "colTccMen": "Total M",
      "colTccGapKr": "Skillnad",
      "colTccGapPct": "Skillnad %",
      "medianLine": "Median: kvinnor {women}, män {men}, skillnad {gap}",
      "baseDrivenNote": "Grupper markerade * flaggas på grundlön.",
      "actionsLabel": "Åtgärder",
      "linkedAction": "#{number} {owner}, {date}",
      "praxisAction": "#{number} {action}, {date}",
      "previousEvaluationTitle": "Tidigare åtgärder ({run}, referensdatum {date})",
      "colTarget": "Kopplad till",
      "colDimension": "Dimension",
      "dimensionSharesTitle": "Viktandel per dimension",
      "levelRulesTitle": "Nivåregler",
      "colMinScore": "Lägsta viktning",
      "zoneRulesTitle": "Zonprofilregler",
      "zoneRule": "Zon {zone}: minst steg {step} på varje profilkriterium.",
      "wcMaterial": "Arbetsförhållanden: bedömda som väsentliga. {motivation}",
      "wcNotMaterial": "Arbetsförhållanden: prövade och bedömda som inte väsentliga. {motivation}",
      "wcNone": "Arbetsförhållanden: inte beslutat.",
      "scaleNote": "Varje kriterium bedöms på en skala 1 till 5; steg 2 och 4 räknas som mellansteg mellan de förankrade stegen omkring dem.",
      "thresholdsNote": "Statuströsklar: en skillnad över 10 % är kritisk och 5 till 10 % förhöjd (verktygets prioritering, ingen rättslig gräns); en grupp räknas som kvinnodominerad vid minst 60 % kvinnor.",
      "hourlyDefaultLine": "Heltidstimmar per månad: {hours, number}.",
      "unmaskedNote": "Inget maskeras i det här dokumentet: varje siffra analysen beräknat skrivs ut."
    },
```

nb:

```json
    "detailAppendix": {
      "docTitle": "Detaljvedlegg",
      "classification": "Internt dokument. Inneholder personnære lønnsopplysninger. Hver nedlasting registreres i revisjonsloggen. Ment for organisasjonens HR-funksjon og, på forespørsel, samarbeidspartene.",
      "equalWorkTitle": "Likt arbeid, i sin helhet",
      "equivalentTitle": "Likeverdig arbeid, i sin helhet",
      "praxisTitle": "Praksis, samarbeidsmerknader og tiltak",
      "methodTitle": "Metode og beregningsgrunnlag",
      "colBaseWomen": "Grunnlønn K",
      "colBaseMen": "Grunnlønn M",
      "colBaseGap": "Grunnlønn forskjell %",
      "colTccWomen": "Total K",
      "colTccMen": "Total M",
      "colTccGapKr": "Forskjell",
      "colTccGapPct": "Forskjell %",
      "medianLine": "Median: kvinner {women}, menn {men}, forskjell {gap}",
      "baseDrivenNote": "Grupper merket * flagges på grunnlønn.",
      "actionsLabel": "Tiltak",
      "linkedAction": "#{number} {owner}, {date}",
      "praxisAction": "#{number} {action}, {date}",
      "previousEvaluationTitle": "Tidligere tiltak ({run}, referansedato {date})",
      "colTarget": "Koblet til",
      "colDimension": "Dimensjon",
      "dimensionSharesTitle": "Vektandel per dimensjon",
      "levelRulesTitle": "Nivåregler",
      "colMinScore": "Laveste vekting",
      "zoneRulesTitle": "Soneprofilregler",
      "zoneRule": "Sone {zone}: minst trinn {step} på hvert profilkriterium.",
      "wcMaterial": "Arbeidsforhold: vurdert som vesentlige. {motivation}",
      "wcNotMaterial": "Arbeidsforhold: prøvd og vurdert som ikke vesentlige. {motivation}",
      "wcNone": "Arbeidsforhold: ikke besluttet.",
      "scaleNote": "Hvert kriterium vurderes på en skala fra 1 til 5; trinn 2 og 4 regnes som mellomtrinn mellom de forankrede trinnene rundt dem.",
      "thresholdsNote": "Statusterskler: en forskjell over 10 % er kritisk og 5 til 10 % forhøyet (verktøyets prioritering, ingen rettslig grense); en gruppe regnes som kvinnedominert ved minst 60 % kvinner.",
      "hourlyDefaultLine": "Heltidstimer per måned: {hours, number}.",
      "unmaskedNote": "Ingenting er maskert i dette dokumentet: hvert tall analysen har beregnet, skrives ut."
    },
```

da:

```json
    "detailAppendix": {
      "docTitle": "Detaljebilag",
      "classification": "Internt dokument. Indeholder personnære lønoplysninger. Hver download registreres i revisionsloggen. Beregnet til organisationens HR-funktion og, på anmodning, samarbejdsparterne.",
      "equalWorkTitle": "Lige arbejde, i sin helhed",
      "equivalentTitle": "Ligeværdigt arbejde, i sin helhed",
      "praxisTitle": "Praksis, samarbejdsbemærkninger og tiltag",
      "methodTitle": "Metode og beregningsgrundlag",
      "colBaseWomen": "Grundløn K",
      "colBaseMen": "Grundløn M",
      "colBaseGap": "Grundløn forskel %",
      "colTccWomen": "Samlet K",
      "colTccMen": "Samlet M",
      "colTccGapKr": "Forskel",
      "colTccGapPct": "Forskel %",
      "medianLine": "Median: kvinder {women}, mænd {men}, forskel {gap}",
      "baseDrivenNote": "Grupper markeret * flages på grundløn.",
      "actionsLabel": "Tiltag",
      "linkedAction": "#{number} {owner}, {date}",
      "praxisAction": "#{number} {action}, {date}",
      "previousEvaluationTitle": "Tidligere tiltag ({run}, referencedato {date})",
      "colTarget": "Koblet til",
      "colDimension": "Dimension",
      "dimensionSharesTitle": "Vægtandel per dimension",
      "levelRulesTitle": "Niveauregler",
      "colMinScore": "Laveste vægtning",
      "zoneRulesTitle": "Zoneprofilregler",
      "zoneRule": "Zone {zone}: mindst trin {step} på hvert profilkriterium.",
      "wcMaterial": "Arbejdsforhold: vurderet som væsentlige. {motivation}",
      "wcNotMaterial": "Arbejdsforhold: afprøvet og vurderet som ikke væsentlige. {motivation}",
      "wcNone": "Arbejdsforhold: ikke besluttet.",
      "scaleNote": "Hvert kriterium vurderes på en skala fra 1 til 5; trin 2 og 4 regnes som mellemtrin mellem de forankrede trin omkring dem.",
      "thresholdsNote": "Statustærskler: en forskel over 10 % er kritisk og 5 til 10 % forhøjet (værktøjets prioritering, ingen retlig grænse); en gruppe regnes som kvindedomineret ved mindst 60 % kvinder.",
      "hourlyDefaultLine": "Fuldtidstimer per måned: {hours, number}.",
      "unmaskedNote": "Intet er maskeret i dette dokument: hvert tal, analysen har beregnet, udskrives."
    },
```

fi:

```json
    "detailAppendix": {
      "docTitle": "Yksityiskohtaliite",
      "classification": "Sisäinen asiakirja. Sisältää henkilöön liittyviä palkkatietoja. Jokainen lataus kirjataan lokiin. Tarkoitettu organisaation HR-toiminnolle ja pyynnöstä yhteistoimintaosapuolille.",
      "equalWorkTitle": "Sama työ kokonaisuudessaan",
      "equivalentTitle": "Samanarvoinen työ kokonaisuudessaan",
      "praxisTitle": "Käytäntö, yhteistoimintamerkinnät ja toimenpiteet",
      "methodTitle": "Menetelmä ja laskentaperusteet",
      "colBaseWomen": "Peruspalkka N",
      "colBaseMen": "Peruspalkka M",
      "colBaseGap": "Peruspalkan ero %",
      "colTccWomen": "Kokonais N",
      "colTccMen": "Kokonais M",
      "colTccGapKr": "Ero",
      "colTccGapPct": "Ero %",
      "medianLine": "Mediaani: naiset {women}, miehet {men}, ero {gap}",
      "baseDrivenNote": "Merkinnällä * merkityt ryhmät on liputettu peruspalkan perusteella.",
      "actionsLabel": "Toimenpiteet",
      "linkedAction": "#{number} {owner}, {date}",
      "praxisAction": "#{number} {action}, {date}",
      "previousEvaluationTitle": "Aiemmat toimenpiteet ({run}, viitepäivä {date})",
      "colTarget": "Kytketty kohteeseen",
      "colDimension": "Ulottuvuus",
      "dimensionSharesTitle": "Painotusosuus ulottuvuuksittain",
      "levelRulesTitle": "Vaativuustasosäännöt",
      "colMinScore": "Vähimmäispainotus",
      "zoneRulesTitle": "Vyöhykeprofiilisäännöt",
      "zoneRule": "Vyöhyke {zone}: vähintään askel {step} jokaisessa profiilikriteerissä.",
      "wcMaterial": "Työolot: arvioitu olennaisiksi. {motivation}",
      "wcNotMaterial": "Työolot: testattu ja todettu ei-olennaisiksi. {motivation}",
      "wcNone": "Työolot: ei päätetty.",
      "scaleNote": "Jokainen kriteeri arvioidaan asteikolla 1-5; askeleet 2 ja 4 katsotaan välivaiheiksi niitä ympäröivien ankkuroitujen askelten välissä.",
      "thresholdsNote": "Tilakynnykset: yli 10 % ero on kriittinen ja 5-10 % kohonnut (työkalun oma priorisointi, ei oikeudellinen raja); ryhmä katsotaan naisvaltaiseksi, kun naisia on vähintään 60 %.",
      "hourlyDefaultLine": "Kokoaikatunnit kuukaudessa: {hours, number}.",
      "unmaskedNote": "Tässä asiakirjassa ei peitetä mitään: jokainen analyysin laskema luku tulostetaan."
    },
```

Every nb/da/fi string above is the string that ships; the cross-locale QA pass in Task 15 reads them against sv and en once more.



- [ ] **Step 2: Run the parity test and the caps**

Run: `cd packages/i18n && bun run test`; `bunx biome check packages/i18n/messages`
Expected: PASS (five files with identical key sets; no em dash; every ICU placeholder name identical across locales).

- [ ] **Step 3: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(i18n): add the signing report and detail appendix strings`

---

### Task 11c: The export seam, the download surfaces, the archive package, and the retirement of the old documents

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx` (rewrite), `pay-mapping-report.tsx`, `pay-mapping-report-download.tsx` (+ test), `pay-mapping-run-actions.tsx` (+ test), `pay-mapping-archive-export.ts` (+ test), `pay-mappings-section.test.tsx`
- Delete: `apps/dashboard/components/pay-mapping/pay-mapping-report-doc.tsx`, `pay-mapping-report-render.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` (+ test): delete `unionReportDoc`, the retired `computeHeaderBreaks(doc, rowPages)` and their tests
- Modify: `packages/backend/convex/lib/audit.ts`, `lib/auditPayloads.ts`, `payMapping/report.ts`, `payMapping/report.test.ts` (delete the retired events, mutations and tests)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (delete the retired event labels, help texts and report keys)

**Interfaces:**
- Consumes: the events and keys of Tasks 11a and 11b, the projections of Task 8, the documents of Tasks 9 and 10.
- Produces: `ReportDocumentKind = "signing" | "detail"`; `reportFileName(label, kind)`; `usePayMappingReportExport(): { busy; exportDocument(data, kind); renderDocument(data, kind): Promise<Blob> }`; `ARCHIVE_SCHEMA_VERSION = 2`; panels `SigningDocumentPanel`, `DetailDocumentPanel`, buttons `SigningDownloadButton`, `DetailDownloadButton`. This task closes the staged chain: after it, no surface renders the unmasked assembly except the detail appendix by design.

- [ ] **Step 1: Write the failing dashboard tests**

`apps/dashboard/components/pay-mapping/pay-mapping-report-download.test.tsx`: rewrite the file as:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { makeGapResult, makeRunDetail } from "@/test/pay-mapping-fixtures"

const toBlob = vi.fn(async () => new Blob(["x"], { type: "application/pdf" }))
// The last element handed to pdf(): the assertions read the labels and the
// doc off it to tell WHICH document was rendered.
let lastPdfElement: unknown
vi.mock("@react-pdf/renderer", () => ({
  pdf: (element: unknown) => {
    lastPdfElement = element
    return { toBlob }
  },
  Font: { registerHyphenationCallback: () => {} },
  StyleSheet: { create: (s: unknown) => s },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  Image: () => null,
  Svg: ({ children }: { children: unknown }) => children,
  G: ({ children }: { children: unknown }) => children,
  Rect: () => null,
  Line: () => null,
  Path: () => null,
  Defs: ({ children }: { children: unknown }) => children,
  Pattern: ({ children }: { children: unknown }) => children,
}))

// One mock per boundary mutation, resolved by the string refs below: the
// tests must be able to assert WHICH event the export logged.
const logSigning = vi.fn(async () => null)
const logDetail = vi.fn(async () => null)
const logMetricsExport = vi.fn(async () => null)
const logArchiveExport = vi.fn(async () => null)
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: { listPayMappingRuns: "runs.list" },
      actions: { listActions: "actions.list" },
      gap: { getPayMappingGap: "gap.get" },
      report: {
        logPayMappingSigningReportExport: "report.logSigning",
        logPayMappingDetailAppendixExport: "report.logDetail",
        logPayMappingMetricsExport: "report.logMetrics",
        logPayMappingArchiveExport: "report.logArchive",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : [],
  useMutation: (ref: unknown) =>
    ref === "report.logDetail"
      ? logDetail
      : ref === "report.logMetrics"
        ? logMetricsExport
        : ref === "report.logArchive"
          ? logArchiveExport
          : logSigning,
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme AB", role: "admin" }),
}))

vi.mock("./pay-mapping-run-context", () => ({
  usePayMappingRun: () => ({
    run: makeRunDetail({
      status: "completed",
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: null,
      },
    }),
    gap: makeGapResult({}),
    analyses: [],
    actions: [],
    notes: [],
    runsList: [],
    queue: null,
    locked: true,
  }),
}))

import { PayMappingReportDownload } from "./pay-mapping-report-download"

function renderDownload() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingReportDownload />
    </NextIntlClientProvider>
  )
}

type RenderedProps = {
  props?: {
    labels?: { docTitle?: string; classification?: string }
    doc?: { equalWork?: unknown[]; checklist?: unknown }
  }
}

describe("PayMappingReportDownload", () => {
  afterEach(() => {
    cleanup()
    toBlob.mockClear()
    logSigning.mockClear()
    logDetail.mockClear()
    logMetricsExport.mockClear()
    logArchiveExport.mockClear()
    lastPdfElement = undefined
  })

  it("renders the signing report, logs its own export event, then downloads", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadSigning,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(logSigning).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    expect(logDetail).not.toHaveBeenCalled()
    // The export-boundary audit row is written BEFORE the file is handed
    // over (ADR-0011 p.3): a download the trail missed must not happen.
    const logOrder = logSigning.mock.invocationCallOrder[0] ?? 0
    const downloadOrder = createObjectURL.mock.invocationCallOrder[0] ?? 0
    expect(logOrder).toBeLessThan(downloadOrder)
    const element = lastPdfElement as RenderedProps
    expect(element?.props?.labels?.docTitle).toBe(
      messages.dashboard.payMapping.signingReport.docTitle
    )
    expect(element?.props?.doc?.checklist).toBeDefined()
    expect(element?.props?.doc?.equalWork).not.toBeInstanceOf(Array)
  })

  it("renders the detail appendix as a multi-pass PDF with its own event and the classification line", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadDetail,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(logDetail).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    expect(logSigning).not.toHaveBeenCalled()
    // At least the page-ref pass and the final render.
    expect(toBlob.mock.calls.length).toBeGreaterThanOrEqual(2)
    const element = lastPdfElement as RenderedProps
    expect(element?.props?.labels?.docTitle).toBe(
      messages.dashboard.payMapping.detailAppendix.docTitle
    )
    expect(element?.props?.labels?.classification).toBe(
      messages.dashboard.payMapping.detailAppendix.classification
    )
    expect(Array.isArray(element?.props?.doc?.equalWork)).toBe(true)
  })

  it("aborts the download when the export log fails", async () => {
    logSigning.mockRejectedValueOnce(new Error("offline"))
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadSigning,
      })
    )
    await waitFor(() => expect(logSigning).toHaveBeenCalled())
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
```

`apps/dashboard/components/pay-mapping/pay-mapping-run-actions.test.tsx`: replace the `usePayMappingReportExport` mock with

```ts
const exportDocumentMock = vi.fn(async () => {})
vi.mock("@/components/pay-mapping/pay-mapping-report-export", () => ({
  usePayMappingReportExport: () => ({
    busy: false,
    exportDocument: exportDocumentMock,
  }),
}))
```

reset it in `beforeEach` (`exportDocumentMock.mockClear()`), and in the test `downloads the report from the row menu, fed by one-shot queries` click `messages.dashboard.payMapping.report.downloadSigningItem` and assert `exportDocumentMock` was called with the data object and `"signing"` (the same data expectations the test already spells out, plus the second argument). Add a sibling test clicking `downloadDetailItem` and asserting the second argument is `"detail"`. Any test that asserts the mocked `getPayMappingRunBySlug` data's shape keeps passing: the hook is mocked.

`apps/dashboard/components/pay-mapping/pay-mapping-archive-export.test.tsx`:
- the `api` mock's `report` entries become `logPayMappingSigningReportExport: "report.logSigning"`, `logPayMappingDetailAppendixExport: "report.logDetail"`, plus metrics/archive as before;
- the `usePayMappingReportExport` mock returns `{ busy: false, exportDocument: vi.fn(), renderDocument: async (_data, kind) => new Blob([kind === "signing" ? SIGNING_BYTES : DETAIL_BYTES]) }` with `const SIGNING_BYTES = new TextEncoder().encode("signing-bytes").buffer as ArrayBuffer` and `const DETAIL_BYTES = new TextEncoder().encode("detail-bytes").buffer as ArrayBuffer` replacing `PDF_BYTES`;
- the flat-layout test expects `["2026-2027-detaljbilaga.pdf", "2026-2027-nyckeltal.xlsx", "2026-2027-signeringsrapport.pdf", "manifest.json"]`;
- the main test expects the four entries `["Mapping 2026-detaljbilaga.pdf", "Mapping 2026-nyckeltal.xlsx", "Mapping 2026-signeringsrapport.pdf", "manifest.json"]`, reads both PDFs back byte-identical, asserts `manifest.schemaVersion` is `2` and `manifest.files` lists signing, detail and workbook in that order with their real checksums;
- the manifest unit test adds `expect(ARCHIVE_SCHEMA_VERSION).toBe(2)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- pay-mapping-report-download pay-mapping-run-actions pay-mapping-archive-export pay-mappings-section`
Expected: FAIL.

- [ ] **Step 3: Rewrite the export hook**

Replace the whole of `apps/dashboard/components/pay-mapping/pay-mapping-report-export.tsx` with:

```tsx
"use client"

import { pdf } from "@react-pdf/renderer"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PraxisAreaKey } from "@workspace/constants"
import { useMutation } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import type { IdentityLabels } from "@/components/pdf/identity-block"
import { computeHeaderBreaks } from "@/components/pdf/pdf-table"
import { resolveCriteriaLibraryValue } from "@/lib/audit-constants"
import { formatMoney } from "@/lib/currency"
import { exportFileLabel } from "@/lib/export-file-name"
import { percentText, signedPercentText } from "@/lib/percent"
import { toast } from "@/lib/toast"
import {
  type DetailAppendixLabels,
  DetailAppendixPdf,
  detailAppendixTables,
} from "./detail-appendix-doc"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import {
  assemblePayMappingReport,
  hourlyNoteLabel,
  type PayMappingReportDoc,
  type ReportPreviousInput,
} from "./pay-mapping-report-data"
import {
  detailAppendixDoc,
  type SigningActionArea,
  type SigningReportDoc,
  signingReportDoc,
} from "./signing-report-data"
import { type SigningReportLabels, SigningReportPdf } from "./signing-report-doc"

// Which of the two documents an export produces (ADR-0030). The signing
// report is the masked samverkan document; the detail appendix the
// unmasked complete documentation.
export type ReportDocumentKind = "signing" | "detail"

// The standalone download's file name, shared with the archive package so
// the bundled document and the standalone one can never drift apart.
export function reportFileName(
  label: string,
  kind: ReportDocumentKind
): string {
  const safe = exportFileLabel(label)
  return kind === "signing"
    ? `${safe}-signeringsrapport.pdf`
    : `${safe}-detaljbilaga.pdf`
}

// Everything one export consumes; the caller owns the fetching (the report
// page reads its run context and subscriptions, the runs list fetches
// one-shot), the hook owns everything after.
export interface ReportExportData {
  run: PayMappingRunDetail
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
  previous: ReportPreviousInput | null
}

// The multi-pass cap for the appendix's continuation headers. Convergence
// is NOT monotone (an inserted header can push the previous page's last row
// forward, MOVING a break rather than adding one), so there is no guaranteed
// fixed point: typical documents settle in 2 passes, measured
// comparison-heavy ones have needed up to 13. When the cap is hit, the final
// render ships the LAST RENDERED set together with the page refs measured
// under it, never an unrendered guess.
const MAX_PASSES = 16

// The two document exports, shared by the report page's panels and the runs
// list's row menu: assemble the frozen run + work layer once (unmasked),
// project it into the requested document, render it, log the export in the
// audit trail (ADR-0011 p.3: the boundary where data leaves the system) and
// hand the browser the file.
export function usePayMappingReportExport(): {
  busy: boolean
  exportDocument: (
    data: ReportExportData,
    kind: ReportDocumentKind
  ) => Promise<void>
  // The document alone, without the boundary log and the download: the
  // archive package renders the SAME documents through this seam, so the
  // bundled documents can never diverge from the standalone ones. The
  // caller owns busy state and its own boundary event.
  renderDocument: (
    data: ReportExportData,
    kind: ReportDocumentKind
  ) => Promise<Blob>
} {
  const t = useTranslations("dashboard.payMapping.report")
  const tSigning = useTranslations("dashboard.payMapping.signingReport")
  const tDetail = useTranslations("dashboard.payMapping.detailAppendix")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tActions = useTranslations("dashboard.payMapping.actions")
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tReview = useTranslations("dashboard.payMapping.review")
  const tStatus = useTranslations("dashboard.payMapping.analysisStatus")
  // The document-shared labels the metodbilaga already owns (contents,
  // generated-on, criteria table columns): reused, not duplicated.
  const tAppendix = useTranslations("dashboard.model.methodAppendix")
  const format = useFormatter()
  const locale = useLocale()
  const { orgId, name: organizationName } = useOrganization()
  const logSigning = useMutation(
    api.payMapping.report.logPayMappingSigningReportExport
  )
  const logDetail = useMutation(
    api.payMapping.report.logPayMappingDetailAppendixExport
  )
  const [busy, setBusy] = useState(false)

  const praxisAreaLabel = (area: PraxisAreaKey) =>
    tReview(`praxis.${area}.title`)
  const dash = t("maskedCell")

  function assemble(data: ReportExportData): PayMappingReportDoc {
    const { run, gap, analyses, actions, notes, previous } = data
    const currency = gap.currency
    const money = (value: number) =>
      currency === null
        ? format.number(Math.round(value))
        : formatMoney(value, currency, locale)
    return assemblePayMappingReport({
      run,
      gap,
      analyses,
      actions,
      notes,
      previous,
      praxisAreaLabel,
      formatters: {
        money,
        pct: (value) => percentText(value, format),
        signedPct: (value) => signedPercentText(value, format),
        date: (epochMs) =>
          format.dateTime(new Date(epochMs), { dateStyle: "medium" }),
        dateTime: (epochMs) =>
          format.dateTime(new Date(epochMs), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        costUnitSuffix: (unit) =>
          unit === null || unit === "oneOff"
            ? ""
            : tActions(`costUnitSuffix.${unit}`),
      },
    })
  }

  function identityLabels(
    doc: Pick<PayMappingReportDoc, "identity" | "runLabel" | "status">,
    docTitle: string
  ): IdentityLabels {
    return {
      docTitle,
      // The organization's own name, as stored: a pass-through i18n key
      // would only launder a value that needs no translation.
      organizationName,
      runLabel: doc.runLabel,
      referenceDateLine: t("referenceDateLine", {
        date: doc.identity.referenceDate,
      }),
      extractedAtLine: t("extractedAtLine", {
        dateTime: doc.identity.extractedAt,
      }),
      methodVersionLine:
        doc.identity.approvedAt === null
          ? t("methodVersionUnapproved", {
              version: doc.identity.systemVersion,
            })
          : t("methodVersionLine", {
              version: doc.identity.systemVersion,
              date: doc.identity.approvedAt,
            }),
      generatedOn: tAppendix("generatedOn", {
        date: format.dateTime(new Date(), { dateStyle: "medium" }),
      }),
      statusTag: doc.status === "final" ? t("tagFinal") : t("tagDraft"),
    }
  }

  const quartileLabels = [
    t("quartile1"),
    t("quartile2"),
    t("quartile3"),
    t("quartile4"),
  ]

  function signingLabels(doc: SigningReportDoc): SigningReportLabels {
    const docTitle = tSigning("docTitle")
    const share = (value: string | null) => value ?? dash
    const areaLabel = (area: SigningActionArea) =>
      area === "equalWork"
        ? tSigning("areaEqualWork")
        : area === "equivalentWork"
          ? tSigning("areaEquivalentWork")
          : tSigning("areaPraxis")
    const observationLabel = (area: SigningActionArea, count: number) =>
      area === "equalWork"
        ? tSigning("observationEqualWork", { count })
        : area === "equivalentWork"
          ? tSigning("observationEquivalentWork", { count })
          : tSigning("observationPraxis", { count })
    const conclusion = (finding: "none" | "found" | null, done: boolean) =>
      !done || finding === null
        ? tSigning("conclusionPending")
        : finding === "found"
          ? tSigning("conclusionReview")
          : tSigning("conclusionClear")
    const collaborationDocumented = doc.checklist.collaborationDocumented
    const nextStep =
      doc.openItems.openAnalyses > 0
        ? tSigning("nextStepOpen")
        : doc.openItems.actionsInProgress > 0
          ? tSigning("nextStepActions", {
              count: doc.openItems.actionsInProgress,
            })
          : tSigning("nextStepDone")
    return {
      docTitle,
      footer: docTitle,
      identity: identityLabels(doc, docTitle),
      formalitiesTitle: tSigning("formalitiesTitle"),
      collaborationDateLine:
        doc.collaboration === null || doc.collaboration.date === null
          ? tSigning("collaborationDateMissing")
          : tSigning("collaborationDateLine", { date: doc.collaboration.date }),
      participantsLabel: tReview("collaborationParticipants"),
      descriptionLabel: tReview("collaborationDescription"),
      notDocumented: t("notDocumented"),
      appendixReference: tSigning("appendixReference"),
      signature: {
        employer: tSigning("signatureEmployer"),
        union: tSigning("signatureUnion"),
        name: tSigning("signatureName"),
        signature: tSigning("signatureSignature"),
        place: tSigning("signaturePlace"),
        date: tSigning("signatureDate"),
      },
      summaryTitle: tSigning("summaryTitle"),
      boxes: [
        {
          title: tSigning("boxPayPosition"),
          rows: [
            {
              label: tSigning("payPositionMedian"),
              value: share(doc.payPosition.womenShareOfMenMedianPct),
            },
            {
              label: tSigning("payPositionMean"),
              value: share(doc.payPosition.womenShareOfMenMeanPct),
            },
          ],
        },
        {
          title: tSigning("boxRepresentation"),
          rows: doc.quartiles.map((quartile, index) => ({
            label: quartileLabels[index] ?? "",
            value:
              quartile.women + quartile.men === 0
                ? dash
                : tSigning("representationRow", {
                    share: percentText(
                      (quartile.women / (quartile.women + quartile.men)) * 100,
                      format
                    ),
                  }),
          })),
        },
        {
          title: tSigning("boxEqualWork"),
          rows: [
            {
              label: tSigning("groupsCompared"),
              value: String(doc.equalWork.groups),
            },
            {
              label: tSigning("assessmentsCompleted"),
              value: tSigning("countOf", {
                done: doc.equalWork.assessed,
                total: doc.equalWork.required,
              }),
            },
            {
              label: tSigning("objectiveReasons"),
              value: String(doc.equalWork.objectiveReasons),
            },
            {
              label: tSigning("actionsDecided"),
              value: String(doc.equalWork.actionsDecided),
            },
          ],
        },
        {
          title: tSigning("boxEquivalentWork"),
          rows: [
            {
              label: tSigning("wdInScope"),
              value: String(doc.equivalentWork.womenDominatedGroups),
            },
            {
              label: tSigning("relevantComparisons"),
              value: String(doc.equivalentWork.comparisons),
            },
            {
              label: tSigning("completed"),
              value: String(doc.equivalentWork.completed),
            },
            {
              label: tSigning("objectiveReasons"),
              value: String(doc.equivalentWork.objectiveReasons),
            },
            {
              label: tSigning("actionsDecided"),
              value: String(doc.equivalentWork.actionsDecided),
            },
          ],
        },
      ],
      quartilesTitle: t("quartilesTitle"),
      quartileRow: (index) => quartileLabels[index] ?? "",
      colWomen: tGap("columns.women"),
      colMen: tGap("columns.men"),
      chartQuartilesCaption: t("chartQuartilesCaption"),
      closingSentences: [
        tSigning("stateSentence", {
          groups: doc.equalWork.groups,
          comparisons: doc.equivalentWork.comparisons,
          open: doc.openItems.openAnalyses,
        }),
        nextStep,
      ],
      scopeTitle: tSigning("scopeTitle"),
      scopeRows: [
        {
          label: tSigning("scopeReferenceDate"),
          value: doc.identity.referenceDate,
        },
        {
          label: tSigning("scopePopulation"),
          value: tSigning("populationValue", {
            total: doc.population.total,
            women: doc.population.women,
            men: doc.population.men,
            priced: doc.population.priced,
          }),
        },
        {
          label: tSigning("scopePayElements"),
          value: tSigning("payElementsValue"),
        },
        {
          label: tSigning("scopeExclusions"),
          value: tSigning("exclusionsValue", {
            withoutPay: doc.exclusions.withoutPay,
            singletons: doc.exclusions.singletonCount,
            genderPure: doc.exclusions.genderPureCount,
          }),
        },
      ],
      confidentialityNote: tSigning("confidentialityNote", {
        count: doc.exclusions.maskedGroupCount,
      }),
      praxisTitle: tSigning("praxisTitle"),
      colArea: tSigning("colArea"),
      colConclusion: tSigning("colConclusion"),
      colFollowUp: tSigning("colFollowUp"),
      praxisRows: [
        ...doc.praxis.map((area) => ({
          area: praxisAreaLabel(area.key),
          conclusion: conclusion(area.finding, area.done),
          followUp:
            area.action === null
              ? dash
              : tSigning("praxisAction", {
                  number: area.action.number,
                  action: area.action.plannedAction,
                  date: area.action.plannedDate,
                }),
        })),
        {
          area: tSigning("collaborationRow"),
          conclusion: collaborationDocumented
            ? tSigning("collaborationPerformed")
            : tSigning("collaborationInProgress"),
          followUp: doc.collaboration?.date ?? dash,
        },
      ],
      equalWorkTitle: tSigning("equalWorkTitle"),
      equalWorkRows: [
        {
          label: tSigning("groupsCompared"),
          value: String(doc.equalWork.groups),
        },
        {
          label: tSigning("assessmentsCompleted"),
          value: tSigning("countOf", {
            done: doc.equalWork.assessed,
            total: doc.equalWork.required,
          }),
        },
        {
          label: tSigning("objectiveReasons"),
          value: String(doc.equalWork.objectiveReasons),
        },
        {
          label: tSigning("actionsDecided"),
          value: String(doc.equalWork.actionsDecided),
        },
        {
          label: tSigning("insufficientBasis"),
          value: String(doc.equalWork.insufficientBasis),
        },
      ],
      equalWorkConclusion: tSigning("equalWorkConclusion"),
      equivalentTitle: tSigning("equivalentTitle"),
      chainLine: tSigning("chainLine"),
      equivalentRows: [
        {
          label: tSigning("wdInScope"),
          value: String(doc.equivalentWork.womenDominatedGroups),
        },
        {
          label: tSigning("relevantComparisons"),
          value: String(doc.equivalentWork.comparisons),
        },
        {
          label: tSigning("completed"),
          value: String(doc.equivalentWork.completed),
        },
        {
          label: tSigning("objectiveReasons"),
          value: String(doc.equivalentWork.objectiveReasons),
        },
        {
          label: tSigning("actionsDecided"),
          value: String(doc.equivalentWork.actionsDecided),
        },
      ],
      actionPlanTitle: tSigning("actionPlanTitle"),
      colObservation: tSigning("colObservation"),
      colActions: tSigning("colActions"),
      colStatusSplit: tSigning("colStatusSplit"),
      colCost: tActions("estimatedCost"),
      colDates: tSigning("colDates"),
      actionPlanRows: doc.actionPlan
        .filter((row) => row.count > 0)
        .map((row) => ({
          area: areaLabel(row.area),
          observation: observationLabel(row.area, row.observations),
          actions: String(row.count),
          statusSplit: tSigning("statusSplit", {
            notStarted: row.notStarted,
            inProgress: row.inProgress,
            done: row.done,
          }),
          cost: row.cost ?? dash,
          dates:
            row.earliest === null || row.latest === null
              ? dash
              : row.earliest === row.latest
                ? row.earliest
                : tSigning("dateRange", {
                    earliest: row.earliest,
                    latest: row.latest,
                  }),
        })),
      noActions: t("noActions"),
      methodTitle: tSigning("methodTitle"),
      methodLines: [
        tSigning("methodEqualWork"),
        tSigning("methodEquivalentWork", {
          criteria: doc.method.criteria
            .map((criterion) =>
              tSigning("criterionWithWeight", {
                name: criterion.name,
                points: criterion.weightPoints,
              })
            )
            .join(", "),
        }),
        tSigning("methodPayElements", { currency: doc.currency ?? dash }),
      ],
      checklistTitle: tSigning("checklistTitle"),
      checklistRows: [
        {
          label: tSigning("checkAssessed"),
          done: doc.checklist.allRequiredAssessed,
        },
        {
          label: tSigning("checkLinked"),
          done: doc.checklist.reasonsOrActionsLinked,
        },
        {
          label: tSigning("checkCollaboration"),
          done: doc.checklist.collaborationDocumented,
        },
        {
          label: tSigning("checkSameVersion"),
          done: doc.checklist.sameFrozenVersion,
        },
      ],
      checklistDone: tSigning("checklistDone"),
      checklistOpen: tSigning("checklistOpen"),
      maskedCell: dash,
    }
  }

  function detailLabels(doc: PayMappingReportDoc): DetailAppendixLabels {
    const docTitle = tDetail("docTitle")
    // The same resolver the audit log uses for a dimension key: the
    // criteria library's own localized name in the viewer's locale.
    const dimensionLabel = (key: string) =>
      resolveCriteriaLibraryValue("dimensionKey", key, locale) ?? key
    const workingConditionsLine =
      doc.method.workingConditions === null
        ? tDetail("wcNone")
        : tDetail(
            doc.method.workingConditions.status === "active"
              ? "wcMaterial"
              : "wcNotMaterial",
            { motivation: doc.method.workingConditions.motivation }
          )
    return {
      docTitle,
      footer: docTitle,
      identity: identityLabels(doc, docTitle),
      classification: tDetail("classification"),
      contentsTitle: tAppendix("contentsTitle"),
      equalWorkTitle: tDetail("equalWorkTitle"),
      equivalentTitle: tDetail("equivalentTitle"),
      praxisTitle: tDetail("praxisTitle"),
      methodTitle: tDetail("methodTitle"),
      colGroup: tGap("columns.group"),
      colLevel: tGap("columns.level"),
      colWomen: tGap("columns.women"),
      colMen: tGap("columns.men"),
      colBaseWomen: tDetail("colBaseWomen"),
      colBaseMen: tDetail("colBaseMen"),
      colBaseGap: tDetail("colBaseGap"),
      colTccWomen: tDetail("colTccWomen"),
      colTccMen: tDetail("colTccMen"),
      colTccGapKr: tDetail("colTccGapKr"),
      colTccGapPct: tDetail("colTccGapPct"),
      colStatus: t("colStatus"),
      medianLine: (median) =>
        tDetail("medianLine", {
          women: median.women ?? dash,
          men: median.men ?? dash,
          gap: median.gapPct ?? dash,
        }),
      flagLabel: (flag) => tGap(`flag.${flag}`),
      statusLabel: (status) => tStatus(status),
      baseDrivenMarker: "*",
      baseDrivenNote: tDetail("baseDrivenNote"),
      prevYearLine: (gapPct) => t("prevYearLine", { gap: gapPct }),
      reasonsLabel: t("reasonsLabel"),
      noteLabel: t("noteLabel"),
      actionsLabel: tDetail("actionsLabel"),
      reasonLabel: (reason) => tReasons(reason),
      linkedActionLine: (action) =>
        tDetail("linkedAction", {
          number: action.number,
          owner: action.ownerName,
          date: action.plannedDate,
        }),
      undocumented: t("undocumented"),
      levelText: (level) => (level === null ? dash : String(level)),
      emptyEqualWork: t("emptyEqualWork"),
      reverseTitle: t("reverseTitle"),
      genderPureTitle: t("genderPureTitle"),
      genderPureRow: (row) =>
        t("genderPureRow", {
          group: row.label,
          level: row.level ?? dash,
          count: row.count,
          gender: row.gender === "Kvinna" ? t("wordWomen") : t("wordMen"),
        }),
      wdGroupLine: (group) =>
        t("wdGroupLine", {
          group: group.label,
          level: group.level,
          headcount: group.headcount,
          share: group.womenSharePct,
          mean: group.meanComp ?? dash,
        }),
      colComparator: t("colComparator"),
      colHeadcount: tGap("columns.headcount"),
      colWomenShare: tGap("columns.womenShare"),
      colMean: tGap("columns.mean"),
      colSpread: t("colSpread"),
      colDiffPct: tGap("columns.diffPct"),
      colDiffKr: tGap("columns.diffSek"),
      noComparators: tGap("noComparators"),
      emptyWomenDominated: t("emptyWomenDominated"),
      praxisAreaTitle: praxisAreaLabel,
      findingLabel: (finding) =>
        finding === "none"
          ? t("findingNone")
          : finding === "found"
            ? t("findingFound")
            : t("findingPending"),
      praxisActionLine: (action) =>
        tDetail("praxisAction", {
          number: action.number,
          action: action.plannedAction,
          date: action.plannedDate,
        }),
      previousEvaluationTitle:
        doc.previousEvaluation === null
          ? ""
          : tDetail("previousEvaluationTitle", {
              run: doc.previousEvaluation.runLabel,
              date: doc.previousEvaluation.referenceDate,
            }),
      noPreviousActions: t("noPreviousActions"),
      collaborationTitle: tReview("collaborationTitle"),
      participantsLabel: tReview("collaborationParticipants"),
      descriptionLabel: tReview("collaborationDescription"),
      collaborationDateLabel: tReview("collaborationDate"),
      notDocumented: t("notDocumented"),
      actionsTitle: t("actionsTitle"),
      colNumber: tActions("number"),
      colTarget: tDetail("colTarget"),
      colProblem: t("colAction"),
      colReason: tActions("reason"),
      colOwner: tActions("owner"),
      colDate: tActions("plannedDate"),
      colCost: tActions("estimatedCost"),
      colPriority: tActions("priorityLabel"),
      colActionStatus: t("colStatus"),
      targetKindLabel: (kind) => tActions(`targetKind.${kind}`),
      actionStatusLabel: (status) => tActions(`status.${status}`),
      priorityLabel: (priority) => tActions(`priority.${priority}`),
      erasedContent: tActions("erasedContent"),
      noActions: t("noActions"),
      notesTitle: t("notesTitle"),
      noteTypeLabel: (type) => tActions(`noteType.${type}`),
      noNotes: t("noNotes"),
      criteriaTitle: t("criteriaTitle"),
      colCriterion: tAppendix("colCriterion"),
      colDimension: tDetail("colDimension"),
      colWeight: tAppendix("colWeight"),
      colShare: tAppendix("colShare"),
      dimensionLabel,
      pointBudgetLine: t("pointBudgetLine", { points: doc.method.pointBudget }),
      dimensionSharesTitle: tDetail("dimensionSharesTitle"),
      levelRulesTitle: tDetail("levelRulesTitle"),
      colMinScore: tDetail("colMinScore"),
      zoneRulesTitle: tDetail("zoneRulesTitle"),
      zoneRuleLine: (rule) =>
        tDetail("zoneRule", { zone: rule.zone, step: rule.minStep }),
      workingConditionsLine,
      scaleNote: tDetail("scaleNote"),
      measuresNote: t("measuresNote", { currency: doc.currency ?? dash }),
      thresholdsNote: tDetail("thresholdsNote"),
      hourlyDefaultLine: tDetail("hourlyDefaultLine", {
        hours: doc.fullTimeHoursDefault,
      }),
      hourlyNote: hourlyNoteLabel(doc, t),
      coverageNote: t("coverageNote", {
        singletons: doc.method.singletonCount,
        genderPure: doc.method.genderPureCount,
        reverse: doc.method.reverseCount,
      }),
      unmaskedNote: tDetail("unmaskedNote"),
      maskedCell: dash,
    }
  }

  async function renderDocument(
    data: ReportExportData,
    kind: ReportDocumentKind
  ): Promise<Blob> {
    const full = assemble(data)
    if (kind === "signing") {
      // Six to eight pages, no long tables and no contents page: one pass.
      const doc = signingReportDoc(full)
      return await pdf(
        <SigningReportPdf doc={doc} labels={signingLabels(doc)} />
      ).toBlob()
    }
    const doc = detailAppendixDoc(full)
    const labels = detailLabels(doc)
    // Multi-pass render: each pass records where every section and table
    // row lands; from that the rows that start a new page get their table's
    // header re-rendered above them (continuation headers), and because an
    // inserted header can itself move later rows, the loop repeats until the
    // layout is stable (or MAX_PASSES is hit, see above).
    let headerBreaks = new Set<string>()
    let pageRefs: Record<string, number> = {}
    const tables = detailAppendixTables(doc)
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const rowPages: Record<string, number> = {}
      const refs: Record<string, number> = {}
      await pdf(
        <DetailAppendixPdf
          doc={doc}
          labels={labels}
          headerBreaks={headerBreaks}
          onResolvePage={(id, page) => {
            refs[id] = page
          }}
          onRowPage={(id, page) => {
            rowPages[id] = page
          }}
        />
      ).toBlob()
      pageRefs = refs
      const next = computeHeaderBreaks(tables, rowPages)
      const stable =
        next.size === headerBreaks.size &&
        [...next].every((id) => headerBreaks.has(id))
      if (stable || pass === MAX_PASSES - 1) break
      headerBreaks = next
    }
    return await pdf(
      <DetailAppendixPdf
        doc={doc}
        labels={labels}
        pageRefs={pageRefs}
        headerBreaks={headerBreaks}
      />
    ).toBlob()
  }

  async function exportDocument(
    data: ReportExportData,
    kind: ReportDocumentKind
  ): Promise<void> {
    setBusy(true)
    try {
      const blob = await renderDocument(data, kind)
      // The export-boundary audit row (ADR-0011 p.3) is written BEFORE the
      // file is handed over: a download the trail does not know about must
      // not happen. Generation stayed local; nothing has left the browser
      // yet.
      try {
        await (kind === "signing"
          ? logSigning({ orgId, runId: data.run.runId })
          : logDetail({ orgId, runId: data.run.runId }))
      } catch {
        toast.error(t("logFailed"))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = reportFileName(data.run.label, kind)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return { busy, exportDocument, renderDocument }
}
```

`tReview("collaborationDate")` is a key Task 11a adds under `dashboard.payMapping.review` in every locale (en `"Collaboration date"`, sv `"Samverkansdatum"`, nb `"Samarbeidsdato"`, da `"Samarbejdsdato"`, fi `"Yhteistoiminnan päivä"`), so Task 14 only wires the picker.

- [ ] **Step 4: The report frame's panels and buttons**

In `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx` replace `ReportDocumentPanel`, `UnionDocumentPanel`, `ReportDownloadButton` and `UnionDownloadButton` with:

```tsx
// The signing report's panel: the primary document, its concept explained
// by its own help.
export function SigningDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <ReportPanel
      icon={Pdf01Icon}
      title={t("signingTitle")}
      help={
        <HelpMorphButton label={tHelp("signingReportLabel")}>
          {tHelp("signingReportBody")}
        </HelpMorphButton>
      }
      description={t("signingDescription")}
      action={action}
    />
  )
}

// The detail appendix's panel: unmasked and available to every member; the
// help says so and that every download is recorded (ADR-0030).
export function DetailDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <ReportPanel
      icon={Pdf01Icon}
      title={t("detailTitle")}
      help={
        <HelpMorphButton label={tHelp("detailAppendixLabel")}>
          {tHelp("detailAppendixBody")}
        </HelpMorphButton>
      }
      description={t("detailDescription")}
      action={action}
    />
  )
}

// The signing report's export: the frame's one primary action.
export function SigningDownloadButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean
  disabled: boolean
  onClick?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <SubmitButton
      type="button"
      size={CHAPTER_ACTION_BUTTON_SIZE}
      isSubmitting={busy}
      disabled={disabled}
      aria-label={t("downloadSigning")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}

// The detail appendix's export: outline like the other secondary documents.
export function DetailDownloadButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean
  disabled: boolean
  onClick?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <SubmitButton
      type="button"
      variant="outline"
      size={CHAPTER_ACTION_BUTTON_SIZE}
      isSubmitting={busy}
      disabled={disabled}
      aria-label={t("downloadDetail")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}
```

and `ReportCardShell` renders, in order, `SigningDocumentPanel` (with `SigningDownloadButton`), `DetailDocumentPanel` (with `DetailDownloadButton`), `MetricsDocumentPanel`, `ArchiveDocumentPanel`. Update the file's header comment ("a panel per document: the signing report, the detail appendix, the key-figures workbook, the archive package").

- [ ] **Step 5: The download surface**

In `apps/dashboard/components/pay-mapping/pay-mapping-report-download.tsx`:
- import `DetailDocumentPanel, DetailDownloadButton, SigningDocumentPanel, SigningDownloadButton` instead of the report/union pairs; import `type ReportDocumentKind` from `./pay-mapping-report-export` (drop the `./pay-mapping-report-doc` import);
- `const { busy, exportDocument } = usePayMappingReportExport()` and `const { busy: archiveBusy, exportArchive } = usePayMappingArchiveExport()` (no capture hosts anywhere; delete `{captureHost}` and `{archiveCaptureHost}` from the JSX and the fragment around the frame if nothing else remains in it);
- `const [activeDocument, setActiveDocument] = useState<ReportDocumentKind | null>(null)` replaces `activeVariant`;
- `onExport(kind: ReportDocumentKind)` calls `exportDocument(data, kind)`;
- the JSX renders

```tsx
        <SigningDocumentPanel
          action={
            <SigningDownloadButton
              busy={busy && activeDocument === "signing"}
              disabled={!ready || anyBusy}
              onClick={() => void onExport("signing")}
            />
          }
        />
        <DetailDocumentPanel
          action={
            <DetailDownloadButton
              busy={busy && activeDocument === "detail"}
              disabled={!ready || anyBusy}
              onClick={() => void onExport("detail")}
            />
          }
        />
```

followed by the unchanged metrics and archive panels.

In `apps/dashboard/components/pay-mapping/pay-mapping-run-actions.tsx`:
- import `type ReportDocumentKind` from `./pay-mapping-report-export` instead of `ReportVariant` from the doc module;
- `const { busy: reportBusy, exportDocument } = usePayMappingReportExport()` and `const { busy: archiveBusy, exportArchive } = usePayMappingArchiveExport()`; delete the `captureHost` and `archiveCaptureHost` renders;
- `onDownload(kind: ReportDocumentKind)` calls `exportDocument(data, kind)`;
- the submenu items become, in order:

```tsx
              <DropdownMenuItem onClick={() => void onDownload("signing")}>
                {tReport("downloadSigningItem")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void onDownload("detail")}>
                {tReport("downloadDetailItem")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownloadMetrics}>
                {tReport("downloadMetricsItem")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void onDownloadArchive()}>
                {tReport("downloadArchiveItem")}
              </DropdownMenuItem>
```

- [ ] **Step 6: The archive package, version 2**

In `apps/dashboard/components/pay-mapping/pay-mapping-archive-export.ts`:
- `export const ARCHIVE_SCHEMA_VERSION = 2` with the comment `// Bumped when the package's shape changes: 2 lists the signing report and the detail appendix instead of the single documentation PDF.`;
- the hook returns `{ busy, exportArchive }` (no capture host); `const { renderDocument } = usePayMappingReportExport()`;
- `exportArchive` renders both documents and bundles four files:

```ts
      const signingBuffer = await (
        await renderDocument(data, "signing")
      ).arrayBuffer()
      const detailBuffer = await (
        await renderDocument(data, "detail")
      ).arrayBuffer()
      const workbookBuffer = await renderWorkbookBuffer({
        run: data.run,
        gap: data.gap,
      })
      const signingName = reportFileName(data.run.label, "signing")
      const detailName = reportFileName(data.run.label, "detail")
      const workbookName = metricsFileName(data.run.label)
      const files: ArchiveManifestEntry[] = [
        {
          name: signingName,
          bytes: signingBuffer.byteLength,
          sha256: await sha256Hex(signingBuffer),
        },
        {
          name: detailName,
          bytes: detailBuffer.byteLength,
          sha256: await sha256Hex(detailBuffer),
        },
        {
          name: workbookName,
          bytes: workbookBuffer.byteLength,
          sha256: await sha256Hex(workbookBuffer),
        },
      ]
      ...
      zip.file(signingName, signingBuffer)
      zip.file(detailName, detailBuffer)
      zip.file(workbookName, workbookBuffer)
      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
```

- update the module comment ("one ZIP per kartläggning holding the signing report, the detail appendix, the key-figures workbook and a metadata manifest with SHA-256 checksums over the binary files") and the archive log mutation's comment in `report.ts`.

- [ ] **Step 7: Delete the retired document**

Dashboard:
- Delete `apps/dashboard/components/pay-mapping/pay-mapping-report-doc.tsx` and `apps/dashboard/components/pay-mapping/pay-mapping-report-render.test.tsx`.
- In `pay-mapping-report-data.ts` delete `unionReportDoc` and its comment, and the retired `computeHeaderBreaks(doc, rowPages)` with its comment (the kit's `computeHeaderBreaks(tables, rowPages)` and `detailAppendixTables` replaced it); in `pay-mapping-report-data.test.ts` delete the two union tests, the two `computeHeaderBreaks` tests and both imports.
- In `apps/dashboard/components/pay-mapping/pay-mappings-section.test.tsx` the `usePayMappingReportExport` mock returns `{ busy: false, exportDocument: vi.fn() }` and the `usePayMappingArchiveExport` mock returns `{ busy: false, exportArchive: vi.fn() }` (no `captureHost` anywhere).
- Grep the dashboard for `ReportVariant`, `pay-mapping-report-doc`, `captureHost`, `chart-capture`, `unionReportDoc`, `logPayMappingReportExport`, `logPayMappingUnionReportExport`, `unionTitle`, `payMappingReportLabel`, `unionReportLabel` and remove every remaining reference (`lib/chart-capture.ts` and its test stay until Task 17 removes them with the other dead modules; they compile on their own).

Backend (the retired half of Task 11a's coexistence):
- `packages/backend/convex/lib/audit.ts`: delete `payMappingReportExported` and `payMappingUnionReportExported` from `AUDIT_EVENTS` and their two `AUDIT_SUBJECTS` entries.
- `packages/backend/convex/lib/auditPayloads.ts`: delete the `payMapping.reportExported` and `payMapping.unionReportExported` entries (the compile-time coverage guard fails until both sides agree).
- `packages/backend/convex/payMapping/report.ts`: delete `logPayMappingReportExport` and `logPayMappingUnionReportExport`.
- `packages/backend/convex/payMapping/report.test.ts`: delete the retired report and union tests, and change `rejects a run id from another org` to call `logPayMappingSigningReportExport`.

i18n (every locale):
- `dashboard.auditLog.events`: delete `payMappingReportExported` and `payMappingUnionReportExported` (the orphan-label test fails while a label outlives its event).
- `dashboard.help`: delete `payMappingReportLabel`, `payMappingReportBody`, `unionReportLabel`, `unionReportBody`.
- `dashboard.payMapping.report`: delete `docTitle`, `docDescription`, `downloadReport`, `downloadReportItem`, `unionTitle`, `unionDescription`, `unionSubtitle`, `unionPurpose`, `downloadUnion`, `downloadUnionItem` (the rest of the retired report keys go in Task 15).

- [ ] **Step 8: Run everything**

Run: `cd packages/backend && bunx tsc --noEmit -p convex && bun run test -- payMapping/report.test.ts`; `cd apps/dashboard && bunx tsc --noEmit && bun run test`; `cd packages/i18n && bun run test`; `bunx biome check packages/backend/convex apps/dashboard packages/i18n/messages`
Expected: PASS everywhere (the `audit-labels` orphan test passes only once the two old event labels are gone from `en.json`).

- [ ] **Step 9: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping)!: replace the documentation and union PDFs with the signing report and the detail appendix`

---

### Task 12: "Add action" on a practice area with a found deficiency

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/review-praxis-step.tsx`
- Modify: `apps/dashboard/components/pay-mapping/review-praxis-step.test.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx` (the praxis call site)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.payMapping.review.praxisActionLine`)

**Interfaces:**
- Produces: `ReviewPraxisStep` gains `actions: PayMappingActionWire[]` and `currency: string`; renders an outline button labeled `dashboard.payMapping.actions.createTitle` ("Create action") or `editTitle` when the area's finding is `found` and the step is not locked, opening `ActionDialog` with `target: { kind: "praxis", area }`.

- [ ] **Step 1: Write the failing tests**

In `apps/dashboard/components/pay-mapping/review-praxis-step.test.tsx`:
- extend `renderStep`'s overrides with `actions?: PayMappingActionWire[]`, pass `actions={overrides.actions ?? []}` and `currency="SEK"` to the component, and import `PayMappingActionWire` plus `onQuery` from `@/test/convex-mocks` (the action dialog's owner select queries `listActionOwners`; register `onQuery(() => [])` in `beforeEach`).
- add:

```tsx
  const found: GroupAnalysis = {
    scope: "praxis",
    groupKey: AREA,
    comparisonKey: null,
    reasons: [],
    note: "Criteria are unclear",
    done: false,
    finding: "found",
  }

  it("offers an action only when the area's finding is found", () => {
    renderStep({ analysis: { ...found, finding: "none" } })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
    cleanup()
    renderStep({ analysis: found })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeDefined()
  })

  it("opens the action dialog preset to the practice area", async () => {
    renderStep({ analysis: found })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    )
    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(
      screen.getByText(
        messages.dashboard.payMapping.actions.linkedTo.replace(
          "{target}",
          t.praxis.payPolicy.title
        )
      )
    ).toBeDefined()
  })

  it("cites an existing praxis action and offers to edit it, never a second create", () => {
    renderStep({
      analysis: found,
      actions: [
        {
          actionId: "a3" as Id<"payMappingActions">,
          number: 3,
          target: { kind: "praxis", area: AREA },
          problem: "Managers read the policy differently",
          plannedAction: "Rewrite the pay policy",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: Date.UTC(2026, 11, 1),
          estimatedCost: null,
          estimatedCostUnit: null,
          priority: "medium",
          status: "notStarted",
          erased: false,
          createdAt: 1,
        },
      ],
    })
    expect(
      screen.getByText(
        t.praxisActionLine
          .replace("{number}", "3")
          .replace("{action}", "Rewrite the pay policy")
      )
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.editTitle,
      })
    ).toBeDefined()
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
  })

  it("hides the action button on a locked run", () => {
    renderStep({ analysis: found, locked: true })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- review-praxis-step`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `apps/dashboard/components/pay-mapping/review-praxis-step.tsx`:
- add imports: `import { Button } from "@workspace/ui/components/button"`, `import { ActionDialog } from "./action-dialog"`, `import type { GroupAnalysis, PayMappingActionWire } from "./pay-mapping-gap-types"` (extend the existing type import), and `const tActions = useTranslations("dashboard.payMapping.actions")` beside the other translators;
- add the props `actions: PayMappingActionWire[]` and `currency: string` (documented: `// The run's actions and currency, for the "Create action" affordance a found deficiency offers (a praxis-targeted action, ADR-0030).`);
- add state `const [actionOpen, setActionOpen] = useState(false)` and the derivation

```ts
  // The first non-erased action anchored to this area: a found deficiency
  // offers ONE action to create or edit, never a second create.
  const existingAction = actions.find(
    (action) =>
      !action.erased &&
      action.target.kind === "praxis" &&
      action.target.area === area
  )
  const offersAction = finding === "found" && !locked
```

- render, after the note field's helper paragraph (inside the `w-full space-y-4` div):

```tsx
          {(offersAction || existingAction !== undefined) && (
            <div className="flex flex-wrap items-center gap-3">
              {existingAction !== undefined && (
                <p className="text-sm">
                  {t("praxisActionLine", {
                    number: existingAction.number,
                    action: existingAction.plannedAction,
                  })}
                </p>
              )}
              {offersAction && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionOpen(true)}
                >
                  {existingAction === undefined
                    ? tActions("createTitle")
                    : tActions("editTitle")}
                </Button>
              )}
            </div>
          )}
```

- render the dialog after `</ScreenShell>` inside the outer div, mounted only while open:

```tsx
      {actionOpen && (
        <ActionDialog
          open
          onOpenChange={setActionOpen}
          runId={runId}
          target={{ kind: "praxis", area }}
          targetLabel={t(`praxis.${area}.title`)}
          action={existingAction}
          currency={currency}
        />
      )}
```

In `apps/dashboard/components/pay-mapping/pay-mapping-analysis.tsx`'s praxis case pass `actions={actions}` and `currency={currency}` to `ReviewPraxisStep` (both are already in scope for the group step).

`packages/i18n/messages/en.json` under `dashboard.payMapping.review`: `"praxisActionLine": "Action #{number}: {action}"`. sv `"Åtgärd #{number}: {action}"`, nb `"Tiltak #{number}: {action}"`, da `"Tiltag #{number}: {action}"`, fi `"Toimenpide #{number}: {action}"`.

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- review-praxis-step pay-mapping-analysis`; `cd packages/i18n && bun run test`; `bunx biome check apps/dashboard/components/pay-mapping`
Expected: PASS.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): offer an action on a practice area with a found deficiency`

---

### Task 13: Action numbers and the practice scope in the actions overview

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/actions-overview.tsx`
- Modify: `apps/dashboard/components/pay-mapping/actions-overview.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.payMapping.actionsOverview.scopePraxis`)

- [ ] **Step 1: Write the failing tests**

In `apps/dashboard/components/pay-mapping/actions-overview.test.tsx` add:

```tsx
  it("shows each action's number and links a practice action to its area", () => {
    renderOverview({
      actions: [
        action({ number: 7 }),
        action({
          actionId: "a2" as Id<"payMappingActions">,
          number: 8,
          target: { kind: "praxis", area: "payPolicy" },
          problem: "Unclear criteria",
        }),
      ],
    })
    const rows = actionRowTexts()
    expect(rows[0]).toContain("#7")
    expect(rows[1]).toContain("#8")
    expect(rows[1]).toContain(
      messages.dashboard.payMapping.review.praxis.payPolicy.title
    )
    const link = screen.getByRole("link", {
      name: messages.dashboard.payMapping.review.praxis.payPolicy.title,
    })
    expect(link.getAttribute("href")).toBe(
      "/pay-mappings/2026/analysis/praxis?step=praxis:payPolicy"
    )
  })

  it("narrows to practice actions with the scope filter", async () => {
    renderOverview({
      actions: [
        action({ number: 1 }),
        action({
          actionId: "a2" as Id<"payMappingActions">,
          number: 2,
          target: { kind: "praxis", area: "benefits" },
          problem: "Bonus rules",
        }),
      ],
    })
    await pickSelectOption(screen.getByLabelText(mo.scopeAll), mo.scopePraxis)
    await waitFor(() => {
      expect(actionRowTexts()).toHaveLength(1)
    })
    expect(actionRowTexts()[0]).toContain("Bonus rules")
  })
```

(`action()` in this file already carries `number: 1` from Task 3's sweep; the overrides above set their own.)

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- actions-overview`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `apps/dashboard/components/pay-mapping/actions-overview.tsx`:
- the scope `Select`'s `items` and options gain `praxis: tOverview("scopePraxis")` after `equivalentWork`:

```tsx
              items={{
                all: tOverview("scopeAll"),
                equalWork: tOverview("scopeEqualWork"),
                equivalentWork: tOverview("scopeEquivalentWork"),
                praxis: tOverview("scopePraxis"),
              }}
              ...
                <SelectItem value="praxis">
                  {tOverview("scopePraxis")}
                </SelectItem>
```

and its comment becomes `// The options are exactly targetScope's range: the two comparison chapters and the practice review.`;
- one module constant sizes the number column in the header AND the skeleton, so the two can never drift: add `const NUMBER_COLUMN_WIDTH = "w-14"` next to `PAGE_SIZE`;
- the actions table gains a leading number column: in the header, before the status head, `<TableHead className={NUMBER_COLUMN_WIDTH}>{t("number")}</TableHead>`; in the body, before the status cell:

```tsx
                            <TableCell className="tabular-nums">
                              #{action.number}
                            </TableCell>
```

- `ACTION_SKELETON_COLUMNS` gains a first entry `{ className: NUMBER_COLUMN_WIDTH }` so the skeleton keeps the column count and the column's width (skeleton rows must measure identical to data rows);
- widen the table's `min-w-[60rem]` to `min-w-[64rem]`.

`packages/i18n/messages/en.json` under `dashboard.payMapping.actionsOverview` after `scopeEquivalentWork`: `"scopePraxis": "Practice"`. sv `"Praxis"`, nb `"Praksis"`, da `"Praksis"`, fi `"Käytäntö"`.

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- actions-overview`; `cd packages/i18n && bun run test`; `bunx biome check apps/dashboard/components/pay-mapping/actions-overview.tsx`
Expected: PASS.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): show action numbers and filter the overview by practice`

---

### Task 14: The collaboration date picker

**Files:**
- Create: `apps/dashboard/lib/iso-date.ts`
- Modify: `apps/dashboard/components/date-picker.tsx` (`disabled` prop on the app primitive)
- Modify: `apps/dashboard/components/pay-mapping/action-dialog.tsx` (use the shared helpers)
- Modify: `apps/dashboard/components/pay-mapping/review-start-step.tsx`
- Modify: `apps/dashboard/components/pay-mapping/review-start-step.test.tsx`

**Interfaces:**
- Produces: `isoToMs(iso: string): number` and `msToIso(ms: number): string` in `lib/iso-date.ts` (UTC midnight, the convention the action dialog already uses); `ReviewStartStep` renders a `DatePicker` labeled `dashboard.payMapping.review.collaborationDate` after the two text fields and saves `date` through `setPayMappingCollaboration`.

- [ ] **Step 1: Write the failing tests**

In `apps/dashboard/components/pay-mapping/review-start-step.test.tsx`, extend `renderStep`'s `collaboration` override type to `{ participants: string; description: string; date: number | null } | null` and add:

```tsx
  it("shows the recorded collaboration date and sends it with every save", async () => {
    renderStep({
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      },
    })
    const picker = screen.getByRole("button", { name: t.collaborationDate })
    expect(picker.textContent).toContain("Sep 15, 2026")

    const participants = screen.getByLabelText(t.collaborationParticipants)
    fireEvent.change(participants, { target: { value: "Union rep, HR" } })
    fireEvent.blur(participants)
    await waitFor(() => {
      expect(setCollaborationMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        participants: "Union rep, HR",
        description: "Monthly",
        date: Date.UTC(2026, 8, 15),
      })
    })
  })

  it("omits the date when none is set and disables the picker on a locked run", () => {
    renderStep({
      collaboration: { participants: "A", description: "B", date: null },
      locked: true,
    })
    const picker = screen.getByRole("button", {
      name: t.collaborationDate,
    }) as HTMLButtonElement
    expect(picker.disabled).toBe(true)
    expect(picker.textContent).toContain(messages.dashboard.datePicker.placeholder)
  })
```

The existing tests that assert the exact `setCollaborationMock` call shape keep passing unchanged: the mutation call OMITS `date` when no day is set (the backend treats an omitted date as cleared), so their `{ orgId, runId, participants, description }` expectations stay exact.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- review-start-step`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/dashboard/lib/iso-date.ts`:

```ts
// The day-precision convention shared by every surface that stores a day as
// epoch ms (an action's planned date, the run's collaboration date): the
// ISO day string the DatePicker binds to maps to UTC midnight, and back.
export function isoToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`)
}

export function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
```

In `apps/dashboard/components/pay-mapping/action-dialog.tsx` delete the local `isoToMs`/`msToIso` and `import { isoToMs, msToIso } from "@/lib/iso-date"`.

In `apps/dashboard/components/pay-mapping/review-start-step.tsx`:
- imports: `import { DatePicker } from "@/components/date-picker"` and `import { isoToMs, msToIso } from "@/lib/iso-date"`; the `collaboration` prop type becomes `{ participants: string; description: string; date: number | null } | null`;
- state: `const [date, setDate] = useState(() => collaboration?.date === null || collaboration?.date === undefined ? "" : msToIso(collaboration.date))` and a mirror `const dateRefValue = useRef(date); dateRefValue.current = date`; `lastSavedRef` gains `date: string` (the ISO string or `""`), seeded the same way;
- the re-seed effect keys additionally on `propDate = collaboration?.date ?? null` and its `isDirty` check includes `date !== lastSavedRef.current.date`; when not dirty it sets `lastSavedRef.current.date` and `setDate(propDate === null ? "" : msToIso(propDate))` (a popover trigger is never "focused mid-edit" the way a textarea is, so no focus guard);
- `saveNow` reads `date: dateRefValue.current`, includes it in the no-op comparison, and calls

```ts
      await setCollaboration({
        orgId,
        runId,
        participants: current.participants,
        description: current.description,
        ...(current.date === "" ? {} : { date: isoToMs(current.date) }),
      })
```

- render, after the description field's `div`:

```tsx
          <div className="space-y-2">
            {/* No htmlFor: the picker's trigger carries its own accessible
                name (ariaLabel), so the visible label is plain text. */}
            <Label>{t("collaborationDate")}</Label>
            <DatePicker
              value={date}
              disabled={locked}
              onChange={(value) => {
                setDate(value)
                // A pick is a deliberate act: save it now, not after the
                // text fields' debounce.
                if (timerRef.current !== null) {
                  clearTimeout(timerRef.current)
                  timerRef.current = null
                }
                dateRefValue.current = value
                void saveNow()
              }}
              ariaLabel={t("collaborationDate")}
            />
          </div>
```

The locked state is the same primitive, disabled, so the row never reflows between states. `DatePicker` has no `disabled` prop yet: add it to the app primitive rather than hand-rolling a second trigger. In `apps/dashboard/components/date-picker.tsx` extend the props

```ts
export function DatePicker({
  value,
  onChange,
  onBlur,
  ariaLabel,
  disabled = false,
  ref,
}: {
  // ISO date string, "" when unset.
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  ariaLabel: string
  // A read-only surface (a completed pay mapping) shows the value but takes
  // no pick: the trigger disables and the popover never opens.
  disabled?: boolean
  ref?: React.Ref<HTMLButtonElement>
}) {

and pass `disabled={disabled}` to the trigger `Button` inside `PopoverTrigger`'s `render` prop (next to `aria-label={ariaLabel}`), plus `open={open && !disabled}` on the `Popover` so a disabled trigger can never leave a popover open. Every existing `DatePicker` call site keeps compiling (the prop is optional).

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test -- review-start-step action-dialog date-picker`; `bunx biome check apps/dashboard/components/pay-mapping apps/dashboard/components/date-picker.tsx apps/dashboard/lib/iso-date.ts`
Expected: PASS.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `feat(pay-mapping): record the samverkan date in the collaboration step`

---

### Task 15: i18n closure: retire the old report keys and QA every locale

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

The strings the new surfaces need were added in Tasks 1, 2, 5, 11a, 11b, 12, 13 and 14, each in all five locales. This task removes what the retired documentation PDF left behind and reads the five files against each other once.

- [ ] **Step 1: Delete the retired keys in every locale**

Remove exactly these keys from `dashboard.payMapping.report` in `en.json`, then the same keys in `sv.json`, `nb.json`, `da.json` and `fi.json` (the parity test fails until all five agree). The typed translation keys are the gate: `cd apps/dashboard && bunx tsc --noEmit` fails on any `t("...")` call that still reads a deleted key, and a key the typecheck rejects deleting is put back and reported.

Keys only the retired document component and its export hook read: `introTitle`, `introBody`, `orgGapLine`, `orgGapUnmeasurable`, `praxisTitle`, `praxisIntro`, `equalWorkIntro`, `baseLine`, `colWomenMean`, `colMenMean`, `colGapKr`, `equivalentTitle`, `equivalentIntro`, `levelsSignNote`, `womenDominatedTitle`, `womenDominatedIntro`, `actionsIntro`, `actionTotals`, `actionTotalsNoCost`, `evaluationTitle`, `evaluationIntro`, `evaluationStatusNote`, `methodTitle`, `methodBody`, `maskingNote`, `orgMedianLine`, `orgPreviousLine`, `chartMeansCaption`, `chartSpreadCaption`, `spreadTitle`, `colP10`, `colQ1`, `colMedian`, `colQ3`, `colP90`, `medianShort`, `scopeNote`, `individualNote`, `statisticsNote`, `summaryTitle`, `summaryEmployees`, `summaryWomen`, `summaryMen`, `summaryPriced`, `summaryWomenShareMean`, `summaryWomenShareMedian`, `summaryGroupsShown`, `summaryGroupsRequired`, `summaryGroupsDocumented`, `summarySingletons`, `summaryWdGroups`, `summaryComparisons`, `summaryComparisonsDocumented`, `summaryActionsCount`, `summaryVariableShareWomen`, `summaryVariableShareMen`, `summaryVariableWomenShareMean`, `summaryVariableWomenShareMedian`, `equalWorkStatusLine`, `wdStatusLine`.

Candidates the review flagged: `equalWorkTitle`, `levelsTitle`, `colGapPct`. At plan time `pay-mapping-metrics-export.ts` reads all three through its `dashboard.payMapping.report` translator (`equalWorkTitle: t("equalWorkTitle")`, `levelsTitle: t("levelsTitle")`, `colGapPct: t("colGapPct")`), so the typecheck is expected to reject their deletion; delete them only if it does not, and otherwise leave them and say so in the summary.

No grep script decides this list (a namespace-blind search matches `tSigning("praxisTitle")` for `report.praxisTitle`); the list above plus the typecheck does.

- [ ] **Step 2: Cross-locale QA pass**

Read, side by side, every key added by this plan in nb, da and fi against sv and en: `dashboard.payMapping.signingReport.*`, `dashboard.payMapping.detailAppendix.*`, `dashboard.payMapping.analysisStatus.*`, `dashboard.payMapping.report.{signingTitle,signingDescription,downloadSigning,downloadSigningItem,detailTitle,detailDescription,downloadDetail,downloadDetailItem,extractedAtLine,methodVersionLine,methodVersionUnapproved,archiveDescription,archiveNotice}`, `dashboard.payMapping.actions.{number,targetKind.praxis}`, `dashboard.payMapping.actionsOverview.scopePraxis`, `dashboard.payMapping.review.{collaborationDate,praxisActionLine}`, `dashboard.help.{signingReportLabel,signingReportBody,detailAppendixLabel,detailAppendixBody}`, `dashboard.auditLog.events.{payMappingSigningReportExported,payMappingDetailAppendixExported}`, `dashboard.auditLog.fields.collaborationDate`. Check: false friends, register (the documents speak formally, the UI plainly), terminology drift against the locale's existing `report.*` vocabulary (equal/equivalent work, objective reasons, collaboration, action plan, key figures), ICU plural forms (`one`/`other` in every Nordic locale; placeholder names identical to en), no em dash anywhere, and the help-body caps (200 en, 240 others). Fix in place.

- [ ] **Step 3: Run the i18n and dashboard tests**

Run: `cd packages/i18n && bun run test`; `cd apps/dashboard && bunx tsc --noEmit && bun run test -- audit-labels pay-mapping`; `bunx biome check packages/i18n/messages`
Expected: PASS (a typed key that a surface still reads fails the dashboard typecheck; that is the gate on the deletion list).

- [ ] **Step 4: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `chore(i18n): retire the documentation report's strings`

---

### Task 16: The guide page, the nav, the glossary and the sync

**Files:**
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/pay-mapping-reports.mdx`
- Modify: `apps/dashboard/lib/docs/docs-nav.ts`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/glossary.mdx` (the Collaboration entry)
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/collaboration.mdx` (the "Recording collaboration" section)

- [ ] **Step 1: Register the slug (the guards fail until the five files exist)**

In `apps/dashboard/lib/docs/docs-nav.ts`, in the `pay-mapping` section, insert `"pay-mapping-reports",` directly after `"starting-a-pay-mapping",`.

Run: `cd apps/dashboard && bun run test -- docs-guards`
Expected: FAIL on guard 1 (locale parity: the slug has no files).

- [ ] **Step 2: Write the English page**

Create `apps/dashboard/content/docs/en/pay-mapping-reports.mdx`:

```mdx
---
title: Reports and downloads
description: The signing report, the detail appendix, the key-figures workbook and the archive package, who each is for, what is masked where, and how every download is logged.
section: pay-mapping
---

Every pay mapping has a Reports tab with four downloads, all built from
that mapping's frozen snapshot and nothing else. The same four sit behind
the row menu on the [pay mappings](/pay-mappings) list, under "Download".

## The signing report

"Signing report" is the document you share with the union parties and
sign together: six to eight pages of aggregates, counts, statuses,
conclusions and the action plan. Its first page prints who took part in
the collaboration, how it happened and the collaboration date recorded in
the [Collaboration](/docs/collaboration) chapter, with blank signature
lines for the employer and the union party. Signing happens on paper;
there is no in-app signing.

It never prints a group's amount. A gender-split figure is masked when the
group has fewer than 4 people or fewer than 2 of either gender, and a
whole-group figure when the group has fewer than 4 people; the report
states how many groups have insufficient basis for broad reporting and
that the appendix shows them in full. The summary page shows women's
median and average pay as a share of men's, the pay-quartile
distribution, and the counts behind one status per equal-work group and
equivalent-work comparison: no action needed, objective reason documented,
action decided, or further analysis. The last page carries a pre-signing
checklist computed from the mapping: every comparison requiring
documentation is assessed, reasons or actions are linked, collaboration is
documented, and both documents derive from the same frozen version.

## The detail appendix

"Detail appendix" is the complete written documentation: every equal-work
group with its base salary and total compensation figures, medians,
status, reasons, note and linked actions; every women-dominated group and
every comparison; every practice area, the collaboration record, every
action with all its fields and every note; and the frozen method with
criteria, weights, level and zone rules, the working-conditions decision
and the thresholds. Nothing is masked, and the document says so.

Any member of the organization can download it. There is no role gate:
every download is recorded in the [audit log](/docs/audit-log) as
"Detail appendix exported", and the log is the control. The cover states
that the document is internal, contains person-near pay data and is
intended for the organization's HR function and, on request, the
collaboration parties.

## Draft and final

Both documents label themselves "DRAFT: the pay mapping is not yet
completed" until the mapping is completed and "FINAL" afterwards; see
[Pay mapping lifecycle and statuses](/docs/run-lifecycle). Both carry the
same identity block: organization, mapping name, reference date, data
extraction time, method version and generation time, so a signing report
and a detail appendix from the same mapping always match.

## Key figures (Excel)

"Key figures" is a workbook with the organization's pay-gap figures and
the per-group tables, written as numbers for further analysis in other
tools. Small groups are masked there under the same thresholds as the
signing report, and the sheet's own note explains the empty cells.

## The archive package

"Archive package" is a ZIP holding the signing report, the detail
appendix, the key-figures workbook and a manifest that lists each file
with its size and SHA-256 checksum, so the package's integrity can be
verified later. Keep it for at least five years.

## Every download is logged

Each download writes its own audit entry before the file is handed over:
"Signing report exported", "Detail appendix exported", "Pay mapping key
figures exported" or "Archive package exported". If the entry cannot be
written, no file is downloaded and the app asks you to try again.

## Related

- [Collaboration](/docs/collaboration)
- [Actions and notes](/docs/actions-and-notes)
- [Audit log](/docs/audit-log)
- [Pay mapping lifecycle and statuses](/docs/run-lifecycle)
```

- [ ] **Step 3: Write the Swedish page**

Create `apps/dashboard/content/docs/sv/pay-mapping-reports.mdx`:

```mdx
---
title: Rapporter och nedladdningar
description: Signeringsrapporten, detaljbilagan, nyckeltalsarbetsboken och arkivpaketet, vem varje dokument är till för, vad som maskeras var, och hur varje nedladdning loggas.
section: pay-mapping
---

Varje lönekartläggning har en flik Rapporter med fyra nedladdningar,
alla byggda ur just den kartläggningens frysta ögonblicksbild och inget
annat. Samma fyra finns bakom radmenyn på listan
[Lönekartläggningar](/pay-mappings), under "Ladda ner".

## Signeringsrapporten

"Signeringsrapport" är dokumentet ni delar med de fackliga parterna och
signerar tillsammans: sex till åtta sidor med aggregat, antal, statusar,
slutsatser och handlingsplan. Första sidan skriver ut vilka som deltog i
samverkan, hur den skedde och det samverkansdatum som registrerats i
kapitlet [Samverkan](/docs/collaboration), med tomma
underskriftsrader för arbetsgivaren och den fackliga parten. Signeringen
sker på papper; det finns ingen signering i appen.

Den skriver aldrig ut en grupps belopp. En könsuppdelad siffra maskeras
när gruppen har färre än 4 personer eller färre än 2 av något kön, och en
helgruppssiffra när gruppen har färre än 4 personer; rapporten anger hur
många grupper som har otillräckligt underlag för bred redovisning och att
bilagan visar dem i sin helhet. Sammanfattningssidan visar kvinnors
median- och medellön i procent av männens, fördelningen per lönekvartil
och antalen bakom en status per grupp med lika arbete och per jämförelse
av likvärdigt arbete: ingen åtgärd behövs, sakligt skäl dokumenterat,
åtgärd beslutad eller fortsatt analys. Sista sidan bär en checklista före
signering, beräknad ur kartläggningen: alla jämförelser som kräver
dokumentation är bedömda, skäl eller åtgärder är kopplade, samverkan är
dokumenterad, och båda dokumenten härrör från samma frysta version.

## Detaljbilagan

"Detaljbilaga" är den fullständiga skriftliga dokumentationen: varje grupp
med lika arbete med sina siffror för grundlön och total ersättning,
medianer, status, skäl, anteckning och kopplade åtgärder; varje
kvinnodominerad grupp och varje jämförelse; varje praxisområde,
samverkansposten, varje åtgärd med alla sina fält och varje notering;
samt den frysta metoden med kriterier, vikter, nivå- och zonregler,
beslutet om arbetsförhållanden och trösklarna. Inget maskeras, och
dokumentet säger det.

Vilken medlem i organisationen som helst kan ladda ner den. Det finns
ingen rollspärr: varje nedladdning registreras i
[revisionsloggen](/docs/audit-log) som "Detaljbilaga exporterad", och
loggen är kontrollen. Omslaget anger att dokumentet är internt, innehåller
personnära löneuppgifter och är avsett för organisationens HR-funktion
och, på begäran, samverkansparterna.

## Utkast och slutgiltig

Båda dokumenten märker sig själva "UTKAST: kartläggningen är inte
slutförd" tills kartläggningen är slutförd och "SLUTGILTIG" därefter; se
[Lönekartläggningens livscykel och statusar](/docs/run-lifecycle). Båda
bär samma identitetsblock: organisation, kartläggningens namn,
referensdatum, tidpunkt för datauttag, metodversion och genereringstid,
så en signeringsrapport och en detaljbilaga från samma kartläggning alltid
stämmer överens.

## Nyckeltal (Excel)

"Nyckeltal" är en arbetsbok med organisationens lönegapssiffror och
tabellerna per grupp, skrivna som tal för vidare analys i andra verktyg.
Små grupper maskeras där enligt samma trösklar som i signeringsrapporten,
och arbetsbokens egen not förklarar de tomma cellerna.

## Arkivpaketet

"Arkivpaket" är en ZIP med signeringsrapporten, detaljbilagan,
nyckeltalsarbetsboken och ett manifest som anger varje fil med storlek
och SHA-256-kontrollsumma, så att paketets integritet kan verifieras
senare. Bevara det i minst fem år.

## Varje nedladdning loggas

Varje nedladdning skriver sin egen revisionspost innan filen lämnas ut:
"Signeringsrapport exporterad", "Detaljbilaga exporterad",
"Lönekartläggningens nyckeltal exporterade" eller "Arkivpaket
exporterat". Kan posten inte skrivas laddas ingen fil ner och appen ber
dig försöka igen.

## Relaterat

- [Samverkan](/docs/collaboration)
- [Åtgärder och noteringar](/docs/actions-and-notes)
- [Revisionslogg](/docs/audit-log)
- [Lönekartläggningens livscykel och statusar](/docs/run-lifecycle)
```

Check the two quoted link titles against the sv files' own frontmatter titles (`run-lifecycle`, `actions-and-notes`, `audit-log`) and use the exact titles those pages carry.

- [ ] **Step 4: Write the nb, da and fi pages**

The three pages keep exactly the English page's heading sequence (seven h2 headings in the same order), the same link targets in the same order, the same frontmatter `section`, and no em dash. Every quoted app string (the four audit event labels, the two status tags, the panel titles, the four statuses, the "Download" word) must be the locale's own string from its message file, and every link title the target page's own frontmatter title in that locale: check both before saving, and replace a quotation below that differs.

Create `apps/dashboard/content/docs/nb/pay-mapping-reports.mdx`:

```mdx
---
title: Rapporter og nedlastinger
description: Signeringsrapporten, detaljvedlegget, nøkkeltallsarbeidsboken og arkivpakken, hvem hvert dokument er for, hva som maskeres hvor, og hvordan hver nedlasting logges.
section: pay-mapping
---

Hver lønnskartlegging har en fane Rapporter med fire nedlastinger, alle
bygget fra akkurat den kartleggingens fryste øyeblikksbilde og ingenting
annet. De samme fire ligger bak radmenyen på listen
[Lønnskartlegginger](/pay-mappings), under "Last ned".

## Signeringsrapporten

"Signeringsrapport" er dokumentet dere deler med fagforeningspartene og
signerer sammen: seks til åtte sider med aggregater, antall, statuser,
konklusjoner og handlingsplan. Første side skriver ut hvem som deltok i
samarbeidet, hvordan det foregikk og samarbeidsdatoen som er registrert i
kapittelet [Samarbeid](/docs/collaboration), med tomme signaturlinjer for
arbeidsgiveren og fagforeningsparten. Signeringen skjer på papir; det
finnes ingen signering i appen.

Den skriver aldri ut en gruppes beløp. Et kjønnsdelt tall maskeres når
gruppen har færre enn 4 personer eller færre enn 2 av et kjønn, og et tall
for hele gruppen når gruppen har færre enn 4 personer; rapporten oppgir
hvor mange grupper som har utilstrekkelig grunnlag for bred rapportering,
og at vedlegget viser dem i sin helhet. Sammendragssiden viser kvinners
median- og gjennomsnittslønn i prosent av menns, fordelingen per
lønnskvartil og tallene bak én status per gruppe med likt arbeid og per
sammenligning av likeverdig arbeid: ingen tiltak nødvendig, saklig grunn
dokumentert, tiltak besluttet eller videre analyse. Siste side bærer en
sjekkliste før signering, beregnet fra kartleggingen: alle sammenligninger
som krever dokumentasjon er vurdert, grunner eller tiltak er koblet,
samarbeidet er dokumentert, og begge dokumentene stammer fra samme fryste
versjon.

## Detaljvedlegget

"Detaljvedlegg" er den fullstendige skriftlige dokumentasjonen: hver
gruppe med likt arbeid med sine tall for grunnlønn og total godtgjørelse,
medianer, status, grunner, notat og koblede tiltak; hver kvinnedominerte
gruppe og hver sammenligning; hvert praksisområde, samarbeidsposten, hvert
tiltak med alle sine felt og hvert notat; samt den fryste metoden med
kriterier, vekter, nivå- og soneregler, beslutningen om arbeidsforhold og
tersklene. Ingenting er maskert, og dokumentet sier det.

Ethvert medlem av organisasjonen kan laste det ned. Det finnes ingen
rollesperre: hver nedlasting registreres i
[revisjonsloggen](/docs/audit-log) som "Detaljvedlegg eksportert", og
loggen er kontrollen. Omslaget oppgir at dokumentet er internt, inneholder
personnære lønnsopplysninger og er ment for organisasjonens HR-funksjon
og, på forespørsel, samarbeidspartene.

## Utkast og endelig

Begge dokumentene merker seg selv "UTKAST: kartleggingen er ikke fullført"
til kartleggingen er fullført og "ENDELIG" deretter; se
[Lønnskartleggingens livssyklus og statuser](/docs/run-lifecycle). Begge
bærer samme identitetsblokk: organisasjon, kartleggingens navn,
referansedato, tidspunkt for datauttrekk, metodeversjon og
genereringstidspunkt, slik at en signeringsrapport og et detaljvedlegg fra
samme kartlegging alltid stemmer overens.

## Nøkkeltall (Excel)

"Nøkkeltall" er en arbeidsbok med organisasjonens lønnsgapstall og
tabellene per gruppe, skrevet som tall for videre analyse i andre verktøy.
Små grupper maskeres der etter de samme tersklene som i
signeringsrapporten, og arbeidsbokens egen merknad forklarer de tomme
cellene.

## Arkivpakken

"Arkivpakke" er en ZIP med signeringsrapporten, detaljvedlegget,
nøkkeltallsarbeidsboken og et manifest som oppgir hver fil med størrelse
og SHA-256-kontrollsum, slik at pakkens integritet kan verifiseres senere.
Oppbevar den i minst fem år.

## Hver nedlasting logges

Hver nedlasting skriver sin egen revisjonspost før filen leveres ut:
"Signeringsrapport eksportert", "Detaljvedlegg eksportert",
"Lønnskartleggingens nøkkeltall eksportert" eller "Arkivpakke
eksportert". Kan posten ikke skrives, lastes ingen fil ned, og appen ber
deg prøve igjen.

## Relatert

- [Samarbeid](/docs/collaboration)
- [Tiltak og notater](/docs/actions-and-notes)
- [Revisjonslogg](/docs/audit-log)
- [Lønnskartleggingens livssyklus og statuser](/docs/run-lifecycle)
```

Create `apps/dashboard/content/docs/da/pay-mapping-reports.mdx`:

```mdx
---
title: Rapporter og downloads
description: Signeringsrapporten, detaljebilaget, nøgletalsarbejdsbogen og arkivpakken, hvem hvert dokument er til, hvad der maskeres hvor, og hvordan hver download logges.
section: pay-mapping
---

Hver lønkortlægning har en fane Rapporter med fire downloads, alle bygget
af netop den kortlægnings frosne øjebliksbillede og intet andet. De samme
fire ligger bag rækkemenuen på listen
[Lønkortlægninger](/pay-mappings), under "Hent".

## Signeringsrapporten

"Signeringsrapport" er det dokument, I deler med fagforeningsparterne og
underskriver sammen: seks til otte sider med aggregater, antal, statusser,
konklusioner og handlingsplan. Første side udskriver, hvem der deltog i
samarbejdet, hvordan det foregik, og den samarbejdsdato, der er registreret
i kapitlet [Samarbejde](/docs/collaboration), med tomme underskriftslinjer
for arbejdsgiveren og fagforeningsparten. Underskriften sker på papir; der
findes ingen underskrift i appen.

Den udskriver aldrig en gruppes beløb. Et kønsopdelt tal maskeres, når
gruppen har færre end 4 personer eller færre end 2 af et køn, og et tal
for hele gruppen, når gruppen har færre end 4 personer; rapporten angiver,
hvor mange grupper der har utilstrækkeligt grundlag for bred rapportering,
og at bilaget viser dem i deres helhed. Sammenfatningssiden viser kvinders
median- og gennemsnitsløn i procent af mænds, fordelingen per lønkvartil
og tallene bag én status per gruppe med lige arbejde og per sammenligning
af ligeværdigt arbejde: intet tiltag nødvendigt, saglig grund
dokumenteret, tiltag besluttet eller videre analyse. Sidste side bærer en
tjekliste før underskrift, beregnet ud fra kortlægningen: alle
sammenligninger, der kræver dokumentation, er vurderet, grunde eller
tiltag er koblet, samarbejdet er dokumenteret, og begge dokumenter stammer
fra samme frosne version.

## Detaljebilaget

"Detaljebilag" er den fuldstændige skriftlige dokumentation: hver gruppe
med lige arbejde med sine tal for grundløn og samlet aflønning, medianer,
status, grunde, notat og koblede tiltag; hver kvindedomineret gruppe og
hver sammenligning; hvert praksisområde, samarbejdsposten, hvert tiltag
med alle sine felter og hvert notat; samt den frosne metode med
kriterier, vægte, niveau- og zoneregler, beslutningen om arbejdsforhold og
tærsklerne. Intet er maskeret, og dokumentet siger det.

Ethvert medlem af organisationen kan downloade det. Der er ingen
rollespærre: hver download registreres i
[revisionsloggen](/docs/audit-log) som "Detaljebilag eksporteret", og
loggen er kontrollen. Omslaget angiver, at dokumentet er internt,
indeholder personnære lønoplysninger og er beregnet til organisationens
HR-funktion og, på anmodning, samarbejdsparterne.

## Udkast og endelig

Begge dokumenter mærker sig selv "UDKAST: kortlægningen er ikke afsluttet",
indtil kortlægningen er afsluttet, og "ENDELIG" derefter; se
[Lønkortlægningens livscyklus og statusser](/docs/run-lifecycle). Begge
bærer samme identitetsblok: organisation, kortlægningens navn,
referencedato, tidspunkt for dataudtræk, metodeversion og
genereringstidspunkt, så en signeringsrapport og et detaljebilag fra samme
kortlægning altid stemmer overens.

## Nøgletal (Excel)

"Nøgletal" er en arbejdsbog med organisationens løngabstal og tabellerne
per gruppe, skrevet som tal til videre analyse i andre værktøjer. Små
grupper maskeres der efter de samme tærskler som i signeringsrapporten, og
arbejdsbogens egen note forklarer de tomme celler.

## Arkivpakken

"Arkivpakke" er en ZIP med signeringsrapporten, detaljebilaget,
nøgletalsarbejdsbogen og et manifest, der angiver hver fil med størrelse
og SHA-256-kontrolsum, så pakkens integritet kan verificeres senere.
Opbevar den i mindst fem år.

## Hver download logges

Hver download skriver sin egen revisionspost, før filen udleveres:
"Signeringsrapport eksporteret", "Detaljebilag eksporteret",
"Lønkortlægningens nøgletal eksporteret" eller "Arkivpakke eksporteret".
Kan posten ikke skrives, downloades ingen fil, og appen beder dig prøve
igen.

## Relateret

- [Samarbejde](/docs/collaboration)
- [Tiltag og notater](/docs/actions-and-notes)
- [Revisionslog](/docs/audit-log)
- [Lønkortlægningens livscyklus og statusser](/docs/run-lifecycle)
```

Create `apps/dashboard/content/docs/fi/pay-mapping-reports.mdx`:

```mdx
---
title: Raportit ja lataukset
description: Allekirjoitusraportti, yksityiskohtaliite, tunnuslukutyökirja ja arkistopaketti, kenelle kukin on tarkoitettu, mitä peitetään missäkin ja miten jokainen lataus kirjataan lokiin.
section: pay-mapping
---

Jokaisella palkkakartoituksella on Raportit-välilehti, jolla on neljä
latausta, kaikki koottu juuri sen kartoituksen jäädytetystä
tilannekuvasta eikä mistään muusta. Samat neljä löytyvät
[Palkkakartoitukset](/pay-mappings)-listan rivivalikosta kohdasta "Lataa".

## Allekirjoitusraportti

"Allekirjoitusraportti" on asiakirja, jonka jaatte ammattiliitto-osapuolten
kanssa ja allekirjoitatte yhdessä: kuudesta kahdeksaan sivua
kokonaislukuja, määriä, tiloja, johtopäätöksiä ja toimenpideohjelma.
Ensimmäinen sivu tulostaa, ketkä osallistuivat yhteistoimintaan, miten se
tapahtui ja luvussa [Yhteistoiminta](/docs/collaboration) kirjatun
yhteistoiminnan päivän, sekä tyhjät allekirjoitusrivit työnantajalle ja
ammattiliitto-osapuolelle. Allekirjoitus tapahtuu paperilla; sovelluksessa
ei ole allekirjoitusta.

Se ei koskaan tulosta ryhmän summaa. Sukupuolittain jaettu luku peitetään,
kun ryhmässä on alle 4 henkilöä tai alle 2 jompaakumpaa sukupuolta, ja
koko ryhmän luku, kun ryhmässä on alle 4 henkilöä; raportti kertoo, kuinka
monella ryhmällä on riittämätön pohja laajaan raportointiin ja että liite
näyttää ne kokonaisuudessaan. Yhteenvetosivu näyttää naisten
mediaani- ja keskipalkan prosentteina miesten palkasta, jakauman
palkkakvartiileittain sekä luvut yhden tilan takana kutakin samaa työtä
tekevää ryhmää ja kutakin samanarvoisen työn vertailua kohti: toimenpidettä
ei tarvita, asiallinen peruste dokumentoitu, toimenpide päätetty tai
jatkoanalyysi. Viimeisellä sivulla on kartoituksesta laskettu
tarkistuslista ennen allekirjoitusta: kaikki dokumentointia vaativat
vertailut on arvioitu, perusteet tai toimenpiteet on kytketty,
yhteistoiminta on dokumentoitu ja molemmat asiakirjat perustuvat samaan
jäädytettyyn versioon.

## Yksityiskohtaliite

"Yksityiskohtaliite" on täydellinen kirjallinen dokumentaatio: jokainen
samaa työtä tekevä ryhmä peruspalkan ja kokonaiskorvauksen lukuineen,
mediaaneineen, tiloineen, perusteineen, merkintöineen ja kytkettyine
toimenpiteineen; jokainen naisvaltainen ryhmä ja jokainen vertailu;
jokainen käytäntöalue, yhteistoimintakirjaus, jokainen toimenpide kaikkine
kenttineen ja jokainen merkintä; sekä jäädytetty menetelmä kriteereineen,
painoineen, vaativuustaso- ja vyöhykesääntöineen, työolopäätöksineen ja
kynnysarvoineen. Mitään ei peitetä, ja asiakirja sanoo sen.

Kuka tahansa organisaation jäsen voi ladata sen. Roolirajoitusta ei ole:
jokainen lataus kirjataan [lokikirjaan](/docs/audit-log) merkinnällä
"Yksityiskohtaliite viety", ja loki on valvontakeino. Kansi kertoo, että
asiakirja on sisäinen, sisältää henkilöön liittyviä palkkatietoja ja on
tarkoitettu organisaation HR-toiminnolle sekä pyynnöstä
yhteistoimintaosapuolille.

## Luonnos ja lopullinen

Molemmat asiakirjat merkitsevät itsensä "LUONNOS: kartoitusta ei ole viety
loppuun", kunnes kartoitus on valmis, ja sen jälkeen "LOPULLINEN"; katso
[Palkkakartoituksen elinkaari ja tilat](/docs/run-lifecycle). Molemmissa
on sama tunnistelohko: organisaatio, kartoituksen nimi, viitepäivä,
tietojen poimintahetki, menetelmäversio ja luontiaika, joten saman
kartoituksen allekirjoitusraportti ja yksityiskohtaliite täsmäävät aina.

## Tunnusluvut (Excel)

"Tunnusluvut" on työkirja, jossa ovat organisaation palkkaerot ja
ryhmäkohtaiset taulukot lukuina jatkoanalyysiä varten muissa työkaluissa.
Pienet ryhmät peitetään siellä samoilla kynnysarvoilla kuin
allekirjoitusraportissa, ja työkirjan oma huomautus selittää tyhjät solut.

## Arkistopaketti

"Arkistopaketti" on ZIP-tiedosto, jossa ovat allekirjoitusraportti,
yksityiskohtaliite, tunnuslukutyökirja ja manifesti, joka luettelee
jokaisen tiedoston kokoineen ja SHA-256-tarkistussummineen, jotta paketin
eheys voidaan todentaa myöhemmin. Säilytä se vähintään viisi vuotta.

## Jokainen lataus kirjataan lokiin

Jokainen lataus kirjoittaa oman lokimerkintänsä ennen tiedoston
luovuttamista: "Allekirjoitusraportti viety", "Yksityiskohtaliite viety",
"Palkkakartoituksen tunnusluvut viety" tai "Arkistopaketti viety". Jos
merkintää ei voida kirjoittaa, tiedostoa ei ladata, ja sovellus pyytää
yrittämään uudelleen.

## Aiheeseen liittyvää

- [Yhteistoiminta](/docs/collaboration)
- [Toimenpiteet ja merkinnät](/docs/actions-and-notes)
- [Lokikirja](/docs/audit-log)
- [Palkkakartoituksen elinkaari ja tilat](/docs/run-lifecycle)
```

- [ ] **Step 5: The glossary's Collaboration entry and the Collaboration page**

Append one sentence to the Collaboration entry's paragraph in every `glossary.mdx` (before the "See ..." line):

- en: `The record can also carry the collaboration date, which the signing report prints.`
- sv: `Posten kan också bära samverkansdatumet, som signeringsrapporten skriver ut.`
- nb: `Posten kan også bære samarbeidsdatoen, som signeringsrapporten skriver ut.`
- da: `Posten kan også bære samarbejdsdatoen, som signeringsrapporten udskriver.`
- fi: `Kirjaus voi sisältää myös yhteistoiminnan päivän, jonka allekirjoitusraportti tulostaa.`

Append one sentence to the "Recording collaboration" section's first paragraph in every `collaboration.mdx` (after the sentence about the two free-text fields):

- en: `A date picker under the two fields records the collaboration date; it is optional, saves the moment you pick a day, and prints on the signing report.`
- sv: `En datumväljare under de två fälten registrerar samverkansdatumet; det är valfritt, sparas i samma stund som du väljer en dag och skrivs ut på signeringsrapporten.`
- nb: `En datovelger under de to feltene registrerer samarbeidsdatoen; den er valgfri, lagres i det øyeblikket du velger en dag og skrives ut på signeringsrapporten.`
- da: `En datovælger under de to felter registrerer samarbejdsdatoen; den er valgfri, gemmes i samme øjeblik du vælger en dag og udskrives på signeringsrapporten.`
- fi: `Kahden kentän alla oleva päivämäärävalitsin kirjaa yhteistoiminnan päivän; se on valinnainen, tallentuu heti kun valitset päivän ja tulostuu allekirjoitusraporttiin.`

- [ ] **Step 6: Guards and sync**

Run: `cd apps/dashboard && bun run test -- docs`
Expected: PASS (guards 1 to 12).
Run: `cd apps/dashboard && bun run docs:sync`
Expected: the sync reports the five new pages and the ten changed ones as re-indexed.

- [ ] **Step 7: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `docs(guide): describe the two reports, the workbook and the archive package`

---

### Task 17: ADR-0030, the kravbild, and the legacy sweep

**Files:**
- Create: `docs/adr/0030-tva-rapporter-fran-en-fryst-kartlaggning.md`
- Modify: `docs/lonekartlaggning-rapport-kravbild.md` (new section 9), `docs/lonekartlaggning-arkivpaket-kravbild.md` (the reference in its intro and the file list), plus every other file `grep -rn "facklig-rapport-kravbild" docs` reports
- Delete: `docs/lonekartlaggning-facklig-rapport-kravbild.md`
- Delete: `apps/dashboard/lib/chart-capture.ts`, `apps/dashboard/lib/chart-capture.test.ts`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report-charts.tsx`, `pay-mapping-report-data.ts` (+ test), `pay-mapping-report-export.tsx`, `signing-report-data.test.ts`, `detail-appendix-render.test.tsx`, `pay-mapping-overview.tsx` (+ test)

- [ ] **Step 1: Write ADR-0030**

Create `docs/adr/0030-tva-rapporter-fran-en-fryst-kartlaggning.md`:

```md
# Två rapporter ur en fryst lönekartläggning

**Status:** accepterad 2026-09-03 (ägarbeslut, dokumentet "Rapporter Lönekartläggning").

Rapportfliken erbjöd en maskerad dokumentations-PDF, en maskerad facklig PDF byggd ur samma montering, en nyckeltalsarbetsbok och ett arkivpaket. De två PDF:erna tjänade olika läsare med samma innehåll, och maskeringen satt i monteringen, så inget dokument kunde visa hela underlaget. Ägaren beslutade att ersätta dem med två medvetet olika dokument ur samma frysta körning.

## Beslut

1. **Signeringsrapporten ersätter den fackliga rapporten; detaljbilagan ersätter dokumentations-PDF:en.** Fyra nedladdningar återstår: signeringsrapport, detaljbilaga, nyckeltal (Excel) och arkivpaket. Inget legacy behålls: den gamla dokumentkomponenten, dess i18n-nycklar, dess revisionshändelser (`payMapping.reportExported`, `payMapping.unionReportExported`) och `lonekartlaggning-facklig-rapport-kravbild.md` är borttagna.
2. **En omaskerad montering, två projektioner.** `assemblePayMappingReport` nollar aldrig ett värde på grund av gruppstorlek; den beräknar bara exporttröskelflaggorna. `signingReportDoc` är den ENDA platsen där maskering finns: organisationens medianer och medel för ett kön med färre än fyra prissatta rader, samt regeln att ingen gruppnivåsumma finns i dess utdatatyp (ett läckage är ett kompileringsfel, och ett projektionstest strängskannar utdata). `detailAppendixDoc` är identitetsprojektionen.
3. **Detaljbilagan kan laddas ner av varje medlem.** Målgruppen är enbart HR och ser löner i appen av design; revisionsloggen (`payMapping.detailAppendixExported`, skriven före överlämningen) är kontrollen. Ingen rollspärr.
4. **Formalia:** samverkanssteget får ett valfritt samverkansdatum (`payMappingRuns.collaboration.date`, en dag, diffat i spåret som `collaborationDate`, aldrig deltagarnamnen). Signeringsrapporten skriver ut parterna, datumet och tomma underskriftsrader. Ingen signering i appen (samsigneringsbeslutet står).
5. **Praxisåtgärder:** åtgärdsmålet får varianten `{ kind: "praxis", area }`, tillåten enbart när områdets fynd är `found`; noteringar tar aldrig målet. Praxistabellen i båda dokumenten visar den kopplade åtgärden och dess planerade datum. Inga personuppgifter rider på varianten, så ingen exportmaskering gäller den.
6. **Åtgärdsnummer:** `payMappingActions.number`, tilldelat i `createAction` ur en räknare per körning (`payMappingRuns.actionCounter`, sådd med 0 vid start och höjd i samma transaktion) som aldrig återanvänder ett nummer: en hårdraderad åtgärd frigör inte sitt nummer och en tombstonad rad behåller sitt. Visas som `#n` i översikten och som id-kolumn i båda dokumenten, så ett tryckt nummer pekar aldrig på en annan åtgärd senare. Dev-data nollställs, ingen backfill.
7. **Fryst metod på tråden:** `getPayMappingRunBySlug` returnerar `frozenMethod` (kriterier, nivå- och zonregler, arbetsförhållandebeslutet, godkännandedatum) och `systemVersion`; bilagans metodkapitel och rapportens metodnot dokumenterar körningens metod, aldrig den levande modellen.
8. **Analysstatus härleds, lagras aldrig.** `analysis-status.ts` ger en av fyra statusar per grupp med lika arbete och per jämförelse av likvärdigt arbete (ingen åtgärd behövs, sakligt skäl dokumenterat, åtgärd beslutad, fortsatt analys); båda dokumenten och den kommande översiktsomgörningen läser den därifrån.

## Alternativ som avvisades

- **En PDF med maskeringsväxel:** ett dokument som ibland är signeringsunderlag och ibland fullständig dokumentation kan inte läsas utan att veta vilket läge det genererades i; två dokument med olika namn och olika omslag kan.
- **Rollspärr på bilagan:** avvisad; appen är HR-only och loggen är den kontroll som faktiskt går att revidera.
- **Maskering i monteringen med "avmaskerad" flagga:** samma läckagerisk som förr, spegelvänd; typen som saknar fältet är starkare än en flagga.

## Konsekvenser

- Tabell-, identitets- och signaturprimitiverna ligger i `components/pdf/` (ADR-0026:s kit) och delas av båda dokumenten och metodbilagan.
- Arkivpaketets `schemaVersion` är 2 och listar båda PDF:erna; kravbilden `lonekartlaggning-rapport-kravbild.md` avsnitt 9 mappar dokumentationsplikten på de två dokumenten.
- Rasteriseringen av appens diagram (`lib/chart-capture.ts`) hade ingen konsument kvar: signeringsrapportens enda diagram är den befintliga vektorkvartilen. Modulen är borttagen; ADR-0026:s tillägg om chart-sömmen beskriver därmed en möjlighet, inte en byggd väg.
```

- [ ] **Step 2: The kravbild**

Append to `docs/lonekartlaggning-rapport-kravbild.md`, before `## Källor`:

```md
## 9. Två dokument ur en fryst kartläggning (2026-09-03, ADR-0030)

Dokumentationsplikten (13-14 §§) och samverkansplikten (11-12 §§) bärs av två olika dokument ur samma frysta körning:

- **Detaljbilagan är den fullständiga skriftliga dokumentationen** (13-14 §§): varje grupp, belopp, median, status, skäl, anteckning och åtgärd, varje praxisområde, samverkansposten, den frysta metoden (kriterier, vikter, nivå- och zonregler, arbetsförhållandebeslutet, trösklarna, heltidstimmar) och täckningsnoten. Inget maskeras; dokumentet säger det. Föregående års åtgärder redovisas med aktuella statusar under praxisområdet "tidigare åtgärder" (13 § 3 p).
- **Signeringsrapporten är samverkansdokumentet** (11-12 §§, samverkansredogörelsen i 13 § 7 p / 14 §): aggregat, antal, en status per grupp och jämförelse, handlingsplanen per område, samverkansposten med datum och tomma underskriftsrader. Den skriver aldrig ut en grupps belopp.

Regler som flyttats hit från den avvecklade fackliga kravbilden (`lonekartlaggning-facklig-rapport-kravbild.md`, borttagen):

1. **Inga ansvarigas namn i signeringsrapporten.** Intern arbetsfördelning är inte samverkansinformation; bilagan bär dem.
2. **Åtgärdskostnad per område, aldrig per rad.** Signeringsrapporten summerar kostnaden per enhet (engångsbelopp, kr/mån, kr/år) per område (lika arbete, likvärdigt arbete, praxis); person- och jämförelseriktade åtgärder bidrar till antal och summor men aldrig till en egen rad.
3. **Inga noteringar i signeringsrapporten.** Interna arbetsanteckningar i fritext med reell risk för namn i löptext; bilagan bär dem.
4. **Maskeringen finns enbart i signeringsprojektionen** (ADR-0012:s trösklar: minst 4 totalt och 2 per kön för könsuppdelade värden, minst 4 för helgruppsvärden; organisationens median och medel per kön under 4 prissatta rader). Monteringen är omaskerad; nyckeltalsarbetsboken behåller sin egen maskering enligt avsnitt 6.
5. **Fritextrisken kvarstår i signeringsrapporten** för praxisåtgärdernas åtgärdstext och samverkansfälten (användarskrivna); signeringspanelens hjälptext instruerar inte längre en kontroll före delning, eftersom dokumentet inte längre bär person- eller jämförelseriktade åtgärdstexter. Detaljbilagans omslag och hjälptext säger i stället att varje nedladdning loggas.
6. **Facklig kvittens:** oförändrat utanför scope (samsigneringsbeslutet); underskriftsraderna är pappersunderskrift, ingen bekräftelse i appen.

Åtgärdsnummer: `#n` i båda dokumenten kommer ur en räknare per körning som aldrig återanvänder ett nummer (ADR-0030 p 6), så en hänvisning i ett signerat dokument förblir entydig även efter raderingar.

Byggstatus: BYGGT (signeringsrapport, detaljbilaga, praxisåtgärder, åtgärdsnummer, samverkansdatum, fryst metod på tråden, analysstatus).
```

Delete `docs/lonekartlaggning-facklig-rapport-kravbild.md`. In `docs/lonekartlaggning-arkivpaket-kravbild.md` change the intro's `` kompletterar `lonekartlaggning-rapport-kravbild.md` och `lonekartlaggning-facklig-rapport-kravbild.md` `` to `` kompletterar `lonekartlaggning-rapport-kravbild.md` (avsnitt 9 för de två dokumenten) `` and update its file list to the four entries (signeringsrapport, detaljbilaga, nyckeltal, manifest, `schemaVersion` 2). Run `grep -rn "facklig-rapport-kravbild\|facklig rapport\|fackliga rapporten" docs apps packages --include='*.md' --include='*.ts' --include='*.tsx' | grep -v node_modules` and rewrite every remaining reference to point at ADR-0030 or section 9 (in `docs/go-live-checklist.md`, `docs/README.md`, `docs/PLAN-V1.md` and the process kravbild, a one-line pointer is enough; history documents such as the samsignering beslutsunderlag keep their past-tense mention with a note that the union report was replaced by ADR-0030).

- [ ] **Step 3: The legacy sweep in code**

- Delete `apps/dashboard/lib/chart-capture.ts` and `apps/dashboard/lib/chart-capture.test.ts`; grep for `chart-capture` and `CapturedChart` and remove every remaining import.
- In `apps/dashboard/components/pay-mapping/pay-mapping-report-charts.tsx` delete `GenderBarsChart` and `SpreadBandsChart`, any helper only they used, and the `ReportSpreadNums` type import (grep the dashboard for both names first: `PairedBarsChart`, `PdfGenderLegend`, `PdfGenderKeyRow` and the ink constants stay).
- In `apps/dashboard/components/pay-mapping/pay-mapping-report-data.ts` delete: the `org` member of `PayMappingReportDoc` and its construction; `orgPrevious`; `spread`, `chartData`, `ReportSpreadRow`, `ReportSpreadNums`, `populationSpreadNums`, `spreadText`; the `summary` members other than `womenShareOfMenMeanPct` and `womenShareOfMenMedianPct` (delete `equalWorkGroups`, `equalWorkRequired`, `equalWorkDocumented`, `womenDominatedGroups`, `comparisonCount`, `comparisonsDocumented`, `variableShareWomenPct`, `variableShareMenPct`, `variableWomenShareOfMenMeanPct`, `variableWomenShareOfMenMedianPct` and their computation, the `variablePay` local and the `comparisonRows` local if unused); `equivalentWorkLevels` (the per-level context table nothing renders any more: the doc member, its `groupRow` calls and its contribution to the `maskedGroupCount` loop); the signed mode (the `signed` parameter of `metricText`, `tccMedianText` and `groupRow`, `ReportFormatters.signedPct`, and the `signed`/`pct` branches); the `equalWorkGroupRequiresDocumentation` import if it is now unused. `orgVariablePayStats`, `memberRows`, `signedGapPctOf`, `hourlyNoteLabel`, `costTotalsText` stay (the workbook and the export hook read them). Keep `orgWomenMedian`/`orgMenMedian` only as inputs to the two remaining summary shares.
- Remove `signedPct` from every formatters object that still builds one: `pay-mapping-report-export.tsx` (and its `signedPercentText` import), `pay-mapping-report-data.test.ts`, `signing-report-data.test.ts`, `detail-appendix-render.test.tsx`.
- In `pay-mapping-report-data.test.ts` delete the `orgPrevious`/`org.*`/`spread`/`chartData` assertions, the `summary.variable*`/`summary.equalWork*` assertions (keeping the two share assertions), the test `signs the per-level table's figures and keeps the other tables unsigned`, the fixture's `equivalentWork` groups and every `equivalentWorkLevels` assertion; delete the imports that become unused.
- In `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx` remove the `animate` prop (and its comment) from `WholeSurveyStat` and `QuartileStat`: it existed only for the deleted capture host, so `isAnimationActive` goes back to recharts' default (drop the prop) and any test passing `animate` drops it too.
- In `signing-report-data.ts` nothing changes (it reads `summary.womenShareOfMen*`, `population`, `method`, `praxis`, `actions`, `actionCostByScope`, `equalWork`, `womenDominated`, `collaboration`, `quartiles`, `identity`, `currency`, `runLabel`, `status`).

- [ ] **Step 4: Run everything**

Run: `cd apps/dashboard && bunx tsc --noEmit && bun run test`; `cd packages/backend && bun run test`; `cd packages/i18n && bun run test`; `bunx biome check apps/dashboard packages/backend/convex docs`
Expected: PASS, no diagnostics. Then `grep -rn "unionReportDoc\|ReportVariant\|reportExported\|unionReportExported\|frozenCriteria\|captureHost" apps packages --include='*.ts' --include='*.tsx' | grep -v node_modules` prints nothing.

- [ ] **Step 5: Present the diff for review (no commit)**

Suggested message for the post-review focused commit: `docs(adr): record the two-document export and retire the union report kravbild`

---

### Task 18: Reset the dev deployment and check the surfaces in the browser

**Files:** none (deployment and manual verification).

- [ ] **Step 1: Reset and push**

The schema gained a required field (`payMappingActions.number`) and reshaped `collaboration`; pre-launch data is reset, never backfilled.

Run: `cd packages/backend && bunx convex run seed:resetDatabase && bunx convex dev --once`
Expected: the reset completes, the push reports the schema accepted, no validation error on existing documents.

- [ ] **Step 2: Browser checks (localhost:3001, signed in as the seeded HR admin)**

Work through the list; every item is a defect if it fails.

1. Pay mappings list: start a pay mapping; the runs list row menu's Download submenu shows, in order, Signing report (PDF), Detail appendix (PDF), Key figures (Excel), Archive package (ZIP).
2. Analysis, Get started: the collaboration step shows the two text fields and the Collaboration date picker; picking a day saves immediately (network tab: one `setPayMappingCollaboration` call carrying `date`); Clear removes it; the audit log shows "Collaboration updated" with "Collaboration date: (empty) -> <day>".
3. Analysis, Practice: pick "Deficiencies or unclarities found" on Pay policy and write a description; the "Create action" button appears; create an action; the step now shows "Action #1: <planned action>" and "Edit action". Pick "No deficiencies found" on Benefits: no button.
4. Actions: the table's first column shows #1; the scope filter lists Equal work, Women-dominated, Practice; "Practice" narrows to the praxis action; its link opens the Practice chapter on Pay policy.
5. Reports tab: four panels in order (Signing report with help, Detail appendix with help, Key figures, Archive package). The Draft chip shows while the run is active.
6. Download the signing report: open the PDF; check the eight pages in order (formalities with the signature block, summary with four boxes and the quartile chart, scope, practice table with the praxis action and the collaboration row, equal work, equivalent work, action plan, method note with the checklist); no group name or amount anywhere; the audit log shows "Signing report exported".
7. Download the detail appendix: cover with the classification line and contents; equal work table with base and total figures and the status line under each row; the praxis chapter with the action "#1 ..." line; the collaboration record with the date; the action table with the No. column; the method chapter with criteria, dimension shares, level and zone rules; the audit log shows "Detail appendix exported".
8. Complete the run (fill the gate); download both again: FINAL tag on both, checklist items all "Done".
9. Archive package: the ZIP holds `<label>-signeringsrapport.pdf`, `<label>-detaljbilaga.pdf`, `<label>-nyckeltal.xlsx`, `manifest.json` with `"schemaVersion": 2` and three checksums; the audit log shows "Archive package exported".
10. Switch the display language to Swedish, Norwegian, Danish and Finnish in turn: the Reports panels, the row menu, the collaboration date label, the action number header and both PDFs render in that language with no raw key anywhere.
11. Audit log: filter by category Pay; the four export events, the collaboration date diff and the praxis action's "Linked to: Practice area" / "Group: Pay policy" rows all render labeled, never a raw code.
12. Guide: open `/docs/pay-mapping-reports` in each language; the assistant answers "who can download the detail appendix" from the new page.

- [ ] **Step 3: Report**

Report the browser checks' outcome with the file-by-file change summary of the whole plan, grouped by area (backend, dashboard, i18n, docs), and stop for review before any commit.

---

## Self-review notes

- Spec coverage: downloads and order (Task 11c), file names (Task 11c), exclusive exports and log-before-download (Task 11c), audit events (Tasks 11a, 11c), identity block (Tasks 6, 7, 11c), collaboration date (Tasks 1, 14, 16), praxis target and its consequences (Tasks 2, 12, 13), action number (Tasks 3, 13), frozenMethod on the wire (Task 4), analysis status helper and labels (Task 5), signing report structure (Tasks 8, 9, 11b, 11c), detail appendix structure (Tasks 8, 10, 11b, 11c), assembly and projections (Tasks 7, 8), masking module (Task 8), access and help text (Tasks 11a, 11c), guide/ADR/kravbild (Tasks 16, 17), tests (every task), i18n (every task plus 11b and 15), out-of-scope items untouched.
- Placeholders: none; every code step shows the code; the only "grep and fix" steps are mechanical sweeps whose targets are named.
- Type consistency: `ReportDocumentKind` ("signing" | "detail") is used by the hook, the download surface, the row menu and the archive; `SigningReportDoc` fields referenced by the labels builder exist on the projection (Task 8); `DetailAppendixLabels` keys match between the component (Task 10) and the hook (Task 11c); `ReportLinkedAction`, `ReportPraxisRow.action`, `actionCostByScope`, `identity` and `population.womenPriced/menPriced` are defined in Task 7 and read in Tasks 8, 10 and 11c; the masking constants live in `lib/pay-mapping-masking.ts` from Task 8 on and every later import names that path; `COLLABORATION_AUDIT_FIELDS`, `assertPraxisTargetAllowed`, `payMappingRuns.actionCounter` and `praxisAreaValidator` are defined where first used.
- Chain and commits: no task commits; Tasks 7 through 11c are one staged chain (Global Constraints), and the old events, mutations, labels and keys coexist with the new ones from Task 11a until Task 11c deletes them, so every task in the chain still typechecks and tests green.
