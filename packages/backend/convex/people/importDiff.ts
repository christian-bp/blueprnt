import type { EmploymentType } from "@workspace/constants"

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
  basicMonthly: number
  currency: string
  components: Array<{ kind: string; monthlyAmount: number }>
}

// Whether an incoming salary row carries exactly the values of a stored
// record (the appendSalary idempotency rule: a re-import of the same file
// must not append a duplicate).
export function sameSalaryValues(a: SalaryValues, b: SalaryValues): boolean {
  return (
    a.payYear === b.payYear &&
    a.basicMonthly === b.basicMonthly &&
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

export interface NormalizedImportRow {
  externalRef: string
  person: PersonImportValues
  salary: SalaryValues | null
}

export interface BaselinePerson {
  stored: StoredPersonValues
  latestSalary: SalaryValues | null
}

// One changed field, stringified for display (the client localizes the field
// label; values render as-is).
export interface FieldChange {
  field: string
  from: string
  to: string
}

export interface ImportPreviewDiff {
  people: { created: number; updated: number; unchanged: number }
  // Every person whose stored fields would change, with the per-field diff.
  updatedPeople: Array<{
    externalRef: string
    displayName: string
    changes: FieldChange[]
  }>
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
      from: number
      to: number
    }>
  }
}

function display(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value)
}

// Computes what the import WOULD do, using the same patch/idempotency rules
// the import itself applies.
export function diffImport(
  rows: NormalizedImportRow[],
  baselineByRef: Map<string, BaselinePerson>
): ImportPreviewDiff {
  const diff: ImportPreviewDiff = {
    people: { created: 0, updated: 0, unchanged: 0 },
    updatedPeople: [],
    nameMismatches: [],
    salary: {
      newEntries: 0,
      changedSameYear: 0,
      identical: 0,
      changedDetails: [],
    },
  }

  for (const row of rows) {
    const baseline = baselineByRef.get(row.externalRef)

    if (baseline === undefined) {
      diff.people.created += 1
      if (row.salary !== null) diff.salary.newEntries += 1
      continue
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
          from: baseline.latestSalary.basicMonthly,
          to: row.salary.basicMonthly,
        })
      } else {
        diff.salary.newEntries += 1
      }
    }
  }

  return diff
}
