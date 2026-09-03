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
  parseNumber,
  parsePercent,
  type RowIssueCode,
  tokenizeCsv,
  validateFile,
} from "@workspace/import"
import {
  DEFAULT_BASIS_BY_FIELD,
  FULL_TIME_HOURS_MAX,
  HOURLY_NOTICE_CODES,
  PAY_COMPONENT_KINDS,
  PEOPLE_ARCHIVE_CHUNK_SIZE,
  normalizeEmploymentType,
  plausibilityFor,
  toMonthly,
  type PayBasis,
} from "@workspace/constants"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { action, type ActionCtx } from "../_generated/server"
import { requireOrgMemberAction } from "../lib/functions"
import {
  type BaselinePerson,
  diffImport,
  IMPORT_CHUNK_SIZE,
  type ImportPersonRef,
  type ImportPreviewDiff,
  type NormalizedImportRow,
} from "./importDiff"
import {
  type HourlyNoticeCode,
  plausibilityNotice,
  resolveRowBasis,
} from "./importHourly"
import { basePayBasis } from "./tables"

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
  // Leavers archived because the caller asked (archiveMissing), and archived
  // people the file brought back (always).
  peopleArchived: v.number(),
  peopleReactivated: v.number(),
  // Rows written with the hourly basis (from a dedicated column or by the
  // pay-form interpretation). Count only.
  hourlyPay: v.number(),
  validation: validationValidator,
})

// Row-issue codes that make a row impossible to persist, so the whole row is
// skipped. Soft codes (fractionScaled, ambiguousDate, nonNumericCode,
// genderNameMismatch, unparsableHourlyRate) are informational: the row still
// imports. unparsableHourlyRate in particular reads as an absent hourly cell
// (prepareImport's parseMoney call also returns null for it), so the row
// falls through to the base-pay rules instead of losing the person: the
// optional column must never hard-skip on a placeholder cell.
//   - duplicateId:      the same externalRef twice; second write would collide.
//   - unparsableMoney:  no usable basicMonthly (the required column).
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
  basisMap?: Record<string, PayBasis>
  // Whether an hourly-typed row's base-pay cell is read as an hourly rate
  // when no dedicated hourly-rate column is mapped (resolveRowBasis rule 2).
  // Defaults on; the review step's checkbox can turn it off.
  interpretHourly?: boolean
}

// The row-level hourly-pay signals prepareImport collects alongside the
// normalized rows: which rows the pay-form rule interpreted, how many rows
// ended up hourly, and the soft plausibility/both-cells notices. Shared by
// previewImport's preview and importPayroll's own hourlyPay count.
type HourlyPaySummary = {
  interpreted: ImportPersonRef[]
  total: number
  notices: Array<{ code: HourlyNoticeCode; ref: ImportPersonRef }>
}

type PreparedImport =
  | { kind: "blocked"; validation: NormalizedValidation }
  | {
      kind: "ready"
      normalized: NormalizedImportRow[]
      // Every employee number appearing anywhere in the file, hard-skipped
      // rows included: a superset of normalized's refs. Presence for leaver
      // detection ("archiveMissing") and the preview's missingFromFile list.
      fileExternalRefs: string[]
      skippedRows: number
      validation: NormalizedValidation
      headers: string[]
      hourlyPay: HourlyPaySummary
      ownHoursCount: number
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

  // The default-on interpretation switch (resolveRowBasis rule 2): an
  // hourly-typed row's base-pay cell is read as an hourly rate unless the
  // review step's checkbox turns it off.
  const interpretHourly = args.interpretHourly ?? true

  // Fetch the org's pay defaults: currency is the fallback when no currency
  // column is mapped, and it also picks the plausibility bounds the
  // per-row size notices are judged against.
  const orgDefaults = await ctx.runQuery(
    internal.people.importHelpers.getOrgPayDefaults,
    { orgId: args.orgId }
  )
  const orgCurrency = orgDefaults.currency
  const bounds = plausibilityFor(orgCurrency)

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
  const employmentTypeCol = colOf("employmentType")
  const basicMonthlyCol = colOf("basicMonthly")
  const hourlyRateCol = colOf("hourlyRate")
  const fullTimeHoursCol = colOf("fullTimeHoursPerMonth")
  const currencyCol = colOf("currency")
  const payYearCol = colOf("payYear")

  const basisMap = args.basisMap
  const basisOf = (key: string): PayBasis =>
    (basisMap?.[key] as PayBasis | undefined) ??
    DEFAULT_BASIS_BY_FIELD[key as keyof typeof DEFAULT_BASIS_BY_FIELD] ??
    "monthly"

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

  // Every employee number in the file, whether its row imports or gets
  // hard-skipped: a failed salary cell or a duplicate id is not a departure,
  // so leaver detection must see this person as present regardless. A row
  // whose externalRef cell is blank/unreadable contributes nothing (it can
  // never match a stored person).
  const fileExternalRefs: string[] = []
  for (const row of rows) {
    const ref = (
      externalRefCol !== undefined ? (row[externalRefCol] ?? "") : ""
    ).trim()
    if (ref) fileExternalRefs.push(ref)
  }

  // Hourly-pay signals accumulated across the row loop: rows the pay-form
  // rule interpreted, rows that ended up hourly, and the soft notices
  // (plausibility + both-cells-present). Shared by previewImport's preview
  // and importPayroll's hourlyPay count.
  let hourlyTotal = 0
  let ownHoursCount = 0
  const interpretedRefs: ImportPersonRef[] = []
  const notices: Array<{ code: HourlyNoticeCode; ref: ImportPersonRef }> = []

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
    const employmentType =
      normalizeEmploymentType(cell(employmentTypeCol)) ?? undefined

    // The person's own full-time hours (overrides the org/country default;
    // resolveFullTimeHours in fullTimeHours.ts). Out-of-range or non-positive
    // cells are dropped rather than stored: the person falls back to the
    // org/country default instead of carrying a bad hours figure.
    const hoursRaw = cell(fullTimeHoursCol)
    const parsedHours = hoursRaw ? parseNumber(hoursRaw) : null
    const fullTimeHoursPerMonth =
      parsedHours !== null &&
      parsedHours > 0 &&
      parsedHours <= FULL_TIME_HOURS_MAX
        ? parsedHours
        : undefined

    // Salary fields. An unparsable/absent base pay AND hourly rate drops the
    // salary only (the person still imports). resolveRowBasis is the single
    // pure rule for which basis the row's figure is in (dedicated hourly
    // column, pay-form interpretation, or the base-pay column's own basis);
    // plausibilityNotice adds the soft size-based review notice on top.
    const baseRaw = cell(basicMonthlyCol)
    const hourlyRaw = cell(hourlyRateCol)
    const resolvedBasis = resolveRowBasis({
      parsedBase: baseRaw ? parseMoney(baseRaw) : null,
      parsedHourly: hourlyRaw ? parseMoney(hourlyRaw) : null,
      employmentType,
      interpretHourly,
      baseColumnBasis: basisOf("basicMonthly"),
    })

    let salary: NormalizedImportRow["salary"] = null
    if (resolvedBasis !== null) {
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

      // Build compensation components from every optionally-mapped component
      // column (field key === kind), normalizing each to a monthly amount via
      // its resolved basis so annual-flavoured columns (e.g. bonus) divide by
      // 12 before storage.
      const components: Array<{ kind: string; monthlyAmount: number }> = []
      for (const kind of PAY_COMPONENT_KINDS) {
        const col = colOf(kind)
        if (col === undefined) continue
        const raw = cell(col)
        if (!raw) continue
        const parsed = parseMoney(raw)
        if (parsed === null || parsed <= 0) continue
        components.push({
          kind,
          monthlyAmount: toMonthly(parsed, basisOf(kind)),
        })
      }

      salary = {
        payYear,
        basis: resolvedBasis.basis,
        basicAmount: resolvedBasis.basicAmount,
        currency,
        components,
      }
      const ref = { externalRef, displayName }
      if (resolvedBasis.basis === "hourly") hourlyTotal += 1
      if (resolvedBasis.interpreted) interpretedRefs.push(ref)
      if (resolvedBasis.notice !== null) {
        notices.push({ code: resolvedBasis.notice, ref })
      }
      const sizeNotice = plausibilityNotice(
        resolvedBasis,
        employmentType,
        bounds
      )
      if (sizeNotice !== null) notices.push({ code: sizeNotice, ref })
    }
    if (fullTimeHoursPerMonth !== undefined) ownHoursCount += 1

    normalized.push({
      externalRef,
      person: {
        displayName,
        gender: parsedGender,
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(employmentStartDate !== undefined ? { employmentStartDate } : {}),
        ...(ftePercent !== undefined ? { ftePercent } : {}),
        ...(fullTimeHoursPerMonth !== undefined
          ? { fullTimeHoursPerMonth }
          : {}),
        ...(country !== undefined ? { country } : {}),
        ...(isManager !== undefined ? { isManager } : {}),
        ...(statisticalCode !== undefined ? { statisticalCode } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(employmentType !== undefined ? { employmentType } : {}),
      },
      salary,
    })
  }

  return {
    kind: "ready",
    normalized,
    fileExternalRefs,
    skippedRows: skippedRowIndices.size,
    validation: normalizedValidation,
    headers,
    hourlyPay: { interpreted: interpretedRefs, total: hourlyTotal, notices },
    ownHoursCount,
  }
}

// Ingests a payroll CSV end-to-end. The wizard calls this after the HR admin
// confirms the column mapping on the review screen.
//
// Args:
//   orgId     - The org the data belongs to (membership gate enforced).
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
//   archiveMissing - Archive every active person with an employee number
//               that the file does not mention. Off by default.
//   basisMap  - Optional canonical-field-key -> "monthly"|"annual" map, so the
//               wizard can tell the ingest an annual-flavoured column (e.g. an
//               annual bonus) needs dividing by 12. Falls back to
//               DEFAULT_BASIS_BY_FIELD, then "monthly", when a field is absent.
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
    // Archive every active person with an employee number that the file
    // does not mention. Off by default: the review step's checkbox sets it.
    archiveMissing: v.optional(v.boolean()),
    // Identifies this run in the importProgress table so the wizard's
    // importing screen never shows a stale row from an earlier run.
    importId: v.optional(v.string()),
    basisMap: v.optional(
      v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual")))
    ),
    // Whether an hourly-typed row's base-pay cell is read as an hourly rate
    // when no dedicated hourly-rate column is mapped. Defaults on; the
    // review step's checkbox can turn it off (see resolveRowBasis rule 2).
    interpretHourly: v.optional(v.boolean()),
  },
  returns: importResultValidator,
  handler: async (ctx, args) => {
    // Callers that do not track progress (tests) get a throwaway id.
    const importId = args.importId ?? randomUUID()
    // Authenticate + assert org membership: importing people is member-level
    // work, the same gate the people mutations take.
    const actorId = await requireOrgMemberAction(ctx, args.orgId)

    const prepared = await prepareImport(ctx, args)
    if (prepared.kind === "blocked") {
      return {
        ok: false,
        peopleCreated: 0,
        peopleUpdated: 0,
        peopleUnchanged: 0,
        salariesImported: 0,
        skippedRows: 0,
        peopleArchived: 0,
        peopleReactivated: 0,
        hourlyPay: 0,
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
    let peopleReactivated = 0
    let peopleArchived = 0
    // Rows actually written with the hourly basis (counted per chunk, at the
    // same point salariesImported is: an identical re-import or a skipped
    // row appends no salary and contributes nothing here).
    let hourlyPay = 0

    // The leaver set is computed BEFORE the rows land so the progress total
    // is known up front. Presence is judged on fileExternalRefs: every
    // employee number anywhere in the file, hard-skipped rows (duplicateId,
    // unparsableMoney, negativeValue, ...) and user-elected skips included.
    // A row HR leaves out as a name mismatch, or a row a bad salary cell
    // knocked out, is still in the file, so that person is never a leaver.
    // A person created by this import is by definition present.
    const toArchive: Id<"people">[] = []
    if (args.archiveMissing === true) {
      const active = await ctx.runQuery(
        internal.people.importHelpers.getActiveExternalRefs,
        { orgId: args.orgId }
      )
      const present = new Set(prepared.fileExternalRefs)
      for (const person of active) {
        if (!present.has(person.externalRef)) toArchive.push(person.personId)
      }
    }
    const total = rows.length + toArchive.length

    // Live progress for the importing screen: 0/total up front (the setup
    // state), then each chunk writes its own committed count in the same
    // transaction as its rows or its archived leavers.
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: 0,
      total,
    })

    // One shared stamp for the whole run, so every chunk's salaries carry
    // the same effective time.
    const effectiveAt = args.effectiveAt ?? Date.now()

    // Sequential chunks of IMPORT_CHUNK_SIZE rows, each ONE transaction
    // (person upserts, salary appends, progress). Sequential rather than
    // parallel on purpose: chunks cannot OCC-conflict with each other, the
    // progress row stays monotonic, and a failure leaves whole committed
    // chunks a re-run finishes idempotently.
    for (let start = 0; start < rows.length; start += IMPORT_CHUNK_SIZE) {
      const chunk = await ctx.runMutation(
        internal.people.importHelpers.importChunk,
        {
          orgId: args.orgId,
          actorId,
          importId,
          effectiveAt,
          processedBefore: start,
          total,
          rows: rows.slice(start, start + IMPORT_CHUNK_SIZE),
        }
      )
      peopleCreated += chunk.peopleCreated
      peopleUpdated += chunk.peopleUpdated
      peopleUnchanged += chunk.peopleUnchanged
      salariesImported += chunk.salariesImported
      peopleReactivated += chunk.peopleReactivated
      hourlyPay += chunk.hourlyPay
    }

    // Leavers, in the same bounded-chunk shape, continuing the progress
    // count past the last row.
    for (
      let start = 0;
      start < toArchive.length;
      start += PEOPLE_ARCHIVE_CHUNK_SIZE
    ) {
      const chunk = await ctx.runMutation(
        internal.people.importHelpers.archiveChunk,
        {
          orgId: args.orgId,
          actorId,
          importId,
          personIds: toArchive.slice(start, start + PEOPLE_ARCHIVE_CHUNK_SIZE),
          processedBefore: rows.length + start,
          total,
        }
      )
      peopleArchived += chunk.archived
    }

    // Everything processed: show the final count while the post-loop steps
    // (profile save, employee count, audit, classification) run.
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: total,
      total,
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
      {
        orgId: args.orgId,
        actorId,
        columnMap: profileColumnMap,
        ...(args.basisMap !== undefined ? { basisMap: args.basisMap } : {}),
      }
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
      peopleArchived,
      peopleReactivated,
      hourlyPay,
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
      peopleArchived,
      peopleReactivated,
      hourlyPay,
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

const importPersonRefValidator = v.object({
  externalRef: v.string(),
  displayName: v.string(),
})

// A base-pay figure with its basis, for the salary diff's from/to (replaces
// a bare number: a raise from an hourly rate to a monthly salary, or vice
// versa, must show both sides' basis, not just the amount).
const salaryBasisAmountValidator = v.object({
  basis: basePayBasis,
  amount: v.number(),
})

const salaryChangeDetailValidator = v.object({
  externalRef: v.string(),
  displayName: v.string(),
  payYear: v.number(),
  from: salaryBasisAmountValidator,
  to: salaryBasisAmountValidator,
})

const importDiffValidator = v.object({
  people: v.object({
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    returning: v.number(),
  }),
  updatedPeople: v.array(updatedPersonValidator),
  returningPeople: v.array(importPersonRefValidator),
  missingFromFile: v.array(importPersonRefValidator),
  nameMismatches: v.array(nameMismatchValidator),
  salary: v.object({
    newEntries: v.number(),
    changedSameYear: v.number(),
    identical: v.number(),
    changedDetails: v.array(salaryChangeDetailValidator),
  }),
})

const hourlyNoticeCodeValidator = v.union(
  ...HOURLY_NOTICE_CODES.map((code) => v.literal(code))
)

const hourlyNoticeValidator = v.object({
  code: hourlyNoticeCodeValidator,
  ref: importPersonRefValidator,
})

const hourlyPayPreviewValidator = v.object({
  interpreted: v.array(importPersonRefValidator),
  total: v.number(),
  notices: v.array(hourlyNoticeValidator),
})

const importPreviewValidator = v.object({
  ok: v.boolean(),
  validation: validationValidator,
  skippedRows: v.number(),
  // null when the file is blocked (required fields unmapped / unreadable).
  diff: v.union(importDiffValidator, v.null()),
  // Present only when ok: the row-level hourly-pay signals for the review
  // step (which rows the pay-form rule interpreted, and the soft notices).
  hourlyPay: v.optional(hourlyPayPreviewValidator),
  ownHoursCount: v.optional(v.number()),
})

// The explicit handler return type: annotating it short-circuits TypeScript's
// handler-return inference, the other half of the api-type collapse.
type ImportPreview = {
  ok: boolean
  validation: NormalizedValidation
  skippedRows: number
  diff: ImportPreviewDiff | null
  hourlyPay?: HourlyPaySummary
  ownHoursCount?: number
}

// Dry-runs the import for the review step: the SAME preparation pipeline as
// importPayroll, diffed against the stored people + latest salaries via the
// shared importDiff rules, writing nothing. It takes the same arguments as
// importPayroll (including basisMap, so the preview's monthly/annual
// normalization matches the real import), and what this returns is, by
// construction, what importPayroll would do with them.
export const previewImport = action({
  args: {
    orgId: v.string(),
    csvText: v.string(),
    columnMap: v.array(v.array(v.string())),
    payYear: v.optional(v.number()),
    genderOverrides: v.optional(v.array(v.array(v.string()))),
    basisMap: v.optional(
      v.record(v.string(), v.union(v.literal("monthly"), v.literal("annual")))
    ),
    // Whether an hourly-typed row's base-pay cell is read as an hourly rate
    // when no dedicated hourly-rate column is mapped. Defaults on; the
    // review step's checkbox can turn it off (see resolveRowBasis rule 2).
    interpretHourly: v.optional(v.boolean()),
  },
  returns: importPreviewValidator,
  handler: async (ctx, args): Promise<ImportPreview> => {
    await requireOrgMemberAction(ctx, args.orgId)

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
        const { latestSalary, externalRef, archivedAt, ...stored } = person
        return [
          externalRef,
          {
            stored,
            latestSalary,
            ...(archivedAt !== undefined ? { archivedAt } : {}),
          },
        ]
      })
    )

    return {
      ok: true,
      validation: prepared.validation,
      skippedRows: prepared.skippedRows,
      diff: diffImport(
        prepared.normalized,
        baselineByRef,
        prepared.fileExternalRefs
      ),
      hourlyPay: prepared.hourlyPay,
      ownHoursCount: prepared.ownHoursCount,
    }
  },
})
