import type { BasePayBasis, EmploymentType } from "@workspace/constants"

// Pure import-diff logic, shared by the real import (upsert patch, salary
// idempotency) and the review step's dry-run preview (previewImport), so the
// preview can never disagree with what the import would actually do.

// The optional person fields an import may carry. A field ABSENT from the
// file (undefined) is left untouched on the stored person: an import updates
// what it knows and never clears what it does not mention. (Comparing
// undefined against a stored value used to clear the field on re-imports
// from narrower files.)
export const PERSON_IMPORT_OPTIONAL_FIELDS = [
  "birthDate",
  "employmentStartDate",
  "ftePercent",
  "fullTimeHoursPerMonth",
  "country",
  "isManager",
  "statisticalCode",
  "department",
  "title",
  "employmentType",
] as const
export type PersonImportOptionalField =
  (typeof PERSON_IMPORT_OPTIONAL_FIELDS)[number]

export interface PersonImportValues {
  displayName: string
  gender: "Man" | "Kvinna"
  birthDate?: string
  employmentStartDate?: string
  ftePercent?: number
  fullTimeHoursPerMonth?: number
  country?: string
  isManager?: boolean
  statisticalCode?: string
  department?: string
  title?: string
  employmentType?: EmploymentType
}

// The stored side of the comparison (structural subset of the people doc).
export type StoredPersonValues = Partial<PersonImportValues>

// The patch an import applies to an existing person: only fields present in
// the incoming row AND different from the stored value. Empty patch = the
// row is unchanged.
export function personImportPatch(
  existing: StoredPersonValues,
  incoming: PersonImportValues
): Partial<PersonImportValues> {
  const patch: Partial<PersonImportValues> = {}
  if (incoming.displayName !== existing.displayName) {
    patch.displayName = incoming.displayName
  }
  if (incoming.gender !== existing.gender) {
    patch.gender = incoming.gender
  }
  for (const field of PERSON_IMPORT_OPTIONAL_FIELDS) {
    const value = incoming[field]
    if (value !== undefined && value !== existing[field]) {
      // Typed per-field on both sides; the loop erases the correlation.
      ;(patch as Record<string, unknown>)[field] = value
    }
  }
  return patch
}

export interface SalaryValues {
  payYear: number
  basis: BasePayBasis
  basicAmount: number
  currency: string
  components: Array<{ kind: string; monthlyAmount: number }>
}

// Whether an incoming salary row carries exactly the values of a stored
// record (the appendSalary idempotency rule: a re-import of the same file
// must not append a duplicate).
export function sameSalaryValues(a: SalaryValues, b: SalaryValues): boolean {
  return (
    a.payYear === b.payYear &&
    a.basis === b.basis &&
    a.basicAmount === b.basicAmount &&
    a.currency === b.currency &&
    a.components.length === b.components.length &&
    a.components.every(
      (c, i) =>
        c.kind === b.components[i]?.kind &&
        c.monthlyAmount === b.components[i]?.monthlyAmount
    )
  )
}

// ---------------------------------------------------------------------------
// The dry-run diff for the review step
// ---------------------------------------------------------------------------

// Rows per import-chunk transaction (importHelpers.importChunk). Sized by
// write cost: a worst-case row is a person patch + person audit row + salary
// insert + salary audit row, and each audit write also touches the two audit
// aggregates' tree nodes, call it low tens of document writes per row; fifty
// rows stays far under Convex's per-transaction caps (8192 writes / 16 MiB)
// with execution-time headroom, while cutting a large import's mutation
// count by two orders of magnitude versus the old two-mutations-per-row
// loop. Lives in this pure module because the Node action (import.ts) may
// not import the mutation module that consumes it.
export const IMPORT_CHUNK_SIZE = 50

export interface NormalizedImportRow {
  externalRef: string
  person: PersonImportValues
  salary: SalaryValues | null
}

export interface BaselinePerson {
  stored: StoredPersonValues
  latestSalary: SalaryValues | null
  // Set when the stored person is archived (a leaver). A row matching them
  // returns them to the active register; they are never "missing".
  archivedAt?: number
}

// One changed field, stringified for display (the client localizes the field
// label; values render as-is).
export interface FieldChange {
  field: string
  from: string
  to: string
}

// A person named by employee number and display name, for the review step's
// returning and missing-from-file lists.
export interface ImportPersonRef {
  externalRef: string
  displayName: string
}

export interface ImportPreviewDiff {
  people: {
    created: number
    updated: number
    unchanged: number
    // Rows whose stored person is archived: the import reactivates them.
    // Counted IN ADDITION to updated/unchanged (which describe their fields).
    returning: number
  }
  // Every person whose stored fields would change, with the per-field diff.
  updatedPeople: Array<{
    externalRef: string
    displayName: string
    changes: FieldChange[]
  }>
  // Archived people the file brings back.
  returningPeople: ImportPersonRef[]
  // Active people with an employee number that the file does not mention.
  // The import archives them only when the caller asks (archiveMissing).
  missingFromFile: ImportPersonRef[]
  // Same employee number, different name: likely a reused/typoed number.
  nameMismatches: Array<{
    externalRef: string
    storedName: string
    incomingName: string
  }>
  salary: {
    // Appended as new history entries (new person, first salary, or a new year).
    newEntries: number
    // Same pay year as the stored latest record but different values: either
    // a raise or a correction (phase 2 lets the user choose).
    changedSameYear: number
    identical: number
    changedDetails: Array<{
      externalRef: string
      displayName: string
      payYear: number
      from: { basis: BasePayBasis; amount: number }
      to: { basis: BasePayBasis; amount: number }
    }>
  }
}

function display(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value)
}

// Computes what the import WOULD do, using the same patch/idempotency rules
// the import itself applies. presentExternalRefs is the file's full set of
// employee numbers, hard-skipped rows included (import.ts's
// fileExternalRefs): a superset of rows' own refs, so a row that failed
// validation (e.g. an unparsable salary cell) still counts as present and is
// never listed as missing. Omitting it keeps today's rows-only behaviour.
export function diffImport(
  rows: NormalizedImportRow[],
  baselineByRef: Map<string, BaselinePerson>,
  presentExternalRefs?: Iterable<string>
): ImportPreviewDiff {
  const diff: ImportPreviewDiff = {
    people: { created: 0, updated: 0, unchanged: 0, returning: 0 },
    updatedPeople: [],
    returningPeople: [],
    missingFromFile: [],
    nameMismatches: [],
    salary: {
      newEntries: 0,
      changedSameYear: 0,
      identical: 0,
      changedDetails: [],
    },
  }
  const incomingRefs = new Set<string>()

  for (const row of rows) {
    incomingRefs.add(row.externalRef)
    const baseline = baselineByRef.get(row.externalRef)

    if (baseline === undefined) {
      diff.people.created += 1
      if (row.salary !== null) diff.salary.newEntries += 1
      continue
    }

    if (baseline.archivedAt !== undefined) {
      diff.people.returning += 1
      diff.returningPeople.push({
        externalRef: row.externalRef,
        displayName: row.person.displayName,
      })
    }

    const patch = personImportPatch(baseline.stored, row.person)
    if (Object.keys(patch).length === 0) {
      diff.people.unchanged += 1
    } else {
      diff.people.updated += 1
      diff.updatedPeople.push({
        externalRef: row.externalRef,
        displayName: row.person.displayName,
        changes: Object.entries(patch).map(([field, to]) => ({
          field,
          from: display(baseline.stored[field as keyof StoredPersonValues]),
          to: display(to),
        })),
      })
      if (
        patch.displayName !== undefined &&
        baseline.stored.displayName !== undefined
      ) {
        diff.nameMismatches.push({
          externalRef: row.externalRef,
          storedName: baseline.stored.displayName,
          incomingName: row.person.displayName,
        })
      }
    }

    if (row.salary !== null) {
      if (baseline.latestSalary === null) {
        diff.salary.newEntries += 1
      } else if (sameSalaryValues(row.salary, baseline.latestSalary)) {
        diff.salary.identical += 1
      } else if (row.salary.payYear === baseline.latestSalary.payYear) {
        diff.salary.changedSameYear += 1
        diff.salary.changedDetails.push({
          externalRef: row.externalRef,
          displayName: row.person.displayName,
          payYear: row.salary.payYear,
          from: {
            basis: baseline.latestSalary.basis,
            amount: baseline.latestSalary.basicAmount,
          },
          to: { basis: row.salary.basis, amount: row.salary.basicAmount },
        })
      } else {
        diff.salary.newEntries += 1
      }
    }
  }

  // Presence includes the caller's fuller ref set (e.g. hard-skipped rows),
  // on top of the rows this diff actually walked.
  for (const ref of presentExternalRefs ?? []) {
    incomingRefs.add(ref)
  }

  // Active people the file does not mention. Computed over the FULL row set
  // (the caller passes rows before any user-elected skip) union presentRefs,
  // so a row HR leaves out as a name mismatch, or a row a bad cell knocked
  // out of the rows list, still counts as present and is never archived.
  for (const [externalRef, baseline] of baselineByRef) {
    if (baseline.archivedAt !== undefined) continue
    if (incomingRefs.has(externalRef)) continue
    diff.missingFromFile.push({
      externalRef,
      displayName: baseline.stored.displayName ?? "",
    })
  }

  return diff
}
