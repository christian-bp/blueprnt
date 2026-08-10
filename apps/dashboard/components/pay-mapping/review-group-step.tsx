"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import { flagWomenBehind, type PayGapFlag } from "@workspace/core"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { useOrganization } from "@/components/org-context"
import { ScreenShell } from "@/components/screen-shell"
import { Badge } from "@workspace/ui/components/badge"
import { GenderDotIcon } from "@/components/gender-mark"
import { LevelBadge } from "@/components/level-badge"
import { SeniorityBadge } from "@/components/track-badge"
import {
  type GapGroup,
  type GroupAnalysis,
  groupLabel,
  type ActionTargetWire,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
  type WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"
import {
  type PayMappingGroupAnalysisFormHandle,
  PayMappingGroupAnalysisForm,
} from "./pay-mapping-group-analysis-form"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import { ComparatorTable } from "./comparator-table"
import { EqualWorkDetail } from "./equal-work-detail"
import { WomenDominatedScatter } from "./women-dominated-underlying-data"
import { ReviewStepActions } from "./review-step-actions"

// Distinguishes the one reachable backend rejection from this step (marking
// done without documentation) from transient failures, so the toast can name
// the real problem. Same instanceof-ConvexError + data.code idiom as
// PayMappingGroupAnalysisForm's own isDocumentationRequiredError. Not
// expected to actually fire in the normal flow (the primary button is
// already gated on `documented`), a belt-and-braces fallback for a desync
// (e.g. a concurrent edit from another tab) exactly like the form/praxis step.
function isDocumentationRequiredError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingDocumentationRequired"
  )
}

// The equal-work finding sentence's variant key + raw interpolation numbers.
// Every group that reaches this step passed the ADR-0015 entry conditions
// (both genders, women trailing on the primary metric), so the variants
// reduce to "less" (base salary), "lessTcc" (a tccDriven group's finding
// lives in total comp), "lessTccWorse" (admitted on the base gap, but the
// TCC gap is what sets the group's severest-of-two flag: the sentence must
// name the metric behind the flag, or a red badge sits next to a sentence
// about a smaller gap), and a defensive "none" for a gapless edge. A pure
// data-selector, deliberately never touching next-intl's own
// translate-function type: threading THAT type through an explicit
// parameter elsewhere in this file triggered a real "Type instantiation is
// excessively deep" compiler error (it is a deeply generic overload set
// keyed to the whole message JSON, meant to be called in place, not passed
// around). The gaps are left as raw signed percents (not yet formatted, and
// not yet abs'd): the render site turns them into the ICU string via its own
// percentText, right where it calls the real, precisely-typed tFinding.
const FLAG_RANK: Record<PayGapFlag, number> = {
  critical: 3,
  elevated: 2,
  ok: 1,
  insufficient: 0,
}

function equalWorkFindingVariant(group: GapGroup): {
  key: "none" | "less" | "lessTcc" | "lessTccWorse"
  women: number
  men: number
  gapPct: number | null
  tccGapPct: number | null
} {
  const { womenCount: women, menCount: men } = group
  const { gapPct } = primaryGapMetric(group)
  const tccGapPct = group.tcc.gapPct
  if (gapPct === null || gapPct <= 0)
    return { key: "none", women, men, gapPct, tccGapPct }
  if (group.tccDriven) return { key: "lessTcc", women, men, gapPct, tccGapPct }
  const tccSetsFlag =
    FLAG_RANK[flagWomenBehind(women, men, group.tcc.gapPct)] >
    FLAG_RANK[flagWomenBehind(women, men, group.base.gapPct)]
  return {
    key: tccSetsFlag ? "lessTccWorse" : "less",
    women,
    men,
    gapPct,
    tccGapPct,
  }
}

interface ReviewGroupStepCommonProps {
  analysis: GroupAnalysis | undefined
  runId: Id<"payMappingRuns">
  locked: boolean
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
  requiresDocumentation: boolean
  // The run's action/note work layer, threaded from the surface's own
  // shell-context read (like rows/currency above), so this step stays a
  // presentational component with no subscription of its own.
  actions: PayMappingActionWire[] | undefined
  notes: PayMappingNoteWire[] | undefined
  // Threaded from the surface: the wizard reveals the heading/content (true),
  // the summary's master-detail pane swaps instantly (false). See ScreenShell.
  animated: boolean
  // Threaded from the surface the same way `animated` is: the wizard mounts
  // at the top of its own page (h1, the default), the summary's pane sits
  // under the page's h2 and the summary's own h3 (h4). See ScreenShell.
  headingLevel?: "h1" | "h4"
  onNext: () => void
  onPrevious?: () => void
  onSkip?: () => void
}

type ReviewGroupStepProps =
  | ({ scope: "equalWork"; group: GapGroup } & ReviewGroupStepCommonProps)
  | ({
      scope: "equivalentWork"
      group: WomenDominatedGroupWire
      // The full equivalent-work level list: WomenDominatedUnderlyingData
      // needs it (to find the group's own level's women-men gap for its
      // level-context sentence). The shell holds the run's whole gap result
      // and passes gap.equivalentWork through unchanged.
      equivalentWork: GapGroup[]
    } & ReviewGroupStepCommonProps)

// The wizard's documentation step for one equalWork (equal-work) or
// equivalentWork (women-dominated cross-level comparison) group
// (ADR-0012). Composes, in order: the group's heading (label +
// severity/level chips), the plain-language finding sentence(s) that
// restate the group's own numbers so the reader never has to translate a
// raw percentage into a judgment, the EqualWorkDetail view (equalWork only:
// summary strip, scatter, member table; Iteration 2 note 3),
// PayMappingGroupAnalysisForm (the reasons/note documentation surface), the
// WomenDominatedUnderlyingData disclosure (equivalentWork only: the cross-level
// comparison tables/scatter), and the shared ReviewStepActions row.
//
// Klarmarkerad ownership split (mirrors the form's own doc comment): the
// FORM owns saving reasons/note on every edit (autosave, silent). THIS step
// owns the `done` transition itself: its primary button is the only thing
// that sends `done: true` (gated on `requiresDocumentation && !documented`,
// where `documented` is the form's own latest report via
// `onDocumentationChange`), and its own "Ångra klarmarkering" button is the
// only thing that sends `done: false` outside of an edit-triggered reopen.
// `done` (this step's local mirror of `analysis?.done`) and `doc` (this
// step's local mirror of the form's live {reasons, note, documented}) are
// two independent pieces of state: `done` drives whether the undo button and
// the "already done" framing show; `doc` is what the primary/undo buttons
// send when clicked, since the form's own live edit can be ahead of
// whatever `analysis` last echoed back from the subscription.
//
// THE ADJUDICATED REOPEN PATTERN (also documented in
// pay-mapping-group-analysis-form.tsx, where it is actually implemented):
// editing documentation on an ALREADY DONE, REQUIRING group invalidates that
// sealed adjudication, so the form's own autosave (not this step) proactively
// sends `done: false` + a "reopened" toast instead of letting the backend
// reject a stale `done: true` save. This step never duplicates that save: it
// only ever sends `done: true` (its own primary) or `done: false` (its own
// undo), both from an explicit click. It learns about a reopen exactly the
// way it learns about the initial `done` value: `analysis.done` round-trips
// through the Convex subscription and this step's own sync effect below
// picks it up, exactly like the undo path itself.
export function ReviewGroupStep(props: ReviewGroupStepProps) {
  const {
    analysis,
    runId,
    locked,
    rows,
    currency,
    referenceDateMs,
    requiresDocumentation,
    actions,
    notes,
    animated,
    headingLevel = "h1",
    onNext,
    onPrevious,
    onSkip,
  } = props

  const t = useTranslations("dashboard.payMapping.review")
  const tFinding = useTranslations("dashboard.payMapping.review.finding")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const format = useFormatter()
  const { orgId } = useOrganization()
  const upsertGroupAnalysis = useMutation(
    api.payMapping.analyses.upsertGroupAnalysis
  )

  const initialReasons = analysis?.reasons ?? []
  const initialNote = analysis?.note ?? ""
  const [doc, setDoc] = useState<{
    reasons: PayGapReason[]
    note: string
    documented: boolean
  }>(() => ({
    reasons: initialReasons,
    note: initialNote,
    documented: initialReasons.length > 0 || initialNote.trim() !== "",
  }))
  const [done, setDone] = useState(() => analysis?.done ?? false)
  // The embedded form's imperative handle, used ONLY by handleMarkDone below
  // to flush its pending note-debounce timer before this step's own
  // done:true upsert (see the handle's own doc comment in
  // pay-mapping-group-analysis-form.tsx).
  const formRef = useRef<PayMappingGroupAnalysisFormHandle>(null)

  // Re-syncs from the subscription whenever the row's own `done` value
  // changes (the initial load, this step's own mark-done/undo round-tripping
  // back, or the form's own reopen save round-tripping back): never on the
  // analysis object's identity, which is a fresh reference every render.
  // `doc` needs no equivalent effect here: the embedded form already
  // performs this exact re-sync for reasons/note (with its focus/dirty
  // guards for the note) and reports every change via onDocumentationChange,
  // which fires again whenever ITS sync effect updates local state.
  const analysisDone = analysis?.done ?? false
  useEffect(() => {
    setDone(analysisDone)
  }, [analysisDone])

  const percentText = (pct: number) =>
    format.number(pct / 100, { style: "percent", maximumFractionDigits: 1 })

  async function save(next: {
    reasons: PayGapReason[]
    note: string
    done: boolean
  }) {
    const trimmed = next.note.trim()
    await upsertGroupAnalysis({
      orgId,
      runId,
      scope: props.scope,
      groupKey: props.group.key,
      reasons: next.reasons,
      ...(trimmed === "" ? {} : { note: trimmed }),
      done: next.done,
    })
  }

  function showSaveError(error: unknown) {
    toast.error(
      isDocumentationRequiredError(error)
        ? tErrors("payMappingDocumentationRequired")
        : tToast("error")
    )
  }

  async function handleMarkDone() {
    if (locked || blocked) return
    // Cancels the form's own pending note-debounce timer (if any), so it
    // never fires its own redundant (and, worse, stale-`done`-carrying) save
    // after this upsert already commits done:true with the CURRENT note
    // (doc.note, kept live by onDocumentationChange on every keystroke).
    formRef.current?.flushPendingNoteSave()
    try {
      await save({ reasons: doc.reasons, note: doc.note, done: true })
      setDone(true)
      onNext()
    } catch (error) {
      showSaveError(error)
    }
  }

  async function handleUndo() {
    if (locked) return
    try {
      await save({ reasons: doc.reasons, note: doc.note, done: false })
      setDone(false)
      toast.success(tToast("payMappingGroupReopened"))
    } catch (error) {
      showSaveError(error)
    }
  }

  // The full "roleTitle · seniority" label, still used by the
  // women-dominated finding sentence; the heading itself shows the title
  // with the seniority as a badge beside it.
  const label = groupLabel(props.group)
  // The same "still validly done" condition the form uses to decide whether
  // an edit reopens it (see pay-mapping-group-analysis-form.tsx's own
  // handleReasonToggle/saveNote doc comment): once a requiring group's
  // documentation empties out, it can no longer be considered done, so the
  // undo button hides in the SAME render as the edit (no need to wait on the
  // subscription round-trip the form's reopen save triggers), and the
  // primary "mark done" action is gated on the identical condition.
  const blocked = requiresDocumentation && !doc.documented

  // Which comparator row the reader is pointing at, shared by the table
  // and the plot beneath it.
  const [selectedComparison, setSelectedComparison] = useState<string | null>(
    null
  )

  const groupTarget: ActionTargetWire = {
    kind: "group",
    scope: props.scope,
    groupKey: props.group.key,
  }
  const docs = documentationFor(groupTarget, props.actions, props.notes)

  return (
    <ScreenShell
      heading={props.group.roleTitle ?? label}
      animated={animated}
      headingLevel={headingLevel}
      align="start"
      headingExtra={
        <>
          {props.scope === "equalWork" && (
            <PayGapFlagBadge flag={props.group.flag} />
          )}
          {props.group.seniority !== null && (
            <SeniorityBadge seniority={props.group.seniority} />
          )}
          {props.group.level !== null && (
            <LevelBadge level={props.group.level} />
          )}
          {/* The women's share, which is what admitted this group to the
              chapter (>= 60% is the DO's own guide figure). The only fact
              the removed lead sentence carried that is not visible
              elsewhere on the step. */}
          {props.scope === "equivalentWork" && (
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span aria-hidden="true" className="size-2.5 shrink-0">
                <GenderDotIcon series="women" />
              </span>
              {tGap("womenShareBadge", {
                share: percentText(props.group.womenSharePct),
              })}
            </Badge>
          )}
          {/* The group's own documentation control belongs on the heading
              row, beside the badges that describe the same group. It used
              to sit in its own right-aligned strip further down, where a
              lone "..." read as an orphan hovering over the figures rather
              than as this group's action. */}
          <DocumentationBadges actions={docs.actions} notes={docs.notes} />
          <DocumentationMenu
            runId={props.runId}
            target={groupTarget}
            targetLabel={label}
            actions={docs.actions}
            notes={docs.notes}
            currency={props.currency}
            locked={locked}
          />
        </>
      }
    >
      <div className="w-full space-y-4">
        <div className="space-y-2">
          {props.scope === "equalWork" ? (
            // The figures live in EqualWorkDetail's badges below, next to
            // the plot that shows the same gap. A sentence restating them
            // put the same percentage on screen four times (here, in the
            // figures, on the plot's own gap label, and in the flag badge).
            //
            // The exception is a group with no measurable difference:
            // there are no figures to badge, so words are the only way to
            // say that nothing was found. Skipping this would leave the
            // step's most reassuring result as a blank space.
            equalWorkFindingVariant(props.group).key === "none" ? (
              <p className="text-base text-muted-foreground">
                {tFinding("none", {
                  women: props.group.womenCount,
                  men: props.group.menCount,
                })}
              </p>
            ) : null
          ) : // No lead sentences. "X is women-dominated (100% women)" became
          // the share badge on the heading, and "16 equally or lower
          // valued jobs earn more on average" restated the table directly
          // below it, which lists exactly those jobs with the difference
          // in its own column.
          props.group.comparisons.length === 0 ? (
            // Stated in words, because there is no table to speak for
            // it: this is the compliance-positive result, and a blank
            // space would read as something failing to load.
            <p className="text-base text-muted-foreground">
              {tGap("noComparators")}
            </p>
          ) : (
            <>
              <ComparatorTable
                baseline={props.group}
                comparisons={props.group.comparisons}
                currency={currency}
                selectedKey={selectedComparison}
                onSelect={setSelectedComparison}
                {...(props.runId === undefined
                  ? {}
                  : {
                      documentation: {
                        runId: props.runId,
                        groupKey: props.group.key,
                        actions: props.actions,
                        notes: props.notes,
                        locked,
                      },
                    })}
              />
              {/* The individuals, right under the table of averages.
                      Averages say WHETHER there is a gap; the plot is
                      where a documenter can see whether something like
                      length of service explains it, which is the
                      objective ground they have to weigh. */}
              <WomenDominatedScatter
                group={props.group}
                rows={rows}
                currency={currency}
                referenceDateMs={referenceDateMs}
                highlightComparisonKey={selectedComparison}
              />
            </>
          )}
        </div>

        {/* The detail view leads (Iteration 2 note 3): summary strip, the
            scatter, then the individual member table, all before the
            documentation form. */}
        {props.scope === "equalWork" && (
          <EqualWorkDetail
            group={props.group}
            rows={rows}
            currency={currency}
            referenceDateMs={referenceDateMs}
            documentation={{ runId, actions, notes, locked }}
          />
        )}

        <PayMappingGroupAnalysisForm
          ref={formRef}
          runId={runId}
          scope={props.scope}
          groupKey={props.group.key}
          requiresDocumentation={requiresDocumentation}
          locked={locked}
          analysis={analysis}
          onDocumentationChange={setDoc}
        />
      </div>
      <ReviewStepActions
        onPrevious={onPrevious}
        onSkip={onSkip}
        primaryLabel={t("markDoneNext")}
        onPrimary={handleMarkDone}
        primaryDisabled={locked || blocked}
        onUndo={done && !blocked && !locked ? handleUndo : undefined}
      />
    </ScreenShell>
  )
}
