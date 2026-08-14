# People dossier

Source material for the in-app documentation "people" section (people-register, adding-people,
importing-people, supported-payroll-exports, classifying-people, person-details-and-salary,
erasing-a-person).

## Behavior today

**People register (Directory tab).** `apps/dashboard/app/(app)/people/page.tsx` renders
`PeopleSection` (`apps/dashboard/components/people/people-section.tsx`), a TanStack data table of
active (non-archived) people. Default sort is by name ascending; page size is 25
(`PAGE_SIZE = 25`). Filters: free-text search (name + department, case-insensitive substring,
`matchesPersonQuery`), department select, role select (options = every created role, not just
roles with people), gender select (Man/Kvinna), and FTE select (full-time = exactly 100%,
part-time = any value < 100, missing FTE only shows under "all"). While narrowing by role, a
person whose active assignment is still `senioritySource: "suggested"` shows a "Suggested" badge
(`SuggestedRoleBadge`) linking implicitly to Classify. Row selection persists across paging and
filtering; the header checkbox only selects the current page (never an invisible row), while the
bulk-delete action operates on the full filtered selection. Primary header actions: "Import
salaries" (link to `/people/import`) and "Add employee" (`AddPersonDialog`).

**Adding a person manually.** `AddPersonDialog` (`apps/dashboard/components/people/add-person-dialog.tsx`)
collects name (required) and gender (required, Man/Kvinna) plus optional employee number,
department, start date, FTE% (1-100), and an optional role + seniority pair. A picked role
requires a seniority valid for that role's track (`isValidSeniorityForTrack`,
`TRACK_SENIORITIES` from `@workspace/constants`); picking a role of a different track resets the
seniority field to that track's first seniority. Backend: `people.people.createPerson`
(`packages/backend/convex/people/people.ts`). A non-empty employee number (`externalRef`) must be
unique per org (checked via the `by_org_externalRef` index) because it is the import upsert key;
a duplicate throws `errors.personRefExists`. On success the app assigns the optional role
(`assignments.assignPersonToRole`, `senioritySource: "confirmed"`) as a second write (if this
fails, a toast shows but the person still exists) and navigates to the new person's page.

**Editing a person.** `EditPersonDialog` / `PersonActionsMenu`
(`apps/dashboard/components/people/edit-person-dialog.tsx`, `person-actions-menu.tsx`) let HR edit
identity (name, gender, employee number, department, start date, FTE%) and change the role +
seniority pair. Backend `updatePerson` (`people/people.ts`) patches only actually-changed fields;
clearing an optional field via the edit form (empty string / null FTE) explicitly clears the
stored value (unlike the import path, which never clears a field a file does not mention). A
no-op edit writes nothing and no audit row.

**Person detail page.** `apps/dashboard/app/(app)/people/[publicId]/page.tsx` renders
`PersonDetail` (`apps/dashboard/components/people/person-detail.tsx`). Route resolves by the
person's short random `publicId` (never the internal Convex id, never a name-derived slug: People
are the PII exception to the app's slug rule). Layout: a wide identity/classification card (left,
2 of 3 columns) plus a sticky salary rail (right). Identity card shows employee number, start
date, department, FTE, and a classification block: role link + `SeniorityBadge` (track-tinted); a
still-`suggested` seniority shows an inline hint linking to `/people/classify`. Below identity:
`PayComparisonSection` ("Pay compared with the role"), a same-role scatter chart of FTE-adjusted
total monthly pay by seniority, dots colored/shaped by gender (women solid, men hatched/outlined;
`GenderDot`/`GenderPointMark`), the viewed person marked by a brand ring plus a dashed reference
line at their own pay. Requires the person to be classified AND have a recorded salary
(`comparison.status !== "ready"` shows a precondition message otherwise); needs at least 2
comparable points (self + 1 peer) to render a chart; peers in a different currency than the
viewed person are excluded and the count is shown, never silently dropped
(`getRolePayComparison`, `packages/backend/convex/people/pay.ts`). The salary rail
(`AddSalaryDialog`, `SalaryRowActions`) lists salary history newest-first as a stacked list
(not a table): year, the role+seniority active at that record's effective time (derived via
`assignmentActiveAt`, never stored, so a later reclassification re-joins history automatically),
total monthly comp, and basic monthly beneath. Money renders locale-aware via `useMoney()`.

**Classify surface.** `apps/dashboard/app/(app)/people/classify/page.tsx` renders
`ClassifyTitleTable`. On mount it fires `runClassificationSuggestions`
(`people/classification.ts`) once (guarded by a ref against StrictMode double-invoke); the
mutation is idempotent and never overwrites a `confirmed` assignment. The engine
(`buildTitleGroups` in `classificationShared.ts`, using `@workspace/core`'s
`suggestRoleForTitles` + `suggestSeniorityForPerson`) groups active people by their exact
imported job title (a title-less bucket sorts last and is never matchable/skipped), suggests one
role per title group, and a per-person seniority suggestion within that role's track. No AI is
used (ADR-0003: classification is deterministic engine output, HR confirms). Suggested
assignments are written via `writeAssignment` with `senioritySource: "suggested"`; a person who is
already confirmed to a still-active role, or already matches the current suggestion, is skipped
(not re-suggested). A summary audit row (`classification.suggested`) is written only when
`suggested > 0`, so a no-op revisit does not spam the trail. The Classify table shows per-title
groups (confirmed/pending/unclassified state derived by `classificationStateForPeople`: confirmed
iff every person in the group has a confirmed assignment; unclassified iff none has any
assignment; pending otherwise) with a bulk confirm action. Bulk confirm packs the whole selection
into chunks of at most `MAX_ASSIGNMENTS_PER_MUTATION = 50` people per transaction
(`packAssignmentChunks` in `classify-bulk.ts`, keeping a whole title group together in one chunk
when it fits, splitting a group larger than the limit); each chunk is a single call to
`assignPeopleToRole`, all-or-nothing.

**Importing payroll data.** `apps/dashboard/app/(app)/people/import/page.tsx` is a full-screen
takeover (like onboarding), rendering `ImportWizard`
(`apps/dashboard/components/people/import/import-wizard.tsx`) with steps: Upload -> Map columns ->
Check -> Review -> Importing -> Done. Upload accepts only CSV (a non-CSV or binary file is
rejected: see Edge cases). Map columns matches each CSV column to a canonical field
(`CANONICAL_FIELDS` in `packages/import/src/fields.ts`), organized by tier (required, recommended,
optional); required fields are `externalRef` (employee ID), `title` (job title), `gender`, and
`basicMonthly` (monthly salary); every required field must be mapped to continue. A file with no
header row still imports: the first row is kept as data, columns are numbered, and fields are
suggested from column contents where possible. Check readiness shows per-tier field coverage plus
row-level data-quality issues; hard issues (`duplicateId`, `unparsableMoney`, `negativeValue`,
`unresolvedGender`, `raggedRow`) skip the row entirely, while soft issues (`fractionScaled`,
`ambiguousDate`, `nonNumericCode`, `genderNameMismatch`) are informational only and the row still
imports. An unresolved-gender row can be fixed inline via a per-row gender assignment UI
(`assign-gender.tsx`) before continuing. Review shows a dry-run diff (people
created/updated/unchanged; salary entries new/changed-same-year/identical) computed by the same
pure logic the real import applies (`diffImport`/`personImportPatch` in `people/importDiff.ts`),
so the preview can never disagree with the actual import; a same-employee-number-different-name
row is flagged as a likely reused/typoed number and is skipped by default unless the user opts to
update it anyway. The import itself runs as a Convex action (`importPayroll`,
`packages/backend/convex/people/import.ts`) that tokenizes, validates, and upserts each row via
`upsertPersonByExternalRef` (insert on miss, patch on hit, no-op/no-audit-row when nothing
changed), writing live progress to an `importProgress` row flushed every 10 rows so the Importing
screen can show a live count. The Done step reports created/updated/unchanged/skipped counts and
offers "Go to classification".

**Import pay basis and components.** Each mapped money column in the Map step gets a monthly/annual
toggle (default seeded by `defaultBasis`: an `ANNUAL_HINT`-matching header, e.g. "Arslon",
"AnnualSalary", "Grossalary", "Arsbonus", defaults to annual; otherwise `DEFAULT_BASIS_BY_FIELD`
defaults the base salary to monthly and `variable`/`bonus`/`equity` to annual), collected into a
`basisMap` passed to the import action and saved on the mapping profile for reuse on re-import.
`toMonthly` (`packages/constants/src/pay.ts`) divides an annual figure by 12; this is the only
normalization point, shared by the real import and the preview diff. Beyond `basicMonthly`, up to
six separate pay components can be mapped and stored on `payRecords`, one per `PAY_COMPONENT_KINDS`
entry (`variable`, `bonus`, `fixedSupplement`, `allowance`, `equity`, `benefitInKind`, `other`), each
independently basis-converted; a zero or unparseable component cell is skipped rather than stored as
zero. `employmentType` (`permanent`/`fixedTerm`/`substitute`/`hourly`) is a separate mappable,
soft-resolved field: an unrecognized value is left unset rather than blocking the row (source:
`docs/superpowers/specs/2026-07-11-import-fidelity-design.md`, implemented in
`packages/backend/convex/people/import.ts` and `packages/import/src/fields.ts`).

**Bulk delete (register).** Selecting rows in the People register surfaces a red "Delete N
employees" button; `BulkDeletePeopleDialog`
(`apps/dashboard/components/people/bulk-delete-people-dialog.tsx`) requires typing the literal
token `DELETE` to confirm, then erases people **one at a time** in a client-driven loop
(`erasePersonAsOrg` per person, not a single unbounded backend call), showing live
done/total progress via NumberFlow. This is a deliberate choice: erasing one person already does
unbounded-shaped work (delete salary history + assignments, pseudonymize them in every frozen
pay-mapping snapshot, rewrite every audit row naming them as subject), so batching several people
into one transaction would compound that. Partial completion is honest and resumable: anyone
already erased drops out of the register and the selection; re-confirming finishes the rest.

**Erasing a single person.** `ErasePersonControl`
(`apps/dashboard/components/people/erase-person-control.tsx`), triggered from
`PersonActionsMenu`'s destructive "Delete employee" item, is a type-to-confirm dialog: the
required token is the person's employee number if they have one, else the literal `DELETE`.
Backend `erasePersonAsOrg` (`packages/backend/convex/people/erase.ts`, `adminMutation` = org-admin
gated) delegates to `erasePersonRecords`, which hard-deletes `payRecords`, then
`personAssignments`, then the `people` row itself (child-first order), then pseudonymizes the
person inside any frozen pay-mapping snapshot (`pseudonymizePersonInSnapshots`) and tombstones the
person's identity values across their own earlier audit rows (`anonymizePersonAuditRows`). This is
a true hard delete, not a soft "archived" flag.

**Archiving.** `archivePerson` (`adminMutation`, `people/people.ts`) sets `archivedAt` and is
idempotent (already-archived is a no-op); it is a different, non-destructive lifecycle action from
erasure, but no reviewed UI entry point calls it today (`PersonActionsMenu` offers only Edit and
Delete/erase). `listPeople` defaults to excluding archived people (`includeArchived` optional
arg).

**Role-track change resets seniority.** Changing a role's track (IC/Lead/M) via `updateRole`
(`packages/backend/convex/assessment/roles.ts`) invalidates every active assignment's seniority,
because the seniority ladders are disjoint per track (`TRACK_SENIORITIES`). Rather than blocking
the change, `updateRole` re-suggests a seniority in the new track for every active (non-ended)
assignment (via `suggestSeniorityForPerson`, `@workspace/core`) and marks it
`senioritySource: "suggested"` again, even if it had been confirmed before, returning
`{ senioritiesReset: number }`. Closed/historical assignments are untouched. Reset people
automatically surface as needing attention via the existing "Suggested" badge and the dashboard's
classify-people to-do; no new UI was built for this.

## Terms and history

- **Person / Employee (people table).** A `people` row is an employee imported from payroll or
  added manually; distinct from a **Role**, which is the job (ADR-0005: Role != Person). Person
  rows never carry model/rating/AI data.
- **Employee number (`externalRef`)**: the import upsert key. Unique per org. Optional at manual
  creation, but once set it must stay unique; it is also the default type-to-confirm erasure
  token.
- **Seniority** (current term; code field `personAssignments.seniority`, constant
  `TRACK_SENIORITIES`, validator `isValidSeniorityForTrack`): the individual's seniority within
  their role's track (e.g. IC1-IC5, Lead-1..3, M1-3), set per `personAssignments` row, never on
  the role. **This is what ADR-0005's original text (dated 2026-06-07) called "Nivå"/Level.**
  ADR-0014 (2026-08-05) renamed it: the individual's seniority (old "Nivå") is now **Seniority**
  (Swedish: Senioritet); the role's computed weight (old "Band") is now **Level** (Swedish: Nivå,
  Level 1 = highest); the assessment anchor-scale's 0-5 positions are now **Step** (Swedish:
  Steg). Any source document dated before 2026-08-05 that says "Nivå" in the individual-seniority
  sense means today's Seniority; "Band" in that older vocabulary means today's Level. This dossier
  uses only the post-ADR-0014 terms throughout.
- **Assignment (`personAssignments`)**: the link between a person and a role at a given seniority,
  with an `effectiveAt`/`endedAt` interval. At most one open (`endedAt === undefined`) assignment
  per person at a time; assigning a new one closes the prior open one. History (closed rows) is
  retained and joined into salary records by effective date, never stored redundantly.
- **`senioritySource`**: `"suggested"` (engine output, unconfirmed) vs `"confirmed"` (HR-confirmed,
  or a manually created assignment). Drives the "Suggested" badge and the dashboard to-do count.
- **Classification**: the act of connecting an imported person (by their free-text imported job
  title) to a real role + seniority. Distinct from **role evaluation** (assessing a role against
  the model), which is a separate context (assessment).
- **FTE% (`ftePercent`)**: employment degree as a percentage (1-100); full-time = exactly 100.
- **Employment type (`employmentType`)**: canonical values `permanent`, `fixedTerm`, `substitute`,
  `hourly` (`EMPLOYMENT_TYPES`, `@workspace/constants`), normalized from payroll-export synonyms
  across sv/nb/da/fi/en. Used for pay-mapping grouping, not persisted anywhere else.
- **Gender (`gender`)**: strictly binary, `"Man" | "Kvinna"` (Swedish wire values; localized on
  display). No third canonical value exists (ADR-0010, decided by the product owner); unresolved
  or non-binary import values are flagged for manual per-row assignment to one of the two, never
  auto-mapped.
- **Role != Person** (ADR-0005, restated by ADR-0013): the `role`/`rating`/model/AI tables never
  carry person PII; the person's own record (`people`, `payRecords`, `personAssignments`) is the
  only home for it, plus (since ADR-0013) `person.*` audit diffs.

## Rationale

- **Role carries a track, not a level/seniority; seniority lives on the individual assignment**
  (ADR-0005). Swedish "lika arbete" (equal-work) grouping in pay-mapping analysis is done per role,
  not per role-and-seniority-variant; keeping roles level-less matches how the analysis groups
  people, avoids splitting one job into artificial per-seniority sub-roles, and is a simpler setup
  (fewer objects to create/maintain). If a senior's actual work differs enough to be a different
  job, the org creates that as its own role; the system only stops forcing a level onto every
  role.
- **`personAssignments` stores seniority as validated free text keyed to the role's track**, with
  the ladders as a code constant (`TRACK_SENIORITIES`) rather than model-seeded data, because V2's
  role-placement work only partially shipped; `standardmall.md` remains prose reference only
  (ADR-0005, "Tillägg 2026-07-10").
- **Import parsing was broadened to accept dominant Nordic real-world formats** (comma-decimal
  money, `DD.MM.YYYY`/`DD/MM/YYYY` dates, fractional FTE) instead of the original strict
  integer-only/ISO-8601-only contracts, because a 166-scenario audit against real Visma, Hogia,
  Fortnox, Agda, Personec, SD Worx, SAP SuccessFactors, and Workday exports found the strict
  contracts silently rejected most genuine Nordic payroll files as unparsable text (ADR-0010,
  `docs/superpowers/specs/2026-07-03-import-robustness-catalog.md`). Ambiguous `DD/MM` vs `MM/DD`
  defaults to Nordic day-first and raises a warning rather than guessing by locale, to stay
  deterministic (no reading the value's or system's locale) per ADR-0002's purity rule.
- **File input is CSV-only, gated by a typed binary-signature check** (ADR-0010): every major
  Nordic payroll system offers a direct CSV/semicolon export, so a client-side XLSX/ODS parser was
  judged an unnecessary ~300 kB bundle add plus an untrusted-binary attack surface for V1; binary
  files fail fast with an actionable "wrong file format, export as CSV" signal instead of a
  confusing generic "missing columns" error.
- **Gender stays exactly binary with flag-and-assign for the unresolved case**, a deliberate
  product-owner decision against adding a third canonical value even though the audit proposed
  one (ADR-0010).
- **Import never clears a field a file does not mention; a manual edit clearing a field does**
  (`people/people.ts`, `personImportPatch`): re-importing from a narrower file must not erase data
  a fuller earlier import supplied, but an HR user explicitly emptying a field on the edit form is
  an intentional decision.
- **Bulk person-erasure runs as a client-driven per-person loop, never one unbounded backend
  mutation** (`bulk-delete-people-dialog.tsx`, following the CLAUDE.md scalability rule): erasing
  one person is already unbounded-shaped work (cascading deletes, snapshot pseudonymization, audit
  rewrite), so a batch transaction would multiply that risk; the loop keeps each person's erasure
  atomic and the overall operation resumable.
- **`assignPeopleToRole` bounds a single transaction to `MAX_ASSIGNMENTS_PER_MUTATION = 50`**
  people, because each assignment costs roughly 8-12 writes and a larger batch would approach
  Convex's per-transaction document limits; callers (bulk classify) chunk larger selections into
  several such calls.
- **Person identity fields are diffed in the audit log and pseudonymized only at erasure, not kept
  out of the trail entirely** (ADR-0013): the prior invariant (never audit identity fields) meant
  the single most common person edit (fixing a name, correcting an employee number) wrote an empty
  `changes: {}` audit row that proved nothing. Now every person field (`displayName`, `gender`,
  `externalRef`, `birthDate`, `title`) is diffed like any other field, and `erasePersonAsOrg`
  scrubs those specific values (never the structural fields) from every earlier row about that
  person via `anonymizePersonAuditRows`, rebuilding the derived `searchText` too. This is described
  precisely as "pseudonymized and retained on legitimate interest", not "no person data remains":
  structural residue (employment dates, department, FTE, country, statistical code, manager flag)
  survives linked to a dangling `personId`, and in a small org that combination can still identify
  someone to an insider.
- **A role-track change resets rather than blocks affected people's seniority** (spec
  `2026-07-12-role-track-change-design.md`, implemented in `updateRole`): the seniority ladders are
  disjoint per track, so a track change necessarily invalidates every active assignment's
  seniority; re-suggesting and flagging it unconfirmed (rather than refusing the track change)
  reuses the existing "suggested seniority" machinery instead of introducing a new state, and
  nothing is silently lost (HR re-confirms via Classify).
- **Pay comparison excludes cross-currency peers but always says so** (`pay-comparison-section.tsx`
  design note, decision #5 in that spec's lineage): hiding an exclusion silently would understate
  how many colleagues exist; the count is always shown.

## Edge cases and error states

- **`errors.notFound`**: thrown by `requireOwnPerson` (people.ts, assignments.ts) when a
  `personId` does not exist or belongs to another org; also by `erasePersonAsOrg` /
  `erasePersonRecords` for the same reason; and by `assignPersonToRole`/`assignPeopleToRole` when
  the referenced role does not belong to the org. User-facing: "Not found."
- **`errors.invalidInput`**: `createPerson`/`updatePerson` when `displayName` trims to empty;
  `assignPeopleToRole` when the batch exceeds `MAX_ASSIGNMENTS_PER_MUTATION` (50).
- **`errors.personRefExists`**: `createPerson` and `updatePerson` when the chosen employee number
  is already taken by another person in the org. Surfaces inline on the employee-number field in
  `AddPersonDialog` (`isPersonRefExistsError` detects the code and calls `form.setError`).
  User-facing: "An employee with that employee number already exists."
- **`errors.invalidSeniority`**: `writeAssignment` when the given seniority is not in the target
  role's track ladder. User-facing: "That seniority is not valid for this role's track."
- **`errors.invalidEffectiveDate`**: `writeAssignment` when the new assignment's `effectiveAt` is
  at or before the currently open assignment's `effectiveAt` (V1 assumes each new assignment is
  strictly the latest; out-of-order timeline insertion is deferred). User-facing: "The effective
  date must be after the current assignment's start date."
- **Import blocking signal `invalidFileFormat`**: raised when `tokenizeCsv` detects an XLSX/ODS
  (`PK\x03\x04`) or legacy XLS/OLE2 (`\xD0\xCF\x11\xE0`) binary signature; the wizard shows "wrong
  file format, export as CSV" rather than the generic missing-columns message. Also raised as
  `import.upload.errorNotCsv` at the Upload step for a non-CSV extension, and
  `import.upload.errorEmpty` for an empty file.
- **Import blocking (required-field) state**: any required field (`externalRef`, `title`,
  `gender`, `basicMonthly`) left unmapped blocks progression past Check; `import.check.blocking`
  lists the fields, `import.check.cannotProceed` gates the Next action.
- **Hard row-skip issue codes** (row imports nothing, person and salary both skipped):
  `duplicateId` (same employee ID twice in the file), `unparsableMoney` (no usable monthly salary),
  `negativeValue` (negative/parenthesized amounts unsupported for V1), `unresolvedGender` (no
  Man/Kvinna resolved and no manual override supplied), `raggedRow` (wrong column count for the
  header).
- **Soft row-notice issue codes** (informational only, row still imports): `fractionScaled` (an
  FTE/percent column's values were all <= 1.0 and were multiplied by 100), `ambiguousDate` (a
  day/month date read Nordic day-first when both interpretations were calendar-valid),
  `nonNumericCode` (a statistical/SSYK code column has non-numeric values), `genderNameMismatch`
  (parsed gender does not match a name-based heuristic).
- **File-level warnings** (non-blocking): `noDelimiter` (no column separator detected),
  `mojibake` (header text looks garbled, likely wrong encoding), `headerless` (no header row; the
  file's columns were numbered and fields suggested from content).
- **Unresolved-gender rows require manual assignment before the import can proceed**
  (`import.check.assignGender`): shown per row by employee ID only, "no other personal data is
  sent to import."
- **Same employee number, different name (`nameMismatches`)** in the Review step's diff: flagged
  as a likely reused/typoed number; such rows are skipped by default unless the user explicitly
  chooses "Update these employees anyway".
- **Role-filter interaction with unclassified people**: a person with no active assignment
  (`roleId: null`) matches no role filter value, so filtering by any specific role always excludes
  the unclassified.
- **Classification idempotency**: revisiting Classify never overwrites a `confirmed` assignment,
  and a no-op classification pass (nothing to suggest) writes no audit row, so repeated page visits
  do not spam the trail.
- **Pay comparison preconditions**: the chart on the person page only renders once the person is
  classified AND has at least one recorded salary; with fewer than 2 comparable points it falls
  back to "the only person in this role" or, if peers were excluded for currency mismatch, states
  the excluded count instead of claiming there is no one else.
- **Bulk delete / erase confirmation gates**: both the per-person (`ErasePersonControl`) and batch
  (`BulkDeletePeopleDialog`) erasure dialogs gate the destructive action strictly on typing the
  exact required token (employee number, or the literal `DELETE`); a partial match never shows a
  field-level error, it simply leaves the action disabled.
- **Partial bulk-erase failure is resumable, not rolled back**: people already erased in a batch
  loop stay erased even if a later person's erasure throws; the dialog shows a failure state and
  the register/selection have already dropped the completed ones, so re-confirming finishes the
  rest.
- **`assistantPersonalData`** (errors namespace, assistant surface, not a people-page error but
  relevant to how the app treats person data elsewhere): the assistant refuses a message that
  appears to include an employee's personal details, asking the user to remove them and ask again
  in general terms. Listed here because it enforces the same Role != Person boundary that governs
  this section's data model, even though the trigger surface is the assistant, not People.

## Deliberately absent

- **A third (non-binary) canonical gender value.** Explicitly considered during the 2026-07-03
  import-robustness audit (its "Decision C, alternative 1") and rejected by the product owner;
  the system stays exactly binary (Man/Kvinna) for V1 (ADR-0010).
- **A binary spreadsheet (XLSX/XLS/ODS) import parser.** Explicitly out of scope for V1 (ADR-0010);
  noted as a documented future option behind the typed binary-signature guard, to revisit only if
  a real customer payroll system genuinely cannot export CSV.
- **en-US comma-thousands parsing (`52,000`), Swiss apostrophe grouping, negative/parenthesized
  money as parsable values, and month-name/two-digit-year dates.** Explicitly noted as non-goals
  left unsupported for V1 in ADR-0010's "noterade icke-mål", to keep the parser scope a known,
  tested delta rather than accreting silently.
- **Cross-track seniority mapping on a role's track change.** The reset logic re-suggests from the
  person's own signals (title, employment start date); it does not attempt to map, e.g., IC3 to a
  specific Lead seniority, because the ladders are independent and such a mapping would be
  arbitrary (`2026-07-12-role-track-change-design.md` non-goals).
- **A recompute of a role's Level (band) on a track change.** Level is derived from the assessment
  score, which a track change does not touch, so changing a role's track never re-triggers a Level
  recompute or disturbs its anchor status (same design doc).
- **Level-per-individual seniority placement was originally deferred entirely to "V2"** in the
  earliest V1/V2 planning (`docs/superpowers/analysis/2026-07-01-v2-readiness-report.md`); it has
  since shipped (this dossier documents the shipped behavior), but the report is a reminder that
  the people/classification/import stack was built later than the core assessment engine and was
  not part of the original V1 scope.
- **A UI entry point for archiving a person.** `archivePerson` exists as a backend mutation and
  `listPeople` already supports excluding/including archived people, but no reviewed surface in
  the People section currently calls it; the only lifecycle actions exposed today are Edit and
  permanent erasure.
- **A "re-erasure" or import block-list for a previously erased employee number.** Erasing a person
  does not record anywhere that their `externalRef` was erased, so a later payroll import
  containing the same number simply recreates the person (with a fresh `person.created` row); this
  is a known open question (ADR-0013's consequences section), tracked in the go-live checklist, not
  a shipped safeguard.
- **AI-assisted or AI-decided classification.** The Classify engine (`buildTitleGroups`,
  `suggestRoleForTitles`, `suggestSeniorityForPerson`) is a deterministic, non-AI engine in
  `@workspace/core`; ADR-0003's "AI never touches the deterministic score/level path and never
  auto-decides" applies here too, even though classification is not itself the score/level path.
- **Sending person-level data to any AI feature.** No person PII (name, salary, birth date, etc.)
  is ever included in an AI prompt anywhere in the app; the assistant actively refuses a message it
  detects as containing employee personal details (`errors.assistantPersonalData`).

## Sources read

Docs:
- `docs/adr/0005-level-per-individual.md` (including its 2026-07-10 and 2026-08-05/ADR-0014
  addenda)
- `docs/adr/0010-import-format-expansion-csv-only.md` (including its 2026-07-10 addendum)
- `docs/adr/0013-personidentitet-i-revisionsloggen.md`
- `docs/superpowers/specs/2026-07-03-import-robustness-catalog.md` (166-scenario audit behind
  ADR-0010; source for the exact money/date/gender/boolean/id format gaps described in Rationale
  and Edge cases)
- `docs/superpowers/specs/2026-07-03-import-robustness-design.md` (the per-module contracts
  implementing the catalog's decisions: `tokenizeCsv` binary guard and preamble/sep= handling,
  `fold`'s nb/da letter fix, `parseMoney`/`parsePercent`/`parseDate` format expansion, the Nordic
  day-first ambiguity policy, `parseGender`/`parseBool` word lists, `parseStringId`)
- `docs/superpowers/specs/2026-07-03-v2-salary-import-design.md` (the original V2 people/pay data
  model and phase plan: `people`/`personAssignments`/`payRecords`/`payGapReportRun`/
  `importMappingProfile`, the Decision 1-8 log, the wizard's four-step design, name-storage and
  erasure justification; read, mostly superseded by the shipped shape this dossier documents but
  no contradicting facts found)
- `docs/superpowers/specs/2026-07-04-v2-classification-design.md` (the classification spec: pure
  `suggestRoleForTitles`/`suggestLevelForPerson` engines in `packages/core`, the eager-suggestion
  `runClassificationSuggestions` mutation, the Classify surface's two-panel design, the
  `pseudonymizeNames` toggle and per-person detail route as companion items; terms predate
  ADR-0014, so this spec's "level" = today's Seniority)
- `docs/superpowers/specs/2026-07-04-v2-plan-coverage-audit.md` (confirms, as of 2026-07-04, that
  classification, manual salary UI, FTE-adjusted total-comp, grouping/gap engine, and report runs
  were all unbuilt against the salary-import spec; read for scope/deferral history, no facts
  contradicting the shipped behavior this dossier documents)
- `docs/superpowers/specs/2026-07-11-import-fidelity-design.md` (source for the pay-basis
  toggle/`toMonthly`/`DEFAULT_BASIS_BY_FIELD`/`ANNUAL_HINT`, the six-component `PAY_COMPONENT_KINDS`
  ingestion loop, and the `employmentType` field, folded into Behavior today)
- `docs/superpowers/specs/2026-07-11-person-pay-comparison-chart-design.md` (source for the pay
  comparison chart's decisions: same-role/latest-record/same-currency-only peer selection, gender
  color coding via `--gender-man`/`--gender-woman` tokens, tooltip identity/pseudonymization
  rules; confirms facts already in Behavior today, folded in with citation)
- `docs/superpowers/specs/2026-07-30-bulk-classify-design.md` (source for the
  `MAX_ASSIGNMENTS_PER_MUTATION = 50` chunked bulk-confirm design, the summary AlertDialog gate,
  and the shared chunk-packing helper used by both per-group and bulk confirm)
- `docs/superpowers/specs/2026-07-31-import-attachment-design.md` (UI-only vendor-component swap
  for the upload step's file card; read, nothing new beyond what the code already shows)
- `docs/superpowers/specs/2026-08-11-people-register-bulk-delete-design.md` (source for the
  page-scoped select-all decision, the `DELETE` literal-token gate, the per-person
  `erasePersonAsOrg` chunk-of-one rationale, and the `selectionState` helper move to
  `apps/dashboard/lib/selection.ts`)
- `docs/superpowers/specs/2026-07-12-role-track-change-design.md`
- `docs/superpowers/analysis/2026-07-01-v2-readiness-report.md` (skimmed for scope/deferral
  claims)

Code:
- `apps/dashboard/app/(app)/people/page.tsx`
- `apps/dashboard/app/(app)/people/[publicId]/page.tsx`
- `apps/dashboard/app/(app)/people/classify/page.tsx`
- `apps/dashboard/app/(app)/people/import/page.tsx`
- `apps/dashboard/components/people/people-section.tsx`
- `apps/dashboard/components/people/person-detail.tsx`
- `apps/dashboard/components/people/add-person-dialog.tsx`
- `apps/dashboard/components/people/edit-person-dialog.tsx`
- `apps/dashboard/components/people/person-actions-menu.tsx`
- `apps/dashboard/components/people/erase-person-control.tsx`
- `apps/dashboard/components/people/bulk-delete-people-dialog.tsx`
- `apps/dashboard/components/people/pay-comparison-section.tsx`
- `apps/dashboard/components/people/classify/classify-title-table.tsx` (partial)
- `apps/dashboard/components/people/classify/classify-bulk.ts`
- `packages/backend/convex/people/people.ts`
- `packages/backend/convex/people/assignments.ts`
- `packages/backend/convex/people/classification.ts`
- `packages/backend/convex/people/classificationShared.ts`
- `packages/backend/convex/people/erase.ts`
- `packages/backend/convex/people/importDiff.ts`
- `packages/backend/convex/people/import.ts` (prepareImport, importPayroll, HARD_SKIP_CODES)
- `packages/backend/convex/people/pay.ts` (grep for currency/excludedCount)
- `packages/backend/convex/assessment/roles.ts` (updateRole track-change reset, partial)
- `packages/import/src/fields.ts`
- `packages/constants/src/trackSeniorities.ts`
- `packages/constants/src/employment.ts`
- `packages/constants/src/assignments.ts` (MAX_ASSIGNMENTS_PER_MUTATION)
- `packages/i18n/messages/en.json` (`errors.*` and `dashboard.people.*` namespaces, via script)

Also consulted: `docs/superpowers/analysis/2026-08-13-product-dossier/SOURCES.md` (row assignment)
and `.superpowers/sdd/00-overview/section-pages.md` (target pages) to scope this dossier.
