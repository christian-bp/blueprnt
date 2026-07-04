"use node"

import { v } from "convex/values"
import {
  CANONICAL_FIELDS,
  classifyColumn,
  type DetectedMapping,
  parseBool,
  parseCurrency,
  parseDate,
  parseGender,
  parseMoney,
  parsePercent,
  type RowIssueCode,
  tokenizeCsv,
  validateImport,
} from "@workspace/import"
import { internal } from "../_generated/api"
import { action } from "../_generated/server"
import { requireOrgAdminAction } from "../lib/functions"

// Shape of the return value from importPayroll.
const importResultValidator = v.object({
  ok: v.boolean(),
  peopleImported: v.number(),
  salariesImported: v.number(),
  skippedRows: v.number(),
  // The full validation object from @workspace/import. Returned on both
  // success and failure so the caller can surface warnings + per-row issues.
  validation: v.object({
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
  }),
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
  },
  returns: importResultValidator,
  handler: async (ctx, args) => {
    // Step 1: Authenticate + assert org admin.
    const actorId = await requireOrgAdminAction(ctx, args.orgId)

    // Step 2: Tokenize + validate.
    const { headers, rows } = tokenizeCsv(args.csvText)

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

    const validation = validateImport({ headers, rows }, detected, {})

    // Normalize validation for return (plain arrays, typed strings).
    const normalizedValidation = {
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
    }

    // Step 3: Hard-block when required fields are unmapped.
    // skippedRows is 0 here: nothing was processed, so nothing was skipped.
    if (validation.blocking.length > 0) {
      return {
        ok: false,
        peopleImported: 0,
        salariesImported: 0,
        skippedRows: 0,
        validation: normalizedValidation,
      }
    }

    // Step 4: Identify skipped rows. Only HARD issues skip a row; soft issues
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
    const basicMonthlyCol = colOf("basicMonthly")
    const currencyCol = colOf("currency")
    const variableCol = colOf("variable")
    const benefitInKindCol = colOf("benefitInKind")
    const payYearCol = colOf("payYear")

    // The engine never reads the clock; the action supplies the reference year
    // for short-personnummer century expansion (explicit payYear arg > now).
    const referenceYear = args.payYear ?? new Date().getFullYear()

    // Fraction is a column-level decision (every non-blank cell <= 1.0). Classify
    // the mapped ftePercent column once, mirroring validateImport, so per-cell
    // parsePercent can scale a fractional column x100 (0.8 -> 80).
    const fteIsFraction =
      ftePercentCol !== undefined &&
      classifyColumn(rows.map((r) => r[ftePercentCol] ?? "")).fraction === true

    let peopleImported = 0
    let salariesImported = 0

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      if (skippedRowIndices.has(rowIdx)) continue

      const row = rows[rowIdx] ?? []
      const cell = (col: number | undefined): string =>
        col !== undefined ? (row[col] ?? "").trim() : ""

      // externalRef is required (would have blocked otherwise).
      const externalRef = cell(externalRefCol)
      if (!externalRef) continue

      // gender: parse with numeric-code support so SAP/SCB codes 1/2 resolve,
      // matching validateImport (which uses allowNumericCodes). Rows whose gender
      // still cannot resolve carry the unresolvedGender HARD issue and were
      // already dropped by skippedRowIndices; this null guard is defensive.
      const parsedGender = parseGender(cell(genderCol), {
        allowNumericCodes: true,
      })
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
        ? (parsePercent(ftePercentRaw, { fraction: fteIsFraction }) ??
          undefined)
        : undefined
      const country = cell(countryCol) || undefined
      const isManagerRaw = cell(isManagerCol)
      const isManager = isManagerRaw
        ? (parseBool(isManagerRaw) ?? undefined)
        : undefined
      const statisticalCode = cell(statisticalCodeCol) || undefined
      const department = cell(departmentCol) || undefined

      // Upsert the person.
      const personId = await ctx.runMutation(
        internal.people.people.upsertPersonByExternalRef,
        {
          orgId: args.orgId,
          actorId,
          externalRef,
          displayName,
          gender: parsedGender,
          ...(birthDate !== undefined ? { birthDate } : {}),
          ...(employmentStartDate !== undefined ? { employmentStartDate } : {}),
          ...(ftePercent !== undefined ? { ftePercent } : {}),
          ...(country !== undefined ? { country } : {}),
          ...(isManager !== undefined ? { isManager } : {}),
          ...(statisticalCode !== undefined ? { statisticalCode } : {}),
          ...(department !== undefined ? { department } : {}),
        }
      )
      peopleImported += 1

      // Salary fields.
      const basicMonthlyRaw = cell(basicMonthlyCol)
      const basicMonthly = basicMonthlyRaw
        ? (parseMoney(basicMonthlyRaw) ?? null)
        : null
      if (basicMonthly === null) {
        // basicMonthly unparseable on this row. Skip the salary row only
        // (person was already upserted above).
        continue
      }

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

      const effectiveAt = args.effectiveAt ?? Date.now()

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

      await ctx.runMutation(internal.people.pay.appendSalary, {
        orgId: args.orgId,
        actorId,
        personId,
        payYear,
        basicMonthly,
        currency,
        components,
        effectiveAt,
      })
      salariesImported += 1
    }

    // Step 5: Save the import mapping profile for the next re-import.
    // The schema stores columnMap as { canonicalFieldKey -> sourceHeader }
    // (canonical key is always ASCII, safe as a Convex record field name;
    // source headers may contain non-ASCII Swedish characters). Flip the pair
    // from the action's incoming [sourceHeader, canonicalKey] order.
    const profileColumnMap: Record<string, string> = {}
    for (const pair of args.columnMap) {
      const sourceHeader = pair[0]
      const canonicalKey = pair[1]
      if (sourceHeader === undefined || canonicalKey === undefined) continue
      if (headers.includes(sourceHeader)) {
        // Key = canonicalFieldKey (ASCII); value = sourceHeader (may be non-ASCII).
        profileColumnMap[canonicalKey] = sourceHeader
      }
    }
    await ctx.runMutation(
      internal.people.importProfile.internalSaveImportMappingProfile,
      { orgId: args.orgId, actorId, columnMap: profileColumnMap }
    )

    // Step 6: Set the authoritative employee count.
    await ctx.runMutation(
      internal.people.employeeCount.setEmployeeCountFromPeople,
      { orgId: args.orgId, actorId }
    )

    // Step 7: Audit the import completion (counts only, no PII/salary amounts).
    await ctx.runMutation(internal.people.importHelpers.logImportCompleted, {
      orgId: args.orgId,
      actorId,
      peopleImported,
      salariesImported,
      skippedRows: skippedRowIndices.size,
    })

    return {
      ok: true,
      peopleImported,
      salariesImported,
      skippedRows: skippedRowIndices.size,
      validation: normalizedValidation,
    }
  },
})
