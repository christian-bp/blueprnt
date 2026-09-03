# Hourly pay: one analysis basis, full-time hours with an org default, basis on the pay record

**Date:** 2026-09-02
**Source:** the Sysarb help-center review (G01 in the gap report, 2026-09-02; Sysarb's "Salary normalization" article) and brainstorming with the product owner the same day.
**Status:** approved design, pending implementation plan.

## Problem

Every base-pay amount in the system is a monthly figure. `payRecords.basicMonthly`
(`packages/backend/convex/people/tables.ts`) is the only base-pay field, the
import converts annual columns to monthly per column (`basisMap` in
`people/import.ts`, seeded by `defaultBasis` in `packages/import/src/fields.ts`),
and the gap engine compares FTE-adjusted monthly total compensation
(`fteTotalMonthlyComp` in `packages/constants/src/pay.ts`, ADR-0028). At the
same time `EMPLOYMENT_TYPES` (`packages/constants/src/employment.ts`) carries
`hourly` with the synonyms tim, timelonn and tuntityo. The system models
hourly EMPLOYMENT without being able to hold hourly PAY.

The failure is silent and lives in the most common Swedish payroll export: one
"Lön" column carrying the monthly salary for monthly-paid people and the hourly
rate for hourly-paid people, with the pay form in its own column. The import
recognizes the pay form (`employmentType: hourly`), stores the amount as a
monthly salary, and an hourly rate of 195 goes straight into
`payMapping/gap.ts` as a monthly pay of 195. No warning, no method note, no way
for HR to state the assumption. A dedicated "Timlön" column cannot be mapped at
all (no canonical field). Sysarb's own worked example shows why this matters:
the same two groups measure +2.5 % on a monthly basis and -7.25 % on an hourly
basis, because the conversion factor differs between the groups. The gap can
change sign.

Diskrimineringslagen 3 kap. 8-9 §§ covers every employee including hourly-paid
ones, the directive's art. 3.1 defines pay level as gross annual pay and the
corresponding gross hourly pay, and hourly employment is everyday in retail,
care, municipal work and industry: exactly the sectors with the largest
women-dominated groups. `docs/lonekartlaggning-rapport-kravbild.md:72` already
lists "bruttoårslön/timlön-normalisering" as a known gap.

Sysarb's model, for reference: a salary type per employment (hourly, monthly,
yearly), two per-employee fields ("full-time working hours per month" and
"yearly payouts") with org defaults in System settings, and a per-audit choice
of which salary type the analysis runs in, converting the whole population.

## Decisions (settled with the product owner, 2026-09-02)

1. **One analysis basis: FTE-adjusted monthly pay.** An hourly rate times the
   person's full-time hours per month is a full-time-equivalent monthly
   amount, so the existing measure (ADR-0028: FTE-adjusted total compensation,
   base salary in parallel) covers both populations. No per-run basis
   selector. Rejected: Sysarb's run-level selector (more to build, one more
   question in the flow) and analysing hourly-paid people as a separate
   population (breaks DL 3 kap. 8-9 §§ and the equivalent-work comparison).
2. **Full-time hours per month: an org default with an optional per-person
   value.** `organizations.fullTimeHoursPerMonth` is pre-filled from the
   country (the same derivation as currency and language) and editable in
   settings; `people.fullTimeHoursPerMonth` overrides it for agreements with
   a different working week. Resolution is person, then organization, then
   the country default, so a conversion never lacks a factor. Rejected:
   org-only (organizations with several agreements get a wrong factor for
   part of the population with no way to correct it) and person-only (asks
   per person, against derive-instead-of-ask).
3. **The single "Lön" column is interpreted by pay form, visibly.** A row
   whose employment type is `hourly` reads the base-pay column as an hourly
   rate. The review step lists those rows ("N amounts are read as hourly
   pay"), a checkbox defaulting ON lets HR switch the interpretation off for
   that import, and soft plausibility notices flag hourly-basis amounts that
   look monthly and monthly-basis amounts that look hourly. Rejected: warn
   only and keep the amount monthly (the most common format stays wrong
   until the file is rebuilt) and requiring a dedicated hourly column
   (Visma/Hogia/Fortnox exports rarely have one).
4. **The basis lives on the pay record; the monthly figure is derived at
   read.** `payRecords.basicMonthly` is replaced by `basicAmount` + `basis`
   (`monthly` | `hourly`). One helper in `@workspace/constants` normalizes
   (amount, basis, hours) to a full-time-equivalent monthly amount; nothing
   stores the derived value except the frozen snapshot (ADR-0011), which
   freezes raw amount, basis, the hours used AND the normalized amount so a
   run stays evidence when the default changes. The rename is deliberate:
   every reader that today assumes the amount is monthly stops compiling
   until it declares the basis. Rejected: keeping a stored `basicMonthly`
   beside the raw amount (a corrected default never reaches imported
   records, HR would re-import) and an hourly rate on the person (no
   history, no pay year, and `people` never carries pay fields).
5. **Hourly rows are not FTE-adjusted.** Rate times full-time hours is
   already what the person would earn full time; dividing by an FTE share
   again would double-count. Components on an hourly row stay the monthly
   amounts they are today and are not FTE-adjusted either (one rule per
   row, stated in the method note).
6. **Manual entry gets a basis choice.** The salary dialog starts with
   Monthly / Hourly, the amount label follows the basis, and a derived line
   shows the full-time-equivalent monthly amount while typing. The add-person
   dialog does NOT get a full-time-hours field (derive); the edit-person
   dialog does (optional, org default as placeholder).
7. **ADR-0029 records the decisions** (one basis, derive at read, freeze raw
   + normalized + hours, `yearlyPayouts` deferred).
8. **No legacy.** `basicMonthly` leaves `payRecords` in the same change, the
   dev deployment is reset, no compat shim.

## Constants (`packages/constants`)

### `src/pay.ts`

- `BASE_PAY_BASES = ["monthly", "hourly"] as const`, `BasePayBasis`.
- `normalizedMonthlyBase(amount: number, basis: BasePayBasis, hoursPerMonth: number): number`
  returns `amount * hoursPerMonth` for `hourly` and `amount` for `monthly`.
  Throws on `hoursPerMonth <= 0` (the resolver guarantees a positive value;
  the throw guards a caller that bypassed it).
- `fteTotalMonthlyComp(basicMonthly, components, ftePercent, basis: BasePayBasis)`
  gains a REQUIRED fourth parameter. For `hourly` it returns the plain sum
  (no FTE division); for `monthly` it behaves as today. Required, not
  optional, so every caller declares the basis at the call site.
- `PAY_PLAUSIBILITY_BY_CURRENCY: Record<CurrencyKey, { hourlyMax: number; monthlyMin: number }>`:
  SEK, NOK, DKK `{ hourlyMax: 1500, monthlyMin: 3000 }`; EUR
  `{ hourlyMax: 150, monthlyMin: 300 }`. `plausibilityFor(currency)` returns
  the entry or `undefined` for an unknown currency (then no notice).
- `DEFAULT_BASIS_BY_FIELD`, `toMonthly`, `PAY_BASIS` (monthly/annual for
  import columns) are unchanged: annual columns keep converting to monthly at
  import time. "Annual" is a column basis, not a record basis.

### `src/countries.ts`

- `FULL_TIME_HOURS_BY_COUNTRY = { se: 165, no: 162.5, dk: 160.33, fi: 162.5, other: 173.33 } as const satisfies Record<CountryKey, number>`
  and `defaultFullTimeHoursFor(country: string | undefined): number` via
  `clampCountry`. The figures are the customary agreement divisors for the
  standard full-time week (SE 40 h with the common 165 divisor, NO 37.5 h,
  DK 37 h, FI 37.5 h, other 40 h x 52 / 12); they are seeds the organization
  edits, and the report states the value used.

### `src/people.ts`

- `FULL_TIME_HOURS_MAX = 400` (the validation ceiling for a per-month figure,
  shared by the Zod schemas and the Convex validators).

## Backend (`packages/backend/convex`)

### Schema

- `payRecords` (`people/tables.ts`): `basicMonthly` removed; add
  `basis: v.union(v.literal("monthly"), v.literal("hourly"))` and
  `basicAmount: v.number()` (the figure in that basis, >= 0). `components`
  unchanged (monthly amounts). `currency`, `payYear`, `source`,
  `effectiveAt` unchanged.
- `people` (`people/tables.ts`): add `fullTimeHoursPerMonth: v.optional(v.number())`
  (> 0, <= `FULL_TIME_HOURS_MAX`, decimals allowed).
- `organizations` (`accounts/tables.ts`): add
  `fullTimeHoursPerMonth: v.optional(v.number())` with the same bounds.
  Unset means "use the country default".
- `payMappingSnapshotRows` (`payMapping/tables.ts`): keep `basicMonthly`
  (`number | null`) as the NORMALIZED full-time-equivalent monthly base the
  engine reads; add `basis: v.optional(union)`, `basicAmount: v.optional(v.number())`
  and `hoursPerMonth: v.optional(v.number())`, all three present exactly when
  the row has pay. `payMappingRuns` gains `fullTimeHoursDefault: v.number()`
  (the organization's resolved default at freeze time, for the method note).

### Resolution and read paths

- New module `people/fullTimeHours.ts`:
  `resolveFullTimeHours(person: { fullTimeHoursPerMonth?: number }, org: { fullTimeHoursPerMonth?: number; country?: string }): { hoursPerMonth: number; source: "person" | "organization" | "country" }`.
  Person, then organization, then `defaultFullTimeHoursFor(org.country)`.
  `getOrgPayDefaults(ctx)` (replacing `getOrgCurrency` in `importHelpers.ts`)
  returns `{ currency, fullTimeHoursPerMonth, country }` in one read so
  org-scaled loops fetch the organization once.
- `people/pay.ts`: `setSalary` and `appendSalary` take `basis` + `basicAmount`
  instead of `basicMonthly` (validators: basis union, amount >= 0).
  `getSalaryHistory` and `getCurrentSalary` return, per record, `basis`,
  `basicAmount`, `basicMonthly` (normalized with the person's resolved hours),
  `hoursPerMonth`, `hoursSource`, and `totalMonthlyComp` computed from the
  normalized base. `getRolePayComparison` resolves hours per person (org
  fetched once) and passes each record's basis to `fteTotalMonthlyComp`.
  New query `getPayDefaults({ personId })` -> `{ currency, hoursPerMonth, hoursSource }`
  for the salary dialog's derived line.
- `payMapping/runs.ts` (freeze): per row with pay, `basicAmount`, `basis`,
  `hoursPerMonth` (resolved) and `basicMonthly = normalizedMonthlyBase(...)`;
  the run row gets `fullTimeHoursDefault`. `payMapping/gap.ts` and
  `payMapping/orgGap.ts` pass `row.basis ?? "monthly"` to `fteTotalMonthlyComp`
  (a row without pay has no basis and contributes 0). `assistant/insights.ts`
  builds its `PricedRow` from the normalized value with the basis.
- `people/people.ts`: `updatePerson` accepts `fullTimeHoursPerMonth`
  (optional; `null` clears). `people/erase.ts` unchanged in behaviour (the
  pay rows are deleted as before).

### Audit (`lib/audit.ts`, `lib/auditPayloads.ts`)

- `PAY_AUDIT_FIELDS` gains `"basis"` (coded value; the trail stays
  amount-free: `basicAmount` is never diffed).
- `SETTINGS_AUDIT_FIELDS` gains `"fullTimeHoursPerMonth"`.
- `PERSON_AUDIT_FIELDS` gains `"fullTimeHoursPerMonth"`, classified
  `structural` in `PERSON_AUDIT_FIELD_KIND`.
- `people.imported` payload gains `hourlyPay: number` (rows written with the
  hourly basis) beside the existing counts.
- Labels in every locale: `dashboard.auditLog.fields.{basis,fullTimeHoursPerMonth,hourlyPay}`;
  the `basis` value renders through `resolveCodedValue` reusing
  `dashboard.people.salaryForm.basis.{monthly,hourly}`.

## Import

### Canonical fields (`packages/import/src/fields.ts`)

- `hourlyRate`: tier `optional`, shape `money`, `fixedBasis: "hourly"`.
  Synonyms (folded): timlon, timlonn, timeloenn, timeloen, hourlyrate,
  hourlywage, hourlypay, tuntipalkka. Every synonym is >= 5 folded characters,
  so `SUBSTRING_MIN_LENGTH` applies as usual.
- `fullTimeHoursPerMonth`: tier `optional`, new shape `number` (a plain
  decimal with comma or dot, no fraction scaling; the `percent` parser's
  0..1 heuristic would corrupt an hours figure). Synonyms: heltidstimmar,
  heltidstimmarpermanad, fulltimehours, fulltimehourspermonth, hourspermonth,
  heltidstimer, fuldtidstimer, kokoaikatunnit. NOT arbetstid, arbeidstid,
  arbejdstid or tyoaika (as often weekly hours or an FTE share).
- `FieldDef` gains `fixedBasis?: "hourly"`. The Map step renders the
  monthly/annual select only for money fields WITHOUT `fixedBasis`.
  `basisMap` never contains `hourlyRate`.
- `ValueShape` gains `"number"`, with its parser in the same module as the
  money and percent parsers. No value-shape detection for it: an hours
  column is matched by header synonyms only, because a column of figures
  between 0 and 400 is just as likely an FTE share.

### Row basis (`people/import.ts`, the prepare step)

`previewImport` and `importPayroll` take `interpretHourly: boolean`. For each
row, in this order:

1. `hourlyRate` cell present and parsable -> `basis: "hourly"`,
   `basicAmount` from that cell. If the base-pay cell is also present and
   the employment type is not `hourly`, the row is monthly instead and gets
   the notice `bothBasesPresent`.
2. Employment type `hourly`, no `hourlyRate` value, base-pay cell present,
   `interpretHourly` true -> `basis: "hourly"`, `basicAmount` from the
   base-pay cell, and the row is counted as INTERPRETED (listed in the review
   step). The column's monthly/annual `basisMap` entry is ignored for this
   row (an hourly rate has no annual form).
3. Otherwise `basis: "monthly"`, `basicAmount = toMonthly(cell, basisOf("basicMonthly"))`
   as today.
4. Neither cell present: unchanged behaviour (no salary row).

Plausibility notices, computed in the same pass with
`plausibilityFor(currency)` (soft, never a skip code):

- `hourlyLooksMonthly`: basis hourly and `basicAmount > hourlyMax`.
- `monthlyLooksHourly`: basis monthly, `basicAmount < monthlyMin`, and the
  employment type is `hourly` or unset (a monthly-typed row with a low
  amount is a part-time salary, not a notice).
- `bothBasesPresent` as in rule 1.

Each notice carries the row's `ImportPersonRef` (the same shape the leaver
lists use). The preview result gains
`hourlyPay: { interpreted: ImportPersonRef[]; total: number; notices: Array<{ code: HourlyNoticeCode; ref: ImportPersonRef }> }`
(`total` counts every row that ends up with the hourly basis, from the
column or by interpretation; `interpreted` lists only rule 2) and
`ownHoursCount: number` (rows carrying a `fullTimeHoursPerMonth` value).
`normalized[].salary` becomes `{ payYear, basis, basicAmount, currency, components }`
and `normalized[].person` gains `fullTimeHoursPerMonth`.

### Diff and write (`people/importDiff.ts`, `people/importHelpers.ts`)

- `sameSalary` compares `basis`, `basicAmount` and `components`. A
  `salaryChanged` entry carries `from: { basis, amount }` and
  `to: { basis, amount }`; a basis change with the same figure is a change.
- `importChunk` writes `basis` + `basicAmount` via `appendSalaryCore` and
  patches `fullTimeHoursPerMonth` through the upsert core like any other
  person field. `logImportCompleted` adds `hourlyPay` to the payload.
- The import result gains `hourlyPay` (rows written with the hourly basis).
- `importMappingProfiles` needs no change: the two new columns are remembered
  by canonical key like every other mapping.

## Import wizard (`apps/dashboard/components/people/import/`)

- **Map step:** no basis select on a column mapped to `hourlyRate`
  (`fixedBasis`). Nothing else changes.
- **Check step:** unchanged (file-level validation stays where it is).
- **Review step:** a new group in the single-column summary, "Hourly pay",
  rendered when `hourlyPay.total > 0` or `ownHoursCount > 0`:
  - "N amounts are read as hourly pay" with a `PersonRefList` of the
    interpreted rows, followed by the checkbox "Read amounts for hourly-paid
    people as hourly pay", checked by default. Unchecking re-runs the preview
    with `interpretHourly: false`; those rows then import as monthly and
    surface `monthlyLooksHourly` where the amount is under the floor.
  - One row per notice code with its count and list, in a plain (not
    destructive) `Alert`: they never block.
  - "N people get their own full-time hours" when `ownHoursCount > 0`.
  - `salaryChanged` rows format basis-aware ("195 kr/h -> 205 kr/h",
    "32 000 kr/mo -> 33 000 kr/mo").
- **Done step:** a "Read as hourly pay" count row when `hourlyPay > 0`.

## Organization settings (`apps/dashboard/components/organization/organization-profile-form.tsx`)

- A titled group "Pay" holding the existing currency field and the new
  "Full-time hours per month" field (number input, decimals allowed, empty
  means the country default, which the placeholder shows). A
  `HelpMorphButton` after the group title (`dashboard.help.fullTimeHours*`).
- Zod: `fullTimeHoursPerMonth: z.number().positive().max(FULL_TIME_HOURS_MAX).optional()`.
  The form keeps its `isDirty` gate. `updateOrganizationSettings` accepts the
  field (`null` clears) and diffs it through `SETTINGS_AUDIT_FIELDS`.

## Person surfaces (`apps/dashboard/components/people/`)

- **Salary dialog (`add-salary-dialog.tsx`, also used for edit):**
  `makeSalarySchema` gets `basis: z.enum(BASE_PAY_BASES)` and `basicAmount`
  (replacing `basicMonthly`). Field order: basis `Select` (Monthly / Hourly),
  amount (label "Monthly salary" or "Hourly pay" per basis, currency unit
  "/h" for hourly), the derived line "= {amount}/mo at {hours} h" under the
  amount (plain text inside an ICU message; it is a sentence, not a
  standalone figure), then pay year and components as today. The hours come
  from `getPayDefaults`. A basis change keeps the typed figure.
- **Edit-person dialog:** optional "Full-time hours per month" with the org
  default as placeholder. No new help here: the concept's help sits where
  the default is defined (the settings group), and a dialog title never
  carries two. Add-person dialog: no new field.
- **Person page:** the salary history's base column shows the figure with
  its unit ("195 kr/h", "32 000 kr/mo"); the total column stays the
  normalized monthly total. The person's own full-time hours show next to
  the FTE share only when set.

## Pay-mapping surfaces (`apps/dashboard/components/pay-mapping/`)

- Group member table, scatter hover and report tables keep showing
  normalized monthly figures. Hourly rows get a "Hourly" `Badge` in the name
  cell (inside a block flex wrapper so the skeleton rows keep measuring
  identical), and the report's member listing appends "(hourly)".
- Method note: a second sentence rendered only when the run has at least one
  hourly row: "Hourly pay is converted to full-time-equivalent monthly pay
  using {hours} full-time hours per month ({count} people with their own
  value)." `hours` is `payMappingRuns.fullTimeHoursDefault`, `count` is the
  number of hourly rows whose `hoursPerMonth` differs from it.
- `pay-mapping-gap-types.ts` passes the row basis to `fteTotalMonthlyComp`
  like the backend.

## i18n (en first, then sv, nb, da, fi, with the cross-locale read)

- `dashboard.people.salaryForm.basis.{label,monthly,hourly}`,
  `dashboard.people.salaryForm.hourlyAmount`, `dashboard.people.salaryForm.derivedMonthly`
  ("= {amount} per month at {hours} h"), `dashboard.people.payUnit.{monthly,hourly}`
  ("{amount}/mo", "{amount}/h"; sv "kr/mån", "kr/h"), `dashboard.people.detail.fullTimeHours`,
  `dashboard.people.form.fullTimeHoursPerMonth`.
- `dashboard.organization.general.payGroup`, `.fullTimeHoursLabel`,
  `.fullTimeHoursPlaceholder`.
- `dashboard.people.import.fields.{hourlyRate,fullTimeHoursPerMonth}`,
  `dashboard.people.import.review.hourly.{heading,interpreted,interpretToggle,ownHours,notice.hourlyLooksMonthly,notice.monthlyLooksHourly,notice.bothBasesPresent}`,
  `dashboard.people.import.done.hourlyPay`.
- `dashboard.payMapping.hourlyChip`, `dashboard.payMapping.report.hourlyNote`.
- `dashboard.help.fullTimeHoursLabel/Body` ("The monthly hours that count as
  full time, used to turn hourly pay into a monthly amount. A person's own
  value replaces the organization's default."), `dashboard.help.payBasisLabel/Body`
  ("Whether the figure is a monthly salary or an hourly rate. Hourly pay is
  compared as rate times full-time hours, so it is not FTE-adjusted again.").
  Both under the 200/240 caps.
- Audit: `dashboard.auditLog.fields.{basis,fullTimeHoursPerMonth,hourlyPay}`.
- Every locale ships at production quality with the cross-locale read.

## Documentation (`apps/dashboard/content/docs/<locale>/`, all five, then `bun run docs:sync`)

- `importing-people.mdx`: the two columns, how the single Lön column is read
  by pay form, the checkbox, the notices.
- `supported-payroll-exports.mdx`: the mixed Lön column pattern.
- `person-details-and-salary.mdx`: basis in the salary dialog, the derived
  line, own full-time hours.
- `organization-settings.mdx`: the full-time hours default and what it
  affects.
- `pay-mapping-overview.mdx` (where FTE adjustment is explained): hourly pay
  is converted, not FTE-adjusted; the method note names the factor.
- `troubleshooting-people-and-import.mdx`: the three notices.
- `glossary.mdx`: Hourly pay, Full-time hours per month.
- ADR-0029 (`docs/adr/0029-timlon-en-analysbas-heltidstimmar.md`, Swedish):
  context, the four decisions, consequences, deferred `yearlyPayouts` and the
  run-level selector.

## Tests

- Constants: `normalizedMonthlyBase` both bases and the throw; `fteTotalMonthlyComp`
  skips FTE on hourly; `defaultFullTimeHoursFor` per country and the clamp;
  `plausibilityFor` per currency and unknown.
- Import package: the two fields' synonyms match (and arbetstid does not);
  the `number` shape parses "162,5" and "162.5" without scaling; detect
  classifies an hours column; `fixedBasis` keeps `hourlyRate` out of the
  basis select; a new pipeline fixture in Visma layout with a mixed Lön
  column (monthly and hourly rows, pay form column) pins the whole path.
- Backend: `setSalary`/`appendSalary` with both bases and the validators;
  `getSalaryHistory`/`getCurrentSalary` normalize with person, org and
  country hours (three cases); `resolveFullTimeHours` order; prepare's four
  basis cases, `interpretHourly` off, the three notices at their bounds;
  `sameSalary` on a basis change; freeze writes raw + basis + hours +
  normalized and the run's default; the gap engine with an hourly row
  (women hourly vs men monthly measures the converted figure, no FTE
  division); `people.imported` carries `hourlyPay`; audit field labels and
  the person field-kind classification (existing coverage tests).
- Dashboard: salary dialog basis select and derived line; review step's
  hourly group, checkbox and preview re-run; done step count; the member
  table chip and the skeleton measurement; the method note's conditional
  sentence; the settings form field and its `isDirty` gate; i18n parity and
  help caps; docs guards.

## Verification on the dev deployment

`devReset`, then a browser pass: set the org default in settings (and clear
it), import a mixed Lön file (the corrected fixture with a handful of rows
switched to Timanställd with rates around 195), check the review step's
hourly group with the checkbox on and off, verify the person page shows
"195 kr/h" and the normalized total, add a manual hourly salary and watch the
derived line, freeze a run and confirm the member table chip, the scatter
position and the method note, then read the audit log rows.

## Out of scope (deliberately unchanged)

- `yearlyPayouts` (12 vs 12.2) and a run-level basis selector (Sysarb
  refinements; ADR-0029 records them as deferred).
- Editing `employmentType` in the UI (still import-only; the manual salary
  dialog's basis choice does not depend on it).
- An annual record basis: annual columns keep converting at import.
- Modelling shift and inconvenience supplements (OB) beyond today's
  components.
- A history of full-time hours (a current-state fact, not versioned).
- The downloadable import template (G36); the two new fields join `FIELDS`,
  so a later template gets them for free.
