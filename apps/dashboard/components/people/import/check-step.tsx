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
  ROW_ISSUE_SEVERITY,
  type RowIssue,
  type RowIssueCode,
  tokenizeCsv,
  validateImport,
} from "@workspace/import"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
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

/** Group issues by code, collecting the affected file rows (deduplicated:
 *  a row can carry the same issue twice, e.g. two ambiguous date columns). */
function groupIssues(issues: RowIssue[]) {
  const groups = new Map<RowIssueCode, Set<number>>()
  for (const issue of issues) {
    let rows = groups.get(issue.code)
    if (rows === undefined) {
      rows = new Set()
      groups.set(issue.code, rows)
    }
    rows.add(fileRowNumber(issue.row))
  }
  return groups
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
   * Called after validation runs (and again when a gender is assigned).
   * @param isBlocking - true while the import cannot continue: required
   *   fields missing, hard data errors in the file, or flagged genders not
   *   yet assigned. Next must be disabled.
   */
  onValidated: (isBlocking: boolean) => void
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

  // Split the per-row issues by how they are resolved: hard errors need a
  // corrected file (unresolvedGender is the exception, fixed in-app below);
  // notices are interpretations worth a look and never block.
  const { hardGroups, noticeGroups } = useMemo(() => {
    return {
      hardGroups: groupIssues(
        validation.issues.filter(
          (i) =>
            ROW_ISSUE_SEVERITY[i.code] === "error" &&
            i.code !== "unresolvedGender"
        )
      ),
      noticeGroups: groupIssues(
        validation.issues.filter((i) => ROW_ISSUE_SEVERITY[i.code] === "notice")
      ),
    }
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

  // The full continue gate: missing required fields, hard data errors (fix
  // the file and re-upload), or flagged genders not yet assigned in-app.
  const fieldsBlocked = validation.blocking.length > 0
  const issuesBlocked = hardGroups.size > 0
  const gendersBlocked = flaggedGenderRows.some(
    ({ externalRef }) => genderOverrides[externalRef] === undefined
  )
  const isBlocking = fieldsBlocked || issuesBlocked || gendersBlocked

  // Keep a ref to the latest onValidated so the effect never needs to re-run
  // when the parent re-creates the inline callback (which would cause an
  // infinite setState loop). The effect only fires when the gate changes.
  const onValidatedRef = useRef(onValidated)
  onValidatedRef.current = onValidated

  // Notify the wizard of the blocking state each time validation (or a
  // gender assignment) changes.
  useEffect(() => {
    onValidatedRef.current(isBlocking)
  }, [isBlocking])

  // One list entry per issue code: the label on top, then the affected file
  // rows as monospace chips (easier to scan than a comma-separated sentence).
  function renderIssueGroups(
    groups: Map<RowIssueCode, Set<number>>,
    testidPrefix: string
  ) {
    return (
      <ul className="mt-3 flex flex-col gap-3">
        {Array.from(groups.entries()).map(([code, rowSet]) => {
          const rows = Array.from(rowSet)
          return (
            <li
              key={code}
              className="flex flex-col gap-1.5"
              data-testid={`${testidPrefix}-${code}`}
            >
              <span className="font-medium">
                {tCheck(`issue.${code}` as Parameters<typeof tCheck>[0])}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <span>{tCheck("affectedRows", { count: rows.length })}</span>
                {rows.slice(0, MAX_LISTED_ROWS).map((row) => (
                  <Badge key={row} variant="outline" className="font-mono">
                    {row}
                  </Badge>
                ))}
                {rows.length > MAX_LISTED_ROWS && (
                  <span aria-hidden="true">…</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    )
  }

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
      {fieldsBlocked && (
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

      {/* Hard data-quality errors: these block the import. The file must be
          fixed and re-uploaded (row numbers match the file, header on row 1). */}
      {issuesBlocked && (
        <Alert variant="destructive" data-testid="issues-section">
          <AlertTitle>{tCheck("issuesHeading")}</AlertTitle>
          <AlertDescription>
            <p>{tCheck("issuesHelp")}</p>
            {renderIssueGroups(hardGroups, "issue-group")}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onReupload}
              data-testid="reupload-button"
            >
              {tCheck("reupload")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Per-row gender assignment for unresolvedGender rows; every flagged
          row must be assigned before the import can continue. */}
      {flaggedGenderRows.length > 0 && (
        <AssignGender
          flagged={flaggedGenderRows}
          value={genderOverrides}
          onChange={onGenderOverridesChange}
        />
      )}

      {/* Interpretation notices: values that were read successfully but with
          an assumption worth double-checking. Never blocking. */}
      {noticeGroups.size > 0 && (
        <Alert data-testid="notices-section">
          <AlertTitle>{tCheck("noticesHeading")}</AlertTitle>
          <AlertDescription>
            <p>{tCheck("noticesHelp")}</p>
            {renderIssueGroups(noticeGroups, "notice-group")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
