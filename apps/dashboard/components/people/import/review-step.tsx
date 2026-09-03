"use client"

import {
  ArrowRight01Icon,
  Coins01Icon,
  CoinsDollarIcon,
  Tick02Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserMinus01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { HOURLY_NOTICE_CODES } from "@workspace/constants"
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
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { toast } from "@/lib/toast"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { WizardFooter } from "@/components/wizard-footer"
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

// The change-summary stack's group/row shape: static i18n keys and icons only
// (the count is looked up separately), so it renders identically whether the
// dry-run preview is still loading or has landed.
const CHANGE_GROUPS = [
  {
    group: "employeesGroup",
    lines: [
      { key: "newPeople", icon: UserAdd01Icon },
      { key: "updatedPeople", icon: UserEdit01Icon },
      { key: "unchangedPeople", icon: UserCheck01Icon },
      { key: "returningPeople", icon: UserSwitchIcon },
      { key: "missingPeople", icon: UserMinus01Icon },
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
    people: {
      created: number
      updated: number
      unchanged: number
      returning: number
    }
    missingFromFile: readonly unknown[]
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
    case "returningPeople":
      return diff.people.returning
    case "missingPeople":
      return diff.missingFromFile.length
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

// A capped list of people named by number, for the returning and missing
// lists; the same Show-all reveal as the updated-people cards.
function PersonRefList({
  people,
  showAll,
  onShowAll,
  showAllLabel,
}: {
  people: ReadonlyArray<{ externalRef: string; displayName: string }>
  showAll: boolean
  onShowAll: () => void
  showAllLabel: string
}) {
  const shown = showAll ? people : people.slice(0, UPDATED_PEOPLE_SHOWN)
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-md border text-sm">
        {shown.map((person) => (
          <li
            key={person.externalRef}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <span className="font-medium">{person.displayName}</span>
            <span className="font-mono text-muted-foreground">
              {person.externalRef}
            </span>
          </li>
        ))}
      </ul>
      {!showAll && people.length > UPDATED_PEOPLE_SHOWN && (
        <button
          type="button"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          onClick={onShowAll}
        >
          {showAllLabel}
        </button>
      )}
    </div>
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
  const tHourly = useTranslations("dashboard.people.import.review.hourly")
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
  const tHelp = useTranslations("dashboard.help")
  // Leavers are archived only on an explicit tick (default off), so a partial
  // file can never archive the rest of the register by accident.
  const [archiveMissing, setArchiveMissing] = useState(false)
  const [showAllReturning, setShowAllReturning] = useState(false)
  const [showAllMissing, setShowAllMissing] = useState(false)
  const returningPeople = changePreview?.diff?.returningPeople ?? []
  const missingFromFile = changePreview?.diff?.missingFromFile ?? []
  // Whether an hourly-typed row's base-pay cell is read as an hourly rate
  // when no dedicated hourly-rate column is mapped; on by default. HR's
  // checkbox reruns the preview so what this step shows always matches what
  // confirm would do.
  const [interpretHourly, setInterpretHourly] = useState(true)
  // The interpretHourly value the currently-shown changePreview was actually
  // computed with. Only diverges from interpretHourly while a rerun is in
  // flight; if that rerun's request fails, interpretHourly is reverted to
  // this value so the checkbox never disagrees with the preview on screen.
  const [shownInterpretHourly, setShownInterpretHourly] = useState(true)
  const [showAllInterpreted, setShowAllInterpreted] = useState(false)
  const [showAllNotice, setShowAllNotice] = useState<Record<string, boolean>>(
    {}
  )
  const previewRanRef = useRef(false)
  // Whether a preview request is in flight (initial load or a toggle-
  // triggered rerun). Count cells show a skeleton on this OR changePreview
  // being null; the previous preview's rows and the hourly group itself stay
  // mounted throughout, so a rerun never unmounts something HR just clicked.
  const [previewLoading, setPreviewLoading] = useState(false)
  // Guards against an earlier request's response landing after a later one
  // (e.g. two checkbox toggles in quick succession): only the response whose
  // sequence number is still current is applied; a stale one is dropped.
  const previewSeqRef = useRef(0)

  // Runs the dry-run preview with the given hourly-interpretation choice.
  // Does NOT clear changePreview: the previous preview (and anything mounted
  // from it, notably the hourly-pay checkbox HR just toggled) stays on
  // screen, with count cells reverting to their skeleton via previewLoading,
  // until the new result lands. The checkbox handler calls this the same way
  // the mount effect does, so a toggle is just another preview run.
  function runPreview(interpret: boolean) {
    const seq = ++previewSeqRef.current
    // Captured now: whether there is already a landed preview to fall back
    // to if THIS request fails. A failed mount (no previous preview) keeps
    // today's behavior (the previewFailed message); a failed rerun keeps the
    // previous preview mounted instead of replacing it with that message.
    const hadPreviousPreview = changePreview !== null
    setPreviewLoading(true)
    const genderOverridePairs = Object.entries(genderOverrides)
    previewImport({
      orgId,
      csvText,
      columnMap,
      ...(genderOverridePairs.length > 0
        ? { genderOverrides: genderOverridePairs }
        : {}),
      ...(Object.keys(basisMap).length > 0 ? { basisMap } : {}),
      ...(interpret ? {} : { interpretHourly: false }),
    })
      .then((result) => {
        // A later toggle already superseded this request: drop it.
        if (previewSeqRef.current !== seq) return
        setChangePreview(result)
        setShownInterpretHourly(interpret)
        setPreviewFailed(false)
        setPreviewLoading(false)
      })
      .catch(() => {
        if (previewSeqRef.current !== seq) return
        setPreviewLoading(false)
        if (!hadPreviousPreview) {
          setPreviewFailed(true)
          return
        }
        // A failed rerun: keep the previous preview mounted (never null it,
        // never show the previewFailed message over it) and revert the
        // checkbox to the value that preview was actually computed with, so
        // it never disagrees with what is shown.
        setInterpretHourly(shownInterpretHourly)
        toast.error(tToast("error"))
      })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount
  useEffect(() => {
    if (previewRanRef.current) return
    previewRanRef.current = true
    runPreview(true)
  }, [])

  function handleInterpretChange(next: boolean) {
    setInterpretHourly(next)
    runPreview(next)
  }

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
        // Leavers archive only on the explicit tick; the arg is omitted
        // otherwise, like every other optional arg.
        ...(archiveMissing && missingFromFile.length > 0
          ? { archiveMissing: true }
          : {}),
        // Same toggle the preview used; omitted when on, like every other
        // default arg.
        ...(interpretHourly ? {} : { interpretHourly: false }),
      })
      if (result.ok) {
        // The done screen is the completion feedback (no toast needed).
        onImportSuccess({
          created: result.peopleCreated,
          updated: result.peopleUpdated,
          unchanged: result.peopleUnchanged,
          skipped: result.skippedRows,
          reactivated: result.peopleReactivated,
          archived: result.peopleArchived,
          hourlyPay: result.hourlyPay,
        })
      } else {
        // Required fields were not mapped: surface the blocking list.
        onImportEnd(result.validation.blocking)
      }
    } catch {
      toast.error(tToast("error"))
      onImportEnd()
    } finally {
      setIsSubmitting(false)
    }
  }

  const hourly = changePreview?.hourlyPay
  const ownHoursCount = changePreview?.ownHoursCount ?? 0
  // The group shows whenever there is something to say: rows read as hourly,
  // a soft notice, someone with their own hours, or the toggle switched off
  // (so an unchecked box never silently disappears).
  const showHourlyGroup =
    hourly !== undefined &&
    (hourly.total > 0 ||
      hourly.notices.length > 0 ||
      ownHoursCount > 0 ||
      !interpretHourly)

  // Notices for one code, in the fixed HOURLY_NOTICE_CODES order.
  function noticesByCode(code: (typeof HOURLY_NOTICE_CODES)[number]) {
    return hourly?.notices.filter((n) => n.code === code) ?? []
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
                One column: every group (Employees, Salaries) is a full-width
                block stacked under the last, so the step reads as one calm
                column rather than a grid. Headers, icons, and row labels are
                static i18n and always render for real; only the count is a
                skeleton while the dry-run preview loads, so loading and
                loaded read as the same layout. */}
            <div className="space-y-4">
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
                        {changePreview === null || previewLoading ? (
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

            {/* Which amounts are read as hourly pay, and the toggle to turn
                that reading off. Extends below the change-summary stack
                (never reflows it); the group (including the checkbox HR just
                clicked) stays mounted through a toggle-triggered rerun, with
                only its count cells reverting to a skeleton. */}
            {hourly !== undefined && showHourlyGroup && (
              <div data-testid="hourly-pay">
                <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                  {tHourly("heading")}
                </h4>
                <div className="divide-y rounded-md border">
                  <div className="space-y-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={CoinsDollarIcon}
                          strokeWidth={2}
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-sm">
                          {tHourly("interpreted", {
                            count: hourly.interpreted.length,
                          })}
                        </span>
                      </span>
                      {changePreview === null || previewLoading ? (
                        <Skeleton className="h-5 w-6" />
                      ) : (
                        <span className="font-medium font-mono text-sm">
                          {hourly.interpreted.length}
                        </span>
                      )}
                    </div>
                    {hourly.interpreted.length > 0 && (
                      <PersonRefList
                        people={hourly.interpreted}
                        showAll={showAllInterpreted}
                        onShowAll={() => setShowAllInterpreted(true)}
                        showAllLabel={tChanges("showAll", {
                          count: hourly.interpreted.length,
                        })}
                      />
                    )}
                    {/* htmlFor association, not a wrapping label (a wrapping
                        label toggles twice). */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="import-interpret-hourly"
                        checked={interpretHourly}
                        onCheckedChange={(checked) =>
                          handleInterpretChange(checked === true)
                        }
                      />
                      <Label
                        htmlFor="import-interpret-hourly"
                        className="font-medium"
                      >
                        {tHourly("interpretToggle")}
                      </Label>
                    </div>
                  </div>
                  {ownHoursCount > 0 && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm">
                        {tHourly("ownHours", { count: ownHoursCount })}
                      </span>
                      {changePreview === null || previewLoading ? (
                        <Skeleton className="h-5 w-6" />
                      ) : (
                        <span className="font-medium font-mono text-sm">
                          {ownHoursCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {hourly.notices.length > 0 && (
                  <Alert className="mt-3" data-testid="hourly-notices">
                    <AlertTitle>{tHourly("noticesTitle")}</AlertTitle>
                    <AlertDescription>
                      {/* One block per notice code present, in a fixed code
                          order. */}
                      {HOURLY_NOTICE_CODES.filter(
                        (code) => noticesByCode(code).length > 0
                      ).map((code) => (
                        <div key={code} className="mt-2">
                          <p>
                            {tHourly(`notice.${code}`, {
                              count: noticesByCode(code).length,
                            })}
                          </p>
                          <PersonRefList
                            people={noticesByCode(code).map((n) => n.ref)}
                            showAll={showAllNotice[code] === true}
                            onShowAll={() =>
                              setShowAllNotice((prev) => ({
                                ...prev,
                                [code]: true,
                              }))
                            }
                            showAllLabel={tChanges("showAll", {
                              count: noticesByCode(code).length,
                            })}
                          />
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Who changes, field by field, so updating is a knowing act.
                Only once the preview has landed (extends below the summary
                stack rather than shifting it). */}
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

            {/* Archived people the file brings back. Once the preview has
                landed (extends below rather than shifting what is already
                shown), and only when there is at least one. */}
            {changePreview !== null &&
              changePreview.diff !== null &&
              returningPeople.length > 0 && (
                <div data-testid="returning-people">
                  <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                    {tChanges("returningPeople")}
                  </h4>
                  <PersonRefList
                    people={returningPeople}
                    showAll={showAllReturning}
                    onShowAll={() => setShowAllReturning(true)}
                    showAllLabel={tChanges("showAll", {
                      count: returningPeople.length,
                    })}
                  />
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
        <Alert className={WARNING_ALERT_CLASS} data-testid="name-mismatch">
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

      {/* Active people the file does not mention. Archiving is an explicit,
          reversible choice (default off): a partial file must never archive
          the rest of the register. Same amber tone as the mismatch guard. */}
      {missingFromFile.length > 0 && (
        <Alert className={WARNING_ALERT_CLASS} data-testid="missing-people">
          <div className="flex items-center gap-1.5">
            <AlertTitle>{tChanges("missingTitle")}</AlertTitle>
            <HelpMorphButton label={tHelp("archivedPersonLabel")}>
              {tHelp("archivedPersonBody")}
            </HelpMorphButton>
          </div>
          <AlertDescription>
            <p>{tChanges("missingBody")}</p>
            <div className="mt-2">
              <PersonRefList
                people={missingFromFile}
                showAll={showAllMissing}
                onShowAll={() => setShowAllMissing(true)}
                showAllLabel={tChanges("showAll", {
                  count: missingFromFile.length,
                })}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id="import-archive-missing"
                checked={archiveMissing}
                onCheckedChange={(checked) =>
                  setArchiveMissing(checked === true)
                }
              />
              <Label htmlFor="import-archive-missing" className="font-medium">
                {tChanges("archiveMissing", { count: missingFromFile.length })}
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
          // Also waits out a toggle-triggered rerun, so HR can never confirm
          // against a preview that is mid-replacement.
          disabled={
            (changePreview === null && !previewFailed) || previewLoading
          }
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
