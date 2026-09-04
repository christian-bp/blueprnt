# Two reports from one frozen pay mapping: design

Date: 2026-09-03. Owner document: "Rapporter Lönekartläggning" (2026-09-03). Status: approved design, awaiting the implementation plan.

## Summary

The pay-mapping Report tab today offers a masked documentation PDF, a masked union PDF built from the same assembly, a key-figures workbook and an archive package. The owner's document replaces the two PDFs with two deliberately different documents generated from the same frozen run:

- **Signing report** (signeringsrapport): 6 to 8 pages, shared with the employer and the union parties for samverkan and signing. Aggregates, counts, statuses, conclusions and the action plan. Small groups and person-near data are masked or aggregated away. It never prints an amount for a group.
- **Detail appendix** (detaljbilaga): a separate document, as long as it needs to be, with every comparison, group, amount, reason, action and the full method, nothing masked. Any organization member can download it; every download is logged.

Both documents carry the same run identity (label, reference date, data extraction time, method version, status) and are built from one unmasked assembly. Masking exists only inside the signing projection.

## Owner decisions recorded during brainstorming

1. The signing report replaces the union report; the detail appendix replaces the documentation PDF. Four downloads remain: signing report, detail appendix, key figures (Excel), archive package. No legacy kept.
2. The detail appendix is downloadable by every organization member (the audience is HR only and sees pay in the app by design). The audit log is the control; there is no role gate.
3. Formalities: the collaboration step gains an optional samverkan date. The signing report prints the parties from the participants field, the date, and blank signature lines for the employer and the union party. No in-app signing (the recorded decision in `docs/lonekartlaggning-samsignering-beslutsunderlag.md` stands: the Complete audit event is the decision record).
4. Actions can target a practice area (a new `praxis` target kind), so the practice table in both reports can show the linked action and its planned date.
5. Code approach C: one unmasked assembly, two projections, two document components sharing table primitives lifted into the PDF kit.

## Documents and export surface

### Downloads

The Report tab (`components/pay-mapping/pay-mapping-report.tsx` + `pay-mapping-report-download.tsx`) and the runs list row menu (`pay-mapping-run-actions.tsx`) offer, in this order:

1. Signing report (primary button). File name `<label>-signeringsrapport.pdf` (file name segment localized per locale as today's `-facklig-rapport` is).
2. Detail appendix (outline button). File name `<label>-detaljbilaga.pdf`.
3. Key figures (Excel), unchanged.
4. Archive package: signing report + detail appendix + workbook + `manifest.json` with SHA-256 per file. The manifest's `schemaVersion` becomes 2 and lists both PDFs.

Each download is exclusive (one export at a time, as today) and writes its audit row before the file is handed over; a failed log aborts the download (today's rule).

### Audit events

- `payMapping.signingReportExported` and `payMapping.detailAppendixExported` replace `payMapping.reportExported` and `payMapping.unionReportExported`. Payload `{ runId }`, subject `payMappingRun`, category pay. Labels in every locale under `dashboard.auditLog.events`.
- `payMapping.archiveExported` and `payMapping.metricsExported` are unchanged.

### Identity block

Both documents print the same block on the cover: organization name, run label, reference date, data extraction time (the freeze instant, `referenceDate`), method version (the run's `systemVersion` plus the frozen model's approval date), status tag Draft / Final (from `run.status === "completed"`), generation timestamp. The detail appendix cover additionally prints the classification line: internal document, contains person-near pay data, every download is logged, intended for the organization's HR function and the samverkan parties on request.

## Data model changes

All four are small and ship with their audit wiring (event payload, field labels, coded values) and their tests.

### (a) Collaboration date

`payMappingRuns.collaboration` gains `date?: number` (epoch ms, day precision, like `plannedDate` on actions). The collaboration step (`review-start-step.tsx`) renders a `DatePicker` next to the two text fields, saved through `setPayMappingCollaboration` (which gains the optional `date` arg). Locked when the run is completed. The start step's done rule is unchanged (both text fields non-empty; the date is optional). The audit diff for the collaboration event records `date` as a changed field (label in every locale).

### (b) Praxis action target

The action target union gains `{ kind: "praxis", area: PraxisAreaKey }` (`PRAXIS_AREA_KEYS` from `@workspace/constants`). Consequences:

- The praxis step (`review-praxis-step.tsx`) shows "Add action" when the area's finding is `found` (and the run is not completed), opening the existing action dialog with the target preset.
- The actions overview scope filter gains a "Practice" option; `targetGroupLabel` renders the area's localized label.
- Praxis-targeted actions carry no person data, so no export masking applies to them.
- The report joins praxis actions to their area by `target.area`.

### (c) Action number

`payMappingActions.number: number`, required, assigned inside `createAction` as (highest existing number for the run) + 1, read through the run's actions index within the same transaction. Erased (tombstoned) actions keep their number, so numbers never shift. Displayed as `#<n>` in the actions overview and as the action id column in both reports. Pre-launch data is reset rather than backfilled (the dev deployment is reset; prod holds demo data only).

### (d) Frozen method on the wire

`getPayMappingRunBySlug` returns a `frozenMethod` object instead of only `frozenCriteria`:

```ts
frozenMethod: {
  criteria: { libraryKey, name, dimensionKey, weightPoints, anchorCount, order }[]
  levelRules: { level, minScore }[]
  zoneProfileRules: { zone, minStep }[]
  workingConditions: { status, motivation } | null
  approvedAt: number | null
}
```

No person data. The detail appendix's method chapter is rendered from this object, so it documents the run's model, not the live one. The signing report's short method note uses the same object.

## Analysis status derivation

A pure helper (in `components/pay-mapping/analysis-status.ts`, unit-tested) derives one status per equal-work group and per equivalent-work comparison from the frozen gap, the analyses and the actions:

| Status key | Rule |
|---|---|
| `noActionNeeded` | documentation is not required (flag `ok`, or a women-dominated group with no comparisons) and no action targets the group |
| `objectiveReason` | done, with at least one reason or a note, and no action targets it |
| `actionDecided` | at least one non-erased action targets the group or comparison (regardless of done) |
| `furtherAnalysis` | documentation is required and the analysis is not done |

Labels live under `dashboard.payMapping.analysisStatus.*` in every locale. The status is never stored. Both reports and, later, the overview redesign read it from this helper.

## Signing report structure (6 to 8 pages)

Every section is its own page (the kit's `BrandedPage`), except where noted. Copy is templated i18n; no AI text.

1. **Formalities and signing.** Identity block, samverkan date, participants text, collaboration description, and a signature block with two columns (employer, union party), each with lines for name, signature, place and date. A sentence states that detailed comparisons and the basis exist in the detail appendix.
2. **Summary and result picture.** Four status boxes: overall pay position (women's median and mean as a share of men's, from the org aggregate, masked when a gender has fewer than four priced rows); representation (women's share per pay quartile); equal work (groups compared, assessments completed, objective reasons documented, actions decided); equivalent work (women-dominated groups in scope, relevant comparisons, completed, reasons, actions). Two or three templated sentences close the page: the state (counts) and the next step (open analyses or actions in progress).
3. **Scope, method and confidentiality.** Reference date, population (total, women, men, priced), pay elements included (base + components as total compensation, FTE-adjusted, hourly rows normalized), exclusions with reason (people without pay, singleton and gender-pure groups by count), the confidentiality note (small groups are masked here but analysed, and shown in full in the appendix), and the insufficient-basis flag (the masked group count).
4. **Provisions, practice and collaboration.** One table: area, conclusion (Clear / Needs review, from the praxis finding; Pending when not done), action or follow-up (the linked praxis action's planned action text and planned date; a dash when none). A collaboration row: performed / in progress from the collaboration fields, with the date.
5. **Equal work.** The five-row measures table (comparable groups, assessments completed x of y, objective reasons documented, actions decided, groups with insufficient basis for broad reporting) and the conclusion box (every relevant difference has one of the four statuses; results are symmetric regardless of which gender is paid more). No group names, no amounts.
6. **Equivalent work.** The chain line (role evaluation, women-dominated group, relevant higher-paid comparison group, assessment, action or close) and the five-row measures table. No group names, no amounts.
7. **Action plan and follow-up.** One row per area (equal work, equivalent work, practice) with an aggregated observation (counts), the number of actions and their status split, the summed estimated cost per unit for the area, the earliest and latest planned dates, and status. Owner names are not printed (the union report's rule today). Person-targeted actions contribute to counts and cost totals only.
8. **Short method note (half a page) and the pre-signing checklist.** Equal work is role and level; equivalent work is the documented gender-neutral evaluation of demands (frozen criteria named with their weights); pay elements included. The checklist prints the computed items: all comparisons requiring documentation are assessed; reasons or actions are linked; collaboration is documented; both documents derive from the same frozen version. Each item shows done or open.

The only chart is the existing vector quartile chart.

## Detail appendix structure

1. **Cover.** Identity block, classification line, table of contents.
2. **Equal work, in full.** One row per shown group: role title, level, women and men counts, FTE-adjusted base (women mean, men mean, gap), total compensation (women mean, men mean, gap kr and %, women median, men median, median gap %), flag, base-driven marker, status, reasons, note, linked actions (`#n`, owner name, planned date). Reverse groups and gender-pure groups follow in their own tables with the same columns where they apply. Previous-run gap per group when a previous completed run exists.
3. **Equivalent work, in full.** One block per women-dominated group (headcount, women share, mean total compensation, spread) and one row per comparison group (title, level, headcount, women share, mean, diff kr and %, status, reasons, note, linked actions).
4. **Practice, collaboration remarks and actions.** Every praxis area with finding and note; the collaboration text and date; every action with all fields (`#n`, target, problem, planned action, reason, owner, planned date, estimated cost with unit, priority, status); every note.
5. **Method and calculation basis.** Frozen criteria with weight points and derived shares, dimension shares, level rules, zone rules, working-conditions decision, the 1 to 5 scale with the midpoint rule, pay elements, the thresholds (10 % and 5 %, women-dominated at 60 %), full-time hours default and the hourly note, the coverage counts, and one sentence stating that nothing is masked in this document.

No cell is ever masked. Every table is fixed-width with the continuation-header logic the report already uses.

## Assembly and projections (approach C)

- `assemblePayMappingReport` (in `pay-mapping-report-data.ts`) becomes unmasked: it never nulls a value for size. It keeps computing the export-threshold booleans (`masked`, `maskedGroupCount`) so projections can decide.
- `detailAppendixDoc(full)` is the identity projection plus the frozen method and the classification block.
- `signingReportDoc(full)` is a pure function that reduces the full assembly to counts, shares, statuses and org-level aggregates. It contains the ONLY masking logic: org medians and means for a gender with fewer than four priced rows, and the rule that no group-level amount exists in its output type (the type has no field for one, so a leak is a compile error).
- Two document components: `signing-report-doc.tsx` and `detail-appendix-doc.tsx`. Table primitives, the identity block, the status tag and the signature block move into `components/pdf/` so both documents and the method appendix share them (ADR-0026).
- `EXPORT_MIN_GROUP_SIZE` and `EXPORT_MIN_PER_GENDER` keep their values and move next to the signing projection.

## Access and logging

Both documents are available to every organization member. Each export writes its own audit event first. The detail appendix's help text (a `HelpMorphButton` after the panel title) says that the document is unmasked and that every download is recorded in the audit log. No new role checks.

## Guide, ADR and requirement notes

- No guide page documents the downloads today (nothing under `content/docs` mentions the union report or the archive package). A new page with the locale-invariant slug `pay-mapping-reports` ships in five locales, in the pay-mapping nav group after `starting-a-pay-mapping`: the two documents, who each is for, what is masked where, the key-figures workbook, the archive package and its checksums, and that every download is written to the audit log. The glossary's Collaboration entry mentions the samverkan date. `bun run docs:sync` in the same change.
- ADR-0030: two documents from one frozen mapping; masking only in the signing projection; download for every member with logging as the control; the collaboration date and praxis action target; the action number.
- `docs/lonekartlaggning-rapport-kravbild.md` gains a section mapping the statutory documentation duty onto the two documents (the appendix is the complete written documentation; the signing report is the samverkan document). `docs/lonekartlaggning-facklig-rapport-kravbild.md` is deleted; its still-valid rules (no owner names, action cost per area, no notes) move into the new section.

## Tests

- Render tests for both documents (blob size floor, page refs captured for every section, page count grows with content), following `pay-mapping-report-render.test.tsx`.
- Projection tests: given a fixture with groups below and above the thresholds, the signing projection's serialized output contains no amount from any group (assert on the typed shape and on a string scan of the rendered text), and the detail projection contains every group with its figures.
- `analysis-status.test.ts`: every combination of required, done, reasons, note and action.
- Backend: `createAction` numbering (1, 2 within a run; a second run starts at 1; erased actions keep their number), the praxis target validator (unknown area refused, allowed only when the finding is `found`), `setPayMappingCollaboration` with date (refused on a completed run), `getPayMappingRunBySlug` returns `frozenMethod` without person data.
- Audit label coverage and i18n parity catch the new events, fields and labels. Docs guards catch the guide.

## i18n

New namespaces: `dashboard.payMapping.signingReport.*`, `dashboard.payMapping.detailAppendix.*`, `dashboard.payMapping.analysisStatus.*`, `dashboard.payMapping.actions.scopePraxis`, the collaboration date label, the action number label, help bodies for the two panels, the archive manifest notice. All five locales, production quality, in the same change. Union-report keys are deleted.

## Out of scope

- In-app signing, structured samverkan with per-participant records (ADR-0027's later build).
- A role gate on the appendix (decided against).
- Cost-to-close and median in the app (G14, G11) beyond what the reports already compute.
- The overview redesign (sub-project C), which will consume the analysis-status helper.
