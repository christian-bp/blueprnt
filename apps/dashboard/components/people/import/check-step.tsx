"use client"

import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
  type FieldTier,
  type FileWarningCode,
  type ImportValidation,
  type RowIssueCode,
  tokenizeCsv,
  validateImport,
} from "@workspace/import"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef } from "react"
import type { ParsedCsv } from "./import-wizard"
import { AssignGender } from "./assign-gender"

// The tier order the field-coverage groups render in.
const TIER_ORDER: readonly FieldTier[] = ["required", "recommended", "optional"]

// How many affected file rows to list per issue before eliding.
const MAX_LISTED_ROWS = 15

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a DetectedMapping from the flat wizard mapping record so that
 * validateImport can consume it. Each entry gets confidence: 1 since the
 * mapping was confirmed by the user on the map step.
 */
function buildDetectedMapping(mapping: Record<string, number>) {
  const map: Partial<
    Record<CanonicalFieldKey, { columnIndex: number; confidence: number }>
  > = {}
  for (const [key, columnIndex] of Object.entries(mapping)) {
    map[key as CanonicalFieldKey] = { columnIndex, confidence: 1 }
  }
  return { map, unmappedColumns: [] }
}

/**
 * Convert a 0-based data-row index to the row number the user sees in their
 * file (1-based, with the header on row 1, so the first data row is row 2).
 */
export function fileRowNumber(dataRowIndex: number): number {
  return dataRowIndex + 2
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CheckStepProps {
  parsed: ParsedCsv
  /** Current wizard mapping (canonical field key -> source column index). */
  mapping: Record<string, number>
  /** Raw CSV text, re-tokenized here to recover structural signals. */
  csvText: string
  /** Current per-row gender overrides (controlled), keyed by trimmed externalRef. */
  genderOverrides: Record<string, "Man" | "Kvinna">
  onGenderOverridesChange: (next: Record<string, "Man" | "Kvinna">) => void
  /**
   * Called after validation runs.
   * @param isBlocking - true when required fields are missing (Next must be disabled).
   * @param issueCount - number of per-row data quality issues detected.
   */
  onValidated: (isBlocking: boolean, issueCount: number) => void
  /** Jump back to the upload step so a corrected file can be uploaded. */
  onReupload: () => void
}

export function CheckStep({
  parsed,
  mapping,
  csvText,
  genderOverrides,
  onGenderOverridesChange,
  onValidated,
  onReupload,
}: CheckStepProps) {
  const tCheck = useTranslations("dashboard.people.import.check")
  const tFields = useTranslations("dashboard.people.import.fields")
  const tTier = useTranslations("dashboard.people.import.tier")

  const validation: ImportValidation = useMemo(() => {
    const detectedMapping = buildDetectedMapping(mapping)
    // Re-tokenize to recover structural signals (noDelimiter, raggedRows) that
    // the parsed headers/rows alone do not carry. tokenizeCsv never throws for
    // well-formed CSV; a binary file would already have been rejected on upload.
    const { signals } = tokenizeCsv(csvText)
    return validateImport(
      { headers: parsed.headers, rows: parsed.rows },
      detectedMapping,
      {},
      signals
    )
  }, [parsed, mapping, csvText])

  const isBlocking = validation.blocking.length > 0
  const issueCount = validation.issues.length

  // Keep a ref to the latest onValidated so the effect never needs to re-run
  // when the parent re-creates the inline callback (which would cause an
  // infinite setState loop). The effect only fires when isBlocking or
  // issueCount changes.
  const onValidatedRef = useRef(onValidated)
  onValidatedRef.current = onValidated

  // Notify the wizard of the blocking state and issue count each time
  // validation changes.
  useEffect(() => {
    onValidatedRef.current(isBlocking, issueCount)
  }, [isBlocking, issueCount])

  // Group issues by code (one entry per code, with the affected file rows).
  // unresolvedGender is excluded: those rows are fixed in-app via the
  // assign-gender section below, not by re-uploading a corrected file.
  const issueGroups = useMemo(() => {
    const groups = new Map<RowIssueCode, { count: number; rows: number[] }>()
    for (const issue of validation.issues) {
      if (issue.code === "unresolvedGender") continue
      const existing = groups.get(issue.code)
      if (existing) {
        existing.count += 1
        existing.rows.push(fileRowNumber(issue.row))
      } else {
        groups.set(issue.code, {
          count: 1,
          rows: [fileRowNumber(issue.row)],
        })
      }
    }
    return groups
  }, [validation.issues])

  // Rows flagged unresolvedGender, identified by their externalRef cell so the
  // HR admin can assign Man/Kvinna manually. The externalRef column is required
  // (validation would block without it), so it is present when we reach here.
  const flaggedGenderRows = useMemo(() => {
    const externalRefCol = mapping.externalRef
    if (externalRefCol === undefined) return []
    const out: Array<{ externalRef: string; rowIndex: number }> = []
    const seen = new Set<string>()
    for (const issue of validation.issues) {
      if (issue.code !== "unresolvedGender") continue
      const ref = (parsed.rows[issue.row]?.[externalRefCol] ?? "").trim()
      if (ref === "" || seen.has(ref)) continue
      seen.add(ref)
      out.push({ externalRef: ref, rowIndex: issue.row })
    }
    return out
  }, [validation.issues, mapping, parsed.rows])

  // The status column for one field-coverage row.
  function rowStatus(entry: { mapped: boolean; tier: FieldTier }) {
    if (entry.mapped) {
      return {
        icon: Tick02Icon,
        iconClass: "text-success",
        text: null, // replaced per row with the mapped column name
        textClass: "text-muted-foreground",
      }
    }
    if (entry.tier === "required") {
      return {
        icon: Cancel01Icon,
        iconClass: "text-destructive",
        text: tCheck("status.missing"),
        textClass: "font-medium text-destructive",
      }
    }
    return {
      icon: MinusSignIcon,
      iconClass: "text-muted-foreground",
      text: tCheck("status.notIncluded"),
      textClass: "text-muted-foreground",
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Blocking alert: required fields not mapped */}
      {isBlocking && (
        <Alert variant="destructive" data-testid="blocking-alert">
          <AlertTitle>{tCheck("blocking")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4">
              {validation.blocking.map((key) => {
                const field = CANONICAL_FIELDS.find((f) => f.key === key)
                return (
                  <li key={key}>
                    <span className="font-medium">
                      {tFields(key as Parameters<typeof tFields>[0])}
                    </span>
                    {field && (
                      <span className="ml-1 text-muted-foreground">
                        ({tTier(field.tier)})
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 font-medium">{tCheck("cannotProceed")}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Ready banner: all required fields mapped */}
      {!isBlocking && (
        <div
          data-testid="ready-indicator"
          className="flex items-start gap-3 rounded-md border p-4"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="mt-0.5 size-5 shrink-0 text-success"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-sm">{tCheck("ready")}</p>
            <p className="text-muted-foreground text-sm">
              {tCheck("readyDescription")}
            </p>
          </div>
        </div>
      )}

      {/* Field coverage, grouped by tier so the tier never reads as a status:
          the group heading says what is expected, the row status (icon + text)
          says what the file delivered. */}
      {TIER_ORDER.map((tier) => {
        const entries = validation.readiness.filter((e) => e.tier === tier)
        if (entries.length === 0) return null
        const showWarnings =
          tier === "recommended" && validation.warnings.length > 0
        return (
          <section
            key={tier}
            className="flex flex-col gap-2"
            data-testid={showWarnings ? "warnings-section" : undefined}
          >
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-sm">
                {tCheck(`groups.${tier}`)}
              </h3>
              {showWarnings && (
                <p className="text-muted-foreground text-sm">
                  {tCheck("warnings")}
                </p>
              )}
            </div>
            <div className="divide-y rounded-md border">
              {entries.map((entry) => {
                const fieldLabel = tFields(
                  entry.key as Parameters<typeof tFields>[0]
                )
                const status = rowStatus(entry)
                const columnIndex = mapping[entry.key]
                const statusText =
                  status.text ??
                  tCheck("status.mappedFrom", {
                    column: parsed.headers[columnIndex ?? -1] ?? "",
                  })
                return (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                    data-testid={`readiness-row-${entry.key}`}
                  >
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={status.icon}
                        strokeWidth={2}
                        className={`size-4 shrink-0 ${status.iconClass}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm">{fieldLabel}</span>
                    </div>
                    <span className={`text-xs ${status.textClass}`}>
                      {statusText}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* File-scoped warnings (shown once, not per row) */}
      {validation.fileWarnings && validation.fileWarnings.length > 0 && (
        <Alert data-testid="file-warnings-section">
          <AlertTitle>{tCheck("fileWarnings")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4">
              {validation.fileWarnings.map((code: FileWarningCode) => (
                <li key={code}>
                  {tCheck(
                    `fileWarning.${code}` as Parameters<typeof tCheck>[0]
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Data-quality issues: recommend fixing the source file and
          re-uploading (row numbers match the file, header on row 1). */}
      {issueGroups.size > 0 && (
        <div data-testid="issues-section" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-medium text-sm">{tCheck("issuesHeading")}</h3>
            <p className="text-muted-foreground text-sm">
              {tCheck("issuesHelp")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from(issueGroups.entries()).map(
              ([code, { count, rows }]) => {
                const listed = rows.slice(0, MAX_LISTED_ROWS).join(", ")
                const elided = rows.length > MAX_LISTED_ROWS ? ", …" : ""
                return (
                  <div
                    key={code}
                    className="flex flex-col gap-0.5 rounded-md border px-3 py-2"
                    data-testid={`issue-group-${code}`}
                  >
                    <span className="font-medium text-sm">
                      {tCheck(`issue.${code}` as Parameters<typeof tCheck>[0])}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {tCheck("affectedRows", {
                        count,
                        rows: `${listed}${elided}`,
                      })}
                    </span>
                  </div>
                )
              }
            )}
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReupload}
              data-testid="reupload-button"
            >
              {tCheck("reupload")}
            </Button>
          </div>
        </div>
      )}

      {/* Per-row gender assignment for unresolvedGender rows */}
      {flaggedGenderRows.length > 0 && (
        <AssignGender
          flagged={flaggedGenderRows}
          value={genderOverrides}
          onChange={onGenderOverridesChange}
        />
      )}
    </div>
  )
}
