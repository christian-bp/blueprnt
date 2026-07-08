"use node"

import { randomUUID } from "node:crypto"
import { v } from "convex/values"
import {
  CANONICAL_FIELDS,
  classifyColumn,
  type DetectedMapping,
  ImportFormatError,
  parseBool,
  parseCurrency,
  parseDate,
  parseGender,
  parseMoney,
  parsePercent,
  type RowIssueCode,
  tokenizeCsv,
  validateFile,
} from "@workspace/import"
import { internal } from "../_generated/api"
import { action, type ActionCtx } from "../_generated/server"
import { requireOrgAdminAction } from "../lib/functions"
import {
  type BaselinePerson,
  diffImport,
  type ImportPreviewDiff,
  type NormalizedImportRow,
} from "./importDiff"

// The full validation object from @workspace/import, returned on both success
// and failure so the caller can surface warnings + per-row issues. Shared by
// importPayroll and previewImport.
const validationValidator = v.object({
  readiness: v.array(
    v.object({
      key: v.string(),
      tier: v.string(),
      mapped: v.boolean(),
    })
  ),
  blocking: v.array(v.string()),
  warnings: v.array(v.string()),
  issues: v.array(
    v.object({
      row: v.number(),
      code: v.string(),
      detail: v.string(),
    })
  ),
  // File-level signals (Plan C). fileWarnings surfaces delimiter/mojibake
  // hints; fileFormatError marks a binary/unreadable file (also in blocking).
  fileWarnings: v.optional(v.array(v.string())),
  fileFormatError: v.optional(v.string()),
})

type NormalizedValidation = {
  readiness: Array<{ key: string; tier: string; mapped: boolean }>
  blocking: string[]
  warnings: string[]
  issues: Array<{ row: number; code: string; detail: string }>
  fileWarnings?: string[]
  fileFormatError?: string
}

// Shape of the return value from importPayroll.
const importResultValidator = v.object({
  ok: v.boolean(),
  // New people inserted vs existing people (matched by externalRef) whose
  // fields changed vs existing people whose incoming data was identical.
  peopleCreated: v.number(),
  peopleUpdated: v.number(),
  peopleUnchanged: v.number(),
  salariesImported: v.number(),
  skippedRows: v.number(),
  validation: validationValidator,
})

// Row-issue codes that make a row impossible to persist, so the whole row is
// skipped. Soft codes (fractionScaled, ambiguousDate, nonNumericCode,
// genderNameMismatch) are informational: the row still imports.
//   - duplicateId:      the same externalRef twice; second write would collide.
//   - unparsableMoney:  no usable basicMonthly.
//   - negativeValue:    negative/parenthesized money is unsupported for V1.
//   - unresolvedGender: person requires a Man/Kvinna gender to insert.
//   - raggedRow:        the row's columns do not line up with the header.
const HARD_SKIP_CODES: ReadonlySet<RowIssueCode> = new Set<RowIssueCode>([
  "duplicateId",
  "unparsableMoney",
  "negativeValue",
  "unresolvedGender",
  "raggedRow",
])

// The validation shape returned when the file itself is unreadable.
const FILE_FORMAT_VALIDATION: NormalizedValidation = {
  readiness: [],
  blocking: ["invalidFileFormat"],
  warnings: [],
  issues: [],
  fileFormatError: "invalidFileFormat",
}

// ---------------------------------------------------------------------------
// Shared preparation: tokenize -> map -> validate -> normalize every row.
// importPayroll persists the result; previewImport diffs it against the
// stored data WITHOUT writing, so the review preview cannot disagree with
// what the import would actually do (one code path, not two).
// ---------------------------------------------------------------------------

type PrepareArgs = {
  orgId: string
  csvText: string
  columnMap: string[][]
  payYear?: number
  genderOverrides?: string[][]
}

type PreparedImport =
  | { kind: "blocked"; validation: NormalizedValidation }
  | {
      kind: "ready"
      normalized: NormalizedImportRow[]
      skippedRows: number
      validation: NormalizedValidation
      headers: string[]
    }

async function prepareImport(
  ctx: ActionCtx,
  args: PrepareArgs
): Promise<PreparedImport> {
  // Tokenize + validate. A binary/unreadable file makes tokenizeCsv throw
  // ImportFormatError; catch it and return the invalidFileFormat blocking
  // signal (nothing persisted) instead of letting the action reject.
  let tokenized: ReturnType<typeof tokenizeCsv>
  try {
    tokenized = tokenizeCsv(args.csvText)
  } catch (err) {
    if (err instanceof ImportFormatError) {
      return { kind: "blocked", validation: FILE_FORMAT_VALIDATION }
    }
    throw err
  }
  const { headers, rows } = tokenized

  // Build a DetectedMapping from the wizard-confirmed columnMap.
  // columnMap is an array of [sourceHeader, canonicalFieldKey] pairs.
  // Invert to { canonicalFieldKey -> { columnIndex, confidence } }.
  const detectedMap: DetectedMapping["map"] = {}
  for (const pair of args.columnMap) {
    const sourceHeader = pair[0]
    const canonicalKey = pair[1]
    if (sourceHeader === undefined || canonicalKey === undefined) continue
    const colIdx = headers.indexOf(sourceHeader)
    if (colIdx === -1) continue
    const isKnown = CANONICAL_FIELDS.some((f) => f.key === canonicalKey)
    if (!isKnown) continue
    detectedMap[canonicalKey as keyof DetectedMapping["map"]] = {
      columnIndex: colIdx,
      confidence: 1,
    }
  }
  const detected: DetectedMapping = { map: detectedMap, unmappedColumns: [] }

  // Reuse the already-tokenized result so validateFile threads the tokenizer
  // signals (noDelimiter, raggedRows) without re-parsing, and populates
  // fileWarnings (noDelimiter/mojibake).
  const validation = validateFile(args.csvText, detected, {}, tokenized)

  // Normalize validation for return (plain arrays, typed strings). File-level
  // signals (fileWarnings, fileFormatError) are threaded so the wizard can
  // surface delimiter/mojibake hints and the invalid-file-format state.
  const normalizedValidation: NormalizedValidation = {
    readiness: validation.readiness.map((r) => ({
      key: r.key,
      tier: r.tier,
      mapped: r.mapped,
    })),
    blocking: [...validation.blocking],
    warnings: [...validation.warnings],
    issues: validation.issues.map((i) => ({
      row: i.row,
      code: i.code,
      detail: i.detail,
    })),
    ...(validation.fileWarnings !== undefined
      ? { fileWarnings: [...validation.fileWarnings] }
      : {}),
    ...(validation.fileFormatError !== undefined
      ? { fileFormatError: validation.fileFormatError }
      : {}),
  }

  // Hard-block when required fields are unmapped.
  if (validation.blocking.length > 0) {
    return { kind: "blocked", validation: normalizedValidation }
  }

  // Build the gender override lookup from the wizard-supplied pairs.
  // Only exact "Man" / "Kvinna" second values are honored; any other value is
  // ignored (the row stays unresolved). The lookup is built before
  // skippedRowIndices so the subtraction step below can reference it.
  const genderOverrideByRef = new Map<string, "Man" | "Kvinna">()
  for (const pair of args.genderOverrides ?? []) {
    const ref = pair[0]
    const value = pair[1]
    if (ref === undefined) continue
    if (value === "Man" || value === "Kvinna") {
      genderOverrideByRef.set(ref, value)
    }
  }

  // Identify skipped rows. Only HARD issues skip a row; soft issues
  // (fractionScaled, ambiguousDate, nonNumericCode, genderNameMismatch) are
  // informational and the row still imports.
  const skippedRowIndices = new Set(
    validation.issues
      .filter((i) => HARD_SKIP_CODES.has(i.code as RowIssueCode))
      .map((i) => i.row)
  )

  // Fetch the org's currency as the fallback when no currency column is mapped.
  const orgCurrency: string = await ctx.runQuery(
    internal.people.importHelpers.getOrgCurrency,
    { orgId: args.orgId }
  )

  // Helper: read a cell by canonical field key from the detected mapping.
  const colOf = (key: string): number | undefined =>
    detectedMap[key as keyof DetectedMapping["map"]]?.columnIndex

  // Precompute column indices for all relevant fields.
  const externalRefCol = colOf("externalRef")
  const firstNameCol = colOf("firstName")
  const lastNameCol = colOf("lastName")
  const genderCol = colOf("gender")
  const birthDateCol = colOf("birthDate")
  const employmentStartDateCol = colOf("employmentStartDate")
  const ftePercentCol = colOf("ftePercent")
  const countryCol = colOf("country")
  const isManagerCol = colOf("isManager")
  const statisticalCodeCol = colOf("statisticalCode")
  const departmentCol = colOf("department")
  const titleCol = colOf("title")
  const basicMonthlyCol = colOf("basicMonthly")
  const currencyCol = colOf("currency")
  const variableCol = colOf("variable")
  const benefitInKindCol = colOf("benefitInKind")
  const payYearCol = colOf("payYear")

  // Remove from skippedRowIndices any row whose ONLY hard blocker is
  // unresolvedGender AND which has a valid gender override. Such rows must
  // not be pre-skipped; the override supplies the gender during
  // normalization. A row that also carries another hard issue (e.g.
  // duplicateId) stays skipped even when a gender override is present.
  if (externalRefCol !== undefined) {
    for (const issue of validation.issues) {
      if (issue.code !== "unresolvedGender") continue
      const ref = (rows[issue.row]?.[externalRefCol] ?? "").trim()
      const hasOtherHardIssue = validation.issues.some(
        (o) =>
          o.row === issue.row &&
          o.code !== "unresolvedGender" &&
          HARD_SKIP_CODES.has(o.code as RowIssueCode)
      )
      if (!hasOtherHardIssue && genderOverrideByRef.has(ref)) {
        skippedRowIndices.delete(issue.row)
      }
    }
  }

  // The engine never reads the clock; the action supplies the reference year
  // for short-personnummer century expansion (explicit payYear arg > now).
  const referenceYear = args.payYear ?? new Date().getFullYear()

  // Fraction is a column-level decision (every non-blank cell <= 1.0). Classify
  // the mapped ftePercent column once, mirroring validateImport, so per-cell
  // parsePercent can scale a fractional column x100 (0.8 -> 80).
  const fteIsFraction =
    ftePercentCol !== undefined &&
    classifyColumn(rows.map((r) => r[ftePercentCol] ?? "")).fraction === true

  const normalized: NormalizedImportRow[] = []
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    if (skippedRowIndices.has(rowIdx)) continue

    const row = rows[rowIdx] ?? []
    const cell = (col: number | undefined): string =>
      col !== undefined ? (row[col] ?? "").trim() : ""

    // externalRef is required (would have blocked otherwise).
    const externalRef = cell(externalRefCol)
    if (!externalRef) continue

    // gender: parse with numeric-code support so SAP/SCB codes 1/2 resolve,
    // matching validateImport (which uses allowNumericCodes). When the parse
    // fails, fall back to the wizard's manual override for this externalRef.
    // A row still null after the override carries unresolvedGender (HARD) and
    // was already dropped by skippedRowIndices; the guard is defensive.
    const parsedGender =
      parseGender(cell(genderCol), { allowNumericCodes: true }) ??
      genderOverrideByRef.get(externalRef) ??
      null
    if (parsedGender === null) continue

    // displayName: join first + last names; fall back to externalRef if blank.
    const firstName = cell(firstNameCol)
    const lastName = cell(lastNameCol)
    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") || externalRef

    // Optional person fields.
    const birthDateRaw = cell(birthDateCol)
    const birthDate = birthDateRaw
      ? (parseDate(birthDateRaw, { headerGated: true, referenceYear }) ??
        undefined)
      : undefined
    const employmentStartDateRaw = cell(employmentStartDateCol)
    const employmentStartDate = employmentStartDateRaw
      ? (parseDate(employmentStartDateRaw, {
          headerGated: true,
          referenceYear,
        }) ?? undefined)
      : undefined
    const ftePercentRaw = cell(ftePercentCol)
    const ftePercent = ftePercentRaw
      ? (parsePercent(ftePercentRaw, { fraction: fteIsFraction }) ?? undefined)
      : undefined
    const country = cell(countryCol) || undefined
    const isManagerRaw = cell(isManagerCol)
    const isManager = isManagerRaw
      ? (parseBool(isManagerRaw) ?? undefined)
      : undefined
    const statisticalCode = cell(statisticalCodeCol) || undefined
    const department = cell(departmentCol) || undefined
    const title = cell(titleCol) || undefined

    // Salary fields. An unparsable basicMonthly drops the salary only (the
    // person still imports).
    const basicMonthlyRaw = cell(basicMonthlyCol)
    const basicMonthly = basicMonthlyRaw
      ? (parseMoney(basicMonthlyRaw) ?? null)
      : null

    let salary: NormalizedImportRow["salary"] = null
    if (basicMonthly !== null) {
      const currencyRaw = cell(currencyCol)
      const currency = currencyRaw
        ? (parseCurrency(currencyRaw) ?? orgCurrency)
        : orgCurrency

      // Pay year: explicit arg > row's payYear column > current year.
      let payYear: number
      if (args.payYear !== undefined) {
        payYear = args.payYear
      } else if (payYearCol !== undefined) {
        const pyRaw = cell(payYearCol)
        const pyParsed = pyRaw ? Number(pyRaw) : NaN
        payYear =
          Number.isInteger(pyParsed) && pyParsed > 1900
            ? pyParsed
            : new Date().getFullYear()
      } else {
        payYear = new Date().getFullYear()
      }

      // Build compensation components from optionally-mapped columns.
      const components: Array<{ kind: string; monthlyAmount: number }> = []
      const variableRaw = cell(variableCol)
      if (variableRaw) {
        const amount = parseMoney(variableRaw)
        if (amount !== null && amount > 0) {
          components.push({ kind: "variable", monthlyAmount: amount })
        }
      }
      const benefitRaw = cell(benefitInKindCol)
      if (benefitRaw) {
        const amount = parseMoney(benefitRaw)
        if (amount !== null && amount > 0) {
          components.push({ kind: "benefitInKind", monthlyAmount: amount })
        }
      }

      salary = { payYear, basicMonthly, currency, components }
    }

    normalized.push({
      externalRef,
      person: {
        displayName,
        gender: parsedGender,
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(employmentStartDate !== undefined ? { employmentStartDate } : {}),
        ...(ftePercent !== undefined ? { ftePercent } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(isManager !== undefined ? { isManager } : {}),
        ...(statisticalCode !== undefined ? { statisticalCode } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(title !== undefined ? { title } : {}),
      },
      salary,
    })
  }

  return {
    kind: "ready",
    normalized,
    skippedRows: skippedRowIndices.size,
    validation: normalizedValidation,
    headers,
  }
}

// Ingests a payroll CSV end-to-end. The wizard calls this after the HR admin
// confirms the column mapping on the review screen.
//
// Args:
//   orgId     - The org the data belongs to (admin gate enforced).
//   csvText   - The raw CSV text (as uploaded; BOM handled by tokenizeCsv).
//   columnMap - Array of [sourceHeader, canonicalFieldKey] pairs confirmed by
//               the wizard (e.g. [["Anstnr","externalRef"],["Månadslön","basicMonthly"]]).
//               Represented as pairs rather than a plain object so non-ASCII
//               header names (e.g. Swedish "Månadslön") can be passed without
//               hitting Convex's ASCII-only field-name constraint on v.record.
//   payYear   - Override pay year; if omitted, each row's payYear column is used
//               when mapped, otherwise the current calendar year.
//   effectiveAt - Override effective timestamp; defaults to Date.now().
//   genderOverrides - Optional [externalRef, "Man"|"Kvinna"] pairs supplying a
//               manual gender for rows the parser could not resolve, so those
//               rows import instead of being skipped as unresolvedGender.
//   skipExternalRefs - Rows to leave out entirely (person AND salary), e.g.
//               the review step's name-mismatch guard. Counted as skipped.
//
// Returns:
//   ok:false + validation when REQUIRED fields are unmapped (nothing persisted).
//   ok:true + counts when the import ran (rows with per-row issues are skipped).
export const importPayroll = action({
  args: {
    orgId: v.string(),
    csvText: v.string(),
    columnMap: v.array(v.array(v.string())),
    payYear: v.optional(v.number()),
    effectiveAt: v.optional(v.number()),
    // Manual Man/Kvinna assignments for rows the parser could not resolve.
    // Each entry is [externalRef, "Man"|"Kvinna"], mirroring columnMap's
    // array-of-pairs shape (Convex-serializable without non-ASCII record keys).
    genderOverrides: v.optional(v.array(v.array(v.string()))),
    skipExternalRefs: v.optional(v.array(v.string())),
    // Identifies this run in the importProgress table so the wizard's
    // importing screen never shows a stale row from an earlier run.
    importId: v.optional(v.string()),
  },
  returns: importResultValidator,
  handler: async (ctx, args) => {
    // Callers that do not track progress (tests) get a throwaway id.
    const importId = args.importId ?? randomUUID()
    // Authenticate + assert org admin.
    const actorId = await requireOrgAdminAction(ctx, args.orgId)

    const prepared = await prepareImport(ctx, args)
    if (prepared.kind === "blocked") {
      return {
        ok: false,
        peopleCreated: 0,
        peopleUpdated: 0,
        peopleUnchanged: 0,
        salariesImported: 0,
        skippedRows: 0,
        validation: prepared.validation,
      }
    }

    // User-elected skips (review step's name-mismatch guard): the whole row
    // (person AND salary) is left out and counted as skipped.
    const skipRefs = new Set(args.skipExternalRefs ?? [])
    const rows = prepared.normalized.filter((r) => !skipRefs.has(r.externalRef))
    const skippedRows =
      prepared.skippedRows + (prepared.normalized.length - rows.length)

    let peopleCreated = 0
    let peopleUpdated = 0
    let peopleUnchanged = 0
    let salariesImported = 0

    // Live progress for the importing screen: one row per org, updated every
    // PROGRESS_FLUSH_EVERY rows (a per-row write would double the mutation
    // count for no visible gain) and removed again after the loop.
    const PROGRESS_FLUSH_EVERY = 10
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: 0,
      total: rows.length,
    })

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      if (rowIdx > 0 && rowIdx % PROGRESS_FLUSH_EVERY === 0) {
        await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
          orgId: args.orgId,
          importId,
          processed: rowIdx,
          total: rows.length,
        })
      }
      const row = rows[rowIdx]
      if (row === undefined) continue

      // Upsert the person.
      const { personId, outcome } = await ctx.runMutation(
        internal.people.people.upsertPersonByExternalRef,
        {
          orgId: args.orgId,
          actorId,
          externalRef: row.externalRef,
          ...row.person,
        }
      )
      if (outcome === "created") {
        peopleCreated += 1
      } else if (outcome === "updated") {
        peopleUpdated += 1
      } else {
        peopleUnchanged += 1
      }

      if (row.salary === null) continue

      const { created: salaryCreated } = await ctx.runMutation(
        internal.people.pay.appendSalary,
        {
          orgId: args.orgId,
          actorId,
          personId,
          ...row.salary,
          effectiveAt: args.effectiveAt ?? Date.now(),
        }
      )
      // Identical re-imports skip the append; count only real inserts.
      if (salaryCreated) {
        salariesImported += 1
      }
    }

    // All rows processed: show the final count while the post-loop steps
    // (profile save, employee count, audit, classification) run.
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: rows.length,
      total: rows.length,
    })

    // Save the import mapping profile for the next re-import.
    // The schema stores columnMap as { canonicalFieldKey -> sourceHeader }
    // (canonical key is always ASCII, safe as a Convex record field name;
    // source headers may contain non-ASCII Swedish characters). Flip the pair
    // from the action's incoming [sourceHeader, canonicalKey] order.
    const profileColumnMap: Record<string, string> = {}
    for (const pair of args.columnMap) {
      const sourceHeader = pair[0]
      const canonicalKey = pair[1]
      if (sourceHeader === undefined || canonicalKey === undefined) continue
      if (prepared.headers.includes(sourceHeader)) {
        // Key = canonicalFieldKey (ASCII); value = sourceHeader (may be non-ASCII).
        profileColumnMap[canonicalKey] = sourceHeader
      }
    }
    await ctx.runMutation(
      internal.people.importProfile.internalSaveImportMappingProfile,
      { orgId: args.orgId, actorId, columnMap: profileColumnMap }
    )

    // Set the authoritative employee count.
    await ctx.runMutation(
      internal.people.employeeCount.setEmployeeCountFromPeople,
      { orgId: args.orgId, actorId }
    )

    // Audit the import completion (counts only, no PII/salary amounts).
    await ctx.runMutation(internal.people.importHelpers.logImportCompleted, {
      orgId: args.orgId,
      actorId,
      peopleCreated,
      peopleUpdated,
      peopleUnchanged,
      salariesImported,
      skippedRows,
    })

    // Run classification suggestions for the freshly imported people
    // (titles now persisted). Deterministic engines, no AI (ADR-0003).
    await ctx.runMutation(
      internal.people.classificationInternal
        .internalRunClassificationSuggestions,
      { orgId: args.orgId, actorId }
    )

    // The import is done: remove the ephemeral progress row.
    await ctx.runMutation(internal.people.importHelpers.clearImportProgress, {
      orgId: args.orgId,
    })

    return {
      ok: true,
      peopleCreated,
      peopleUpdated,
      peopleUnchanged,
      salariesImported,
      skippedRows,
      validation: prepared.validation,
    }
  },
})

// Shape of previewImport's dry-run diff (mirrors ImportPreviewDiff). Named
// intermediate validators keep the inferred type shallow enough that the
// generated api type does not collapse (an inline deeply-nested union made
// ApiFromModules degrade every module's types to any).
const fieldChangeValidator = v.object({
  field: v.string(),
  from: v.string(),
  to: v.string(),
})

const updatedPersonValidator = v.object({
  externalRef: v.string(),
  displayName: v.string(),
  changes: v.array(fieldChangeValidator),
})

const nameMismatchValidator = v.object({
  externalRef: v.string(),
  storedName: v.string(),
  incomingName: v.string(),
})

const salaryChangeDetailValidator = v.object({
  externalRef: v.string(),
  displayName: v.string(),
  payYear: v.number(),
  from: v.number(),
  to: v.number(),
})

const importDiffValidator = v.object({
  people: v.object({
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
  }),
  updatedPeople: v.array(updatedPersonValidator),
  nameMismatches: v.array(nameMismatchValidator),
  salary: v.object({
    newEntries: v.number(),
    changedSameYear: v.number(),
    identical: v.number(),
    changedDetails: v.array(salaryChangeDetailValidator),
  }),
})

const importPreviewValidator = v.object({
  ok: v.boolean(),
  validation: validationValidator,
  skippedRows: v.number(),
  // null when the file is blocked (required fields unmapped / unreadable).
  diff: v.union(importDiffValidator, v.null()),
})

// The explicit handler return type: annotating it short-circuits TypeScript's
// handler-return inference, the other half of the api-type collapse.
type ImportPreview = {
  ok: boolean
  validation: NormalizedValidation
  skippedRows: number
  diff: ImportPreviewDiff | null
}

// Dry-runs the import for the review step: the SAME preparation pipeline as
// importPayroll, diffed against the stored people + latest salaries via the
// shared importDiff rules, writing nothing. What this returns is, by
// construction, what importPayroll would do with the same arguments.
export const previewImport = action({
  args: {
    orgId: v.string(),
    csvText: v.string(),
    columnMap: v.array(v.array(v.string())),
    payYear: v.optional(v.number()),
    genderOverrides: v.optional(v.array(v.array(v.string()))),
  },
  returns: importPreviewValidator,
  handler: async (ctx, args): Promise<ImportPreview> => {
    await requireOrgAdminAction(ctx, args.orgId)

    const prepared = await prepareImport(ctx, args)
    if (prepared.kind === "blocked") {
      return {
        ok: false,
        validation: prepared.validation,
        skippedRows: 0,
        diff: null,
      }
    }

    const baseline = await ctx.runQuery(
      internal.people.importHelpers.getImportBaseline,
      { orgId: args.orgId }
    )
    const baselineByRef = new Map<string, BaselinePerson>(
      baseline.map((person) => {
        const { latestSalary, externalRef, ...stored } = person
        return [externalRef, { stored, latestSalary }]
      })
    )

    return {
      ok: true,
      validation: prepared.validation,
      skippedRows: prepared.skippedRows,
      diff: diffImport(prepared.normalized, baselineByRef),
    }
  },
})
