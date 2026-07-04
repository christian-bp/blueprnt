"use client"

import {
  CANONICAL_FIELDS,
  type CanonicalFieldKey,
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
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef } from "react"
import type { ParsedCsv } from "./import-wizard"
import { AssignGender } from "./assign-gender"

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
}

export function CheckStep({
  parsed,
  mapping,
  csvText,
  genderOverrides,
  onGenderOverridesChange,
  onValidated,
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

  // Group issues by code so we can show one entry per code with a count.
  const issueGroups = useMemo(() => {
    const groups = new Map<RowIssueCode, { count: number; rows: number[] }>()
    for (const issue of validation.issues) {
      const existing = groups.get(issue.code)
      if (existing) {
        existing.count += 1
        existing.rows.push(issue.row + 1) // 1-based for display
      } else {
        groups.set(issue.code, { count: 1, rows: [issue.row + 1] })
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

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Blocking alert — required fields not mapped */}
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

      {/* Ready indicator — shown when no blocking fields */}
      {!isBlocking && (
        <p
          data-testid="ready-indicator"
          className="font-medium text-green-700 text-sm dark:text-green-400"
        >
          {tCheck("ready")}
        </p>
      )}

      {/* Readiness checklist — one row per canonical field */}
      <div className="flex flex-col gap-2">
        {validation.readiness.map((entry) => {
          const fieldLabel = tFields(entry.key as Parameters<typeof tFields>[0])
          const tierLabel = tTier(entry.tier)

          let statusIcon: string
          let statusClass: string
          if (entry.mapped) {
            statusIcon = "✓"
            statusClass = "text-green-700 dark:text-green-400"
          } else if (entry.tier === "required") {
            statusIcon = "✗"
            statusClass = "text-destructive"
          } else {
            statusIcon = "–"
            statusClass = "text-muted-foreground"
          }

          return (
            <div
              key={entry.key}
              className="flex items-center justify-between gap-2"
              data-testid={`readiness-row-${entry.key}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 text-center font-bold text-sm ${statusClass}`}
                  aria-hidden="true"
                >
                  {statusIcon}
                </span>
                <span className="text-sm">{fieldLabel}</span>
              </div>
              <Badge
                variant={
                  entry.tier === "required"
                    ? "destructive"
                    : entry.tier === "recommended"
                      ? "secondary"
                      : "outline"
                }
              >
                {tierLabel}
              </Badge>
            </div>
          )
        })}
      </div>

      {/* Warnings section — recommended fields not mapped */}
      {validation.warnings.length > 0 && (
        <Alert data-testid="warnings-section">
          <AlertTitle>{tCheck("warnings")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4">
              {validation.warnings.map((key) => (
                <li key={key}>
                  {tFields(key as Parameters<typeof tFields>[0])}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Data-quality issues section */}
      {issueGroups.size > 0 && (
        <div data-testid="issues-section">
          <h3 className="mb-3 font-medium text-sm">
            {tCheck("issuesHeading")}
          </h3>
          <div className="flex flex-col gap-2">
            {Array.from(issueGroups.entries()).map(
              ([code, { count, rows }]) => (
                <div
                  key={code}
                  className="flex flex-col gap-0.5 rounded-md border px-3 py-2"
                  data-testid={`issue-group-${code}`}
                >
                  <span className="font-medium text-sm">
                    {tCheck(`issue.${code}` as Parameters<typeof tCheck>[0])}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {tCheck("rowsAffected", { count })}{" "}
                    <span className="font-mono">({rows.join(", ")})</span>
                  </span>
                </div>
              )
            )}
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
