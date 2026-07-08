"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type CanonicalFieldKey,
  classifyColumn,
  parseCurrency,
  parseGender,
  parseMoney,
  parsePercent,
} from "@workspace/import"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import type { FunctionReturnType } from "convex/server"
import { useAction } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { SubmitButton } from "@/components/submit-button"
import type { ImportResultCounts, ParsedCsv } from "./import-wizard"

// Maximum number of rows to show in the preview table.
const PREVIEW_ROW_COUNT = 10

// Maximum updated-people diff cards shown before "and N more".
const UPDATED_PEOPLE_SHOWN = 6

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the columnMap array-of-pairs required by importPayroll.
 * Shape: Array<[sourceHeader: string, canonicalKey: string]>
 * Only includes entries that map to a valid column index.
 */
export function buildColumnMap(
  mapping: Record<string, number>,
  headers: string[]
): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const [canonicalKey, columnIndex] of Object.entries(mapping)) {
    if (
      columnIndex !== undefined &&
      columnIndex >= 0 &&
      columnIndex < headers.length
    ) {
      const header = headers[columnIndex]
      if (header !== undefined) {
        pairs.push([header, canonicalKey])
      }
    }
  }
  return pairs
}

// A single normalized preview row.
interface PreviewRow {
  displayName: string
  basicMonthly: number | null
  currency: string | null
  ftePercent: number | null
  gender: string | null
}

/**
 * Normalize up to PREVIEW_ROW_COUNT data rows using the parsers from
 * @workspace/import so the preview shows the same values the backend will
 * actually import.
 */
function buildPreviewRows(
  parsed: ParsedCsv,
  mapping: Record<string, number>
): PreviewRow[] {
  const col = (key: CanonicalFieldKey): number | undefined => {
    const idx = mapping[key]
    return idx !== undefined && idx >= 0 && idx < parsed.headers.length
      ? idx
      : undefined
  }

  const firstNameCol = col("firstName")
  const lastNameCol = col("lastName")
  const externalRefCol = col("externalRef")
  const basicMonthlyCol = col("basicMonthly")
  const currencyCol = col("currency")
  const ftePercentCol = col("ftePercent")
  const genderCol = col("gender")

  // Determine once whether the FTE column is fractional (values <= 1.0). The
  // backend classifies the whole column and scales x100; mirror that here so the
  // preview value matches the imported value (classifyColumn over ALL rows, not
  // just the previewed slice, so the fraction verdict is the column's, not the
  // preview window's).
  const fteIsFraction =
    ftePercentCol !== undefined &&
    classifyColumn(parsed.rows.map((r) => r[ftePercentCol] ?? "")).fraction ===
      true

  const rows = parsed.rows.slice(0, PREVIEW_ROW_COUNT)

  return rows.map((row) => {
    const cell = (colIdx: number | undefined): string =>
      colIdx !== undefined ? (row[colIdx] ?? "").trim() : ""

    const firstName = cell(firstNameCol)
    const lastName = cell(lastNameCol)
    const externalRef = cell(externalRefCol)
    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") || externalRef

    const basicMonthlyRaw = cell(basicMonthlyCol)
    const basicMonthly = basicMonthlyRaw ? parseMoney(basicMonthlyRaw) : null

    const currencyRaw = cell(currencyCol)
    const currency = currencyRaw ? parseCurrency(currencyRaw) : null

    const ftePercentRaw = cell(ftePercentCol)
    const ftePercent = ftePercentRaw
      ? parsePercent(ftePercentRaw, { fraction: fteIsFraction })
      : null

    const genderRaw = cell(genderCol)
    const gender = genderRaw ? parseGender(genderRaw) : null

    return { displayName, basicMonthly, currency, ftePercent, gender }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ReviewStepProps {
  parsed: ParsedCsv
  mapping: Record<string, number>
  csvText: string
  /** Per-row manual gender assignments, keyed by trimmed externalRef. */
  genderOverrides: Record<string, "Man" | "Kvinna">
  /** Step back to the check step (the review owns its footer actions). */
  onBack: () => void
  /**
   * The import has started: the wizard shows the importing screen. The
   * importId identifies this run in the importProgress table so the screen
   * never picks up a stale row from an earlier run.
   */
  onImportStart: (importId: string) => void
  /**
   * The import ended in failure: the wizard returns to this step.
   * `blocking` carries the required-field keys when the backend rejected
   * the import (should not happen if the check step gated correctly);
   * undefined for a generic failure.
   */
  onImportEnd: (blocking?: string[]) => void
  /** The import succeeded: the wizard shows the done screen with counts. */
  onImportSuccess: (result: ImportResultCounts) => void
  /** Blocking keys from the last failed import attempt (wizard-held). */
  blockingError: string[] | null
}

export function ReviewStep({
  parsed,
  mapping,
  csvText,
  genderOverrides,
  onBack,
  onImportStart,
  onImportEnd,
  onImportSuccess,
  blockingError,
}: ReviewStepProps) {
  const t = useTranslations("dashboard.people.import.review")
  const tImport = useTranslations("dashboard.people.import")
  const tFields = useTranslations("dashboard.people.import.fields")
  const tGender = useTranslations("dashboard.people.import.gender")
  const tChanges = useTranslations("dashboard.people.import.review.changes")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()

  // The diff names person fields by their stored keys; displayName is the
  // one field with no canonical import-field label of its own.
  function fieldChangeLabel(field: string): string {
    if (field === "displayName") return tChanges("displayName")
    return tFields(field as Parameters<typeof tFields>[0])
  }

  const importPayroll = useAction(api.people.import.importPayroll)
  const previewImport = useAction(api.people.import.previewImport)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const previewRows = buildPreviewRows(parsed, mapping)
  const columnMap = buildColumnMap(mapping, parsed.headers)

  // The dry-run change preview: the SAME pipeline the import runs, diffed
  // against the stored data server-side, so what this step shows is what the
  // import will do. Fetched once on mount (an action, not a reactive query);
  // the ref guards StrictMode's double-invoked mount effect.
  const [changePreview, setChangePreview] = useState<FunctionReturnType<
    typeof api.people.import.previewImport
  > | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  // Rows flagged as name mismatches are skipped unless HR opts in.
  const [updateMismatchedAnyway, setUpdateMismatchedAnyway] = useState(false)
  const previewRanRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount
  useEffect(() => {
    if (previewRanRef.current) return
    previewRanRef.current = true
    const genderOverridePairs = Object.entries(genderOverrides)
    previewImport({
      orgId,
      csvText,
      columnMap,
      ...(genderOverridePairs.length > 0
        ? { genderOverrides: genderOverridePairs }
        : {}),
    })
      .then(setChangePreview)
      .catch(() => setPreviewFailed(true))
  }, [])

  const nameMismatches = changePreview?.diff?.nameMismatches ?? []
  const skippedMismatchRefs =
    !updateMismatchedAnyway && nameMismatches.length > 0
      ? nameMismatches.map((m) => m.externalRef)
      : []

  async function handleConfirm() {
    setIsSubmitting(true)
    const importId = crypto.randomUUID()
    onImportStart(importId)
    try {
      // Convert the ergonomic record to the Convex array-of-pairs Plan D expects.
      // Omit the arg entirely when there is nothing to override.
      const genderOverridePairs = Object.entries(genderOverrides) as Array<
        [string, "Man" | "Kvinna"]
      >
      const result = await importPayroll({
        orgId,
        csvText,
        columnMap,
        importId,
        ...(genderOverridePairs.length > 0
          ? { genderOverrides: genderOverridePairs }
          : {}),
        // Name-mismatched rows stay out unless HR ticked the override.
        ...(skippedMismatchRefs.length > 0
          ? { skipExternalRefs: skippedMismatchRefs }
          : {}),
      })
      if (result.ok) {
        // The done screen is the completion feedback (no toast needed).
        onImportSuccess({
          created: result.peopleCreated,
          updated: result.peopleUpdated,
          unchanged: result.peopleUnchanged,
          skipped: result.skippedRows,
        })
      } else {
        // Required fields were not mapped — surface the blocking list.
        onImportEnd(result.validation.blocking)
      }
    } catch {
      toast.error(tToast("error"))
      onImportEnd()
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewCount = Math.min(PREVIEW_ROW_COUNT, parsed.rows.length)

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Unexpected blocking error from the action */}
      {blockingError !== null && blockingError.length > 0 && (
        <Alert variant="destructive" data-testid="blocking-error">
          <AlertTitle>{t("blockingTitle")}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {blockingError.map((key) => (
                <li key={key}>
                  {tFields(key as Parameters<typeof tFields>[0])}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* What the import will actually do, from the server-side dry run. */}
      <div data-testid="import-changes">
        <h3 className="mb-3 font-medium text-sm">{tChanges("heading")}</h3>
        {previewFailed ? (
          <p className="text-muted-foreground text-sm">
            {tChanges("previewFailed")}
          </p>
        ) : changePreview === null ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-5 w-60" />
          </div>
        ) : changePreview.diff === null ? null : (
          <div className="space-y-4">
            <ul className="max-w-sm space-y-1 text-sm">
              {(
                [
                  ["newPeople", changePreview.diff.people.created],
                  ["updatedPeople", changePreview.diff.people.updated],
                  ["unchangedPeople", changePreview.diff.people.unchanged],
                  ["salaryNew", changePreview.diff.salary.newEntries],
                  ["salaryChanged", changePreview.diff.salary.changedSameYear],
                  ["salaryIdentical", changePreview.diff.salary.identical],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <li
                    key={key}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="text-muted-foreground">
                      {tChanges(key)}
                    </span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>

            {/* Who changes, field by field, so updating is a knowing act. */}
            {changePreview.diff.updatedPeople.length > 0 && (
              <div className="space-y-2" data-testid="updated-people">
                {changePreview.diff.updatedPeople
                  .slice(0, UPDATED_PEOPLE_SHOWN)
                  .map((person) => (
                    <div
                      key={person.externalRef}
                      className="rounded-md border px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{person.displayName}</p>
                      <p className="text-muted-foreground">
                        {person.changes.map((change, index) => (
                          <span key={change.field}>
                            {index > 0 && " · "}
                            {fieldChangeLabel(change.field)}:{" "}
                            {change.from !== "" && (
                              <>
                                {change.from}
                                {" → "}
                              </>
                            )}
                            {change.to}
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                {changePreview.diff.updatedPeople.length >
                  UPDATED_PEOPLE_SHOWN && (
                  <p className="text-muted-foreground text-sm">
                    {tChanges("andMore", {
                      count:
                        changePreview.diff.updatedPeople.length -
                        UPDATED_PEOPLE_SHOWN,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Same employee number, different name: likely a reused number or a
          typo. These rows stay OUT of the import unless HR opts in. Alert has
          no warning variant; the amber tint is the call-site override used
          across the app. */}
      {nameMismatches.length > 0 && (
        <Alert
          className="border-amber-500/50 text-amber-700 dark:text-amber-400"
          data-testid="name-mismatch"
        >
          <AlertTitle>{tChanges("mismatchTitle")}</AlertTitle>
          <AlertDescription>
            <p>{tChanges("mismatchBody")}</p>
            <ul className="mt-2 space-y-1">
              {nameMismatches.map((mismatch) => (
                <li key={mismatch.externalRef} className="font-medium">
                  {mismatch.externalRef}: {mismatch.storedName}
                  {" → "}
                  {mismatch.incomingName}
                </li>
              ))}
            </ul>
            {/* htmlFor association (not a wrapping label): a label around the
                checkbox re-dispatches the click and toggles it twice. */}
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id="import-mismatched-anyway"
                checked={updateMismatchedAnyway}
                onCheckedChange={(checked) =>
                  setUpdateMismatchedAnyway(checked === true)
                }
              />
              <Label htmlFor="import-mismatched-anyway" className="font-medium">
                {tChanges("mismatchImportAnyway")}
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview table. The heading row carries the total count on the right
          (no flagged count: the check step forces every actionable issue to
          be resolved before this step is reachable). */}
      <div data-testid="preview-table">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-sm">
            {t("preview", { count: previewCount })}
          </h3>
          <p className="text-muted-foreground text-sm" data-testid="summary">
            {t("summary", { people: parsed.rows.length })}
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tFields("firstName")}</TableHead>
                <TableHead>{tFields("basicMonthly")}</TableHead>
                <TableHead>{tFields("currency")}</TableHead>
                <TableHead>{tFields("ftePercent")}</TableHead>
                <TableHead>{tFields("gender")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: preview rows have no stable id; row index is the correct key here
                <TableRow key={idx} data-testid={`preview-row-${idx}`}>
                  <TableCell className="font-medium">
                    {row.displayName}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.basicMonthly !== null
                      ? row.basicMonthly.toLocaleString("sv-SE")
                      : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.currency ?? ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.ftePercent !== null ? `${row.ftePercent}%` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.gender != null
                      ? tGender(row.gender as Parameters<typeof tGender>[0])
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer: back + confirm, matching the other steps' action row */}
      <WizardFooter>
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          {tImport("back")}
        </Button>
        <SubmitButton
          isSubmitting={isSubmitting}
          // The confirm waits for the change preview (it defines the
          // mismatch skip list); a failed preview does not block importing.
          disabled={changePreview === null && !previewFailed}
          onClick={handleConfirm}
          data-testid="confirm-button"
        >
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
          {t("confirm")}
        </SubmitButton>
      </WizardFooter>
    </div>
  )
}
