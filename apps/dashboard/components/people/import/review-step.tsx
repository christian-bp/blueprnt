"use client"

import {
  ArrowRight01Icon,
  Coins01Icon,
  CoinsDollarIcon,
  Tick02Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PayBasis } from "@workspace/import"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { FunctionReturnType } from "convex/server"
import { useAction } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { SubmitButton } from "@/components/submit-button"
import type { ImportResultCounts, ParsedCsv } from "./import-wizard"

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

// The change-summary grid's group/row shape: static i18n keys and icons only
// (the count is looked up separately), so it renders identically whether the
// dry-run preview is still loading or has landed.
const CHANGE_GROUPS = [
  {
    group: "employeesGroup",
    lines: [
      { key: "newPeople", icon: UserAdd01Icon },
      { key: "updatedPeople", icon: UserEdit01Icon },
      { key: "unchangedPeople", icon: UserCheck01Icon },
    ],
  },
  {
    group: "salariesGroup",
    lines: [
      { key: "salaryNew", icon: Coins01Icon },
      { key: "salaryChanged", icon: CoinsDollarIcon },
      { key: "salaryIdentical", icon: Tick02Icon },
    ],
  },
] as const

// Looks up the count for a change-summary row by its static key. Structurally
// typed (not imported from the backend) so this stays a plain view helper.
function countForKey(
  diff: {
    people: { created: number; updated: number; unchanged: number }
    salary: {
      newEntries: number
      changedSameYear: number
      identical: number
    }
  },
  key: string
): number | undefined {
  switch (key) {
    case "newPeople":
      return diff.people.created
    case "updatedPeople":
      return diff.people.updated
    case "unchangedPeople":
      return diff.people.unchanged
    case "salaryNew":
      return diff.salary.newEntries
    case "salaryChanged":
      return diff.salary.changedSameYear
    case "salaryIdentical":
      return diff.salary.identical
    default:
      return undefined
  }
}

// A stored value becoming an incoming value, joined by an arrow icon (never
// a bare text arrow); `from` may be absent when a field is newly set.
function FromTo({ from, to }: { from?: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {from !== undefined && from !== "" && (
        <>
          <span>{from}</span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground/70"
          />
        </>
      )}
      <span>{to}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ReviewStepProps {
  parsed: ParsedCsv
  mapping: Record<string, number>
  csvText: string
  /** Monthly/annual basis per mapped money field key, from the Map step. */
  basisMap: Record<string, PayBasis>
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
  basisMap,
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
  // The updated-people list starts capped; Show all reveals the rest.
  const [showAllUpdated, setShowAllUpdated] = useState(false)
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
      ...(Object.keys(basisMap).length > 0 ? { basisMap } : {}),
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
        ...(Object.keys(basisMap).length > 0 ? { basisMap } : {}),
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
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-sm">{tChanges("heading")}</h3>
          <p className="text-muted-foreground text-sm" data-testid="summary">
            {t("summary", { people: parsed.rows.length })}
          </p>
        </div>
        {previewFailed ? (
          <p className="text-muted-foreground text-sm">
            {tChanges("previewFailed")}
          </p>
        ) : changePreview?.diff === null ? null : (
          <div className="space-y-4">
            {/* Grouped icon rows, the done screen's visual language, so the
                before (this preview) and after (the result) read the same.
                Headers, icons, and row labels are static i18n and always
                render for real; only the count is a skeleton while the
                dry-run preview loads, so loading and loaded read as the
                same layout. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {CHANGE_GROUPS.map(({ group, lines }) => (
                <div key={group}>
                  <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                    {tChanges(group)}
                  </h4>
                  <div className="divide-y rounded-md border">
                    {lines.map(({ key, icon }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="flex items-center gap-2">
                          <HugeiconsIcon
                            icon={icon}
                            strokeWidth={2}
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="text-sm">{tChanges(key)}</span>
                        </span>
                        {changePreview === null ? (
                          <Skeleton className="h-5 w-6" />
                        ) : (
                          <span className="font-medium font-mono text-sm">
                            {changePreview.diff &&
                              countForKey(changePreview.diff, key)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Who changes, field by field, so updating is a knowing act.
                Only once the preview has landed (extends below the summary
                grid rather than shifting it). */}
            {changePreview !== null &&
              changePreview.diff !== null &&
              changePreview.diff.updatedPeople.length > 0 && (
                <div className="space-y-2" data-testid="updated-people">
                  {(showAllUpdated
                    ? changePreview.diff.updatedPeople
                    : changePreview.diff.updatedPeople.slice(
                        0,
                        UPDATED_PEOPLE_SHOWN
                      )
                  ).map((person) => (
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
                            <FromTo from={change.from} to={change.to} />
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                  {!showAllUpdated &&
                    changePreview.diff.updatedPeople.length >
                      UPDATED_PEOPLE_SHOWN && (
                      <button
                        type="button"
                        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                        onClick={() => setShowAllUpdated(true)}
                      >
                        {tChanges("showAll", {
                          count: changePreview.diff.updatedPeople.length,
                        })}
                      </button>
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
                  {mismatch.externalRef}:{" "}
                  <FromTo
                    from={mismatch.storedName}
                    to={mismatch.incomingName}
                  />
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
