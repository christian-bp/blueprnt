"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { useOrganization } from "@/components/org-context"
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
import { ComparisonReasonsPanel } from "./comparison-reasons-panel"
import { EqualWorkDetail } from "./equal-work-detail"
import { EvidenceDisclosure } from "./evidence-disclosure"
import { GroupMemberTable } from "./group-member-table"
import { WomenDominatedScatter } from "./women-dominated-underlying-data"
import { hasStepActions, ReviewStepActions } from "./review-step-actions"

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

// Whether an equal-work group has nothing measurable to report on its
// primary metric. Every group that reaches this step passed the ADR-0015
// entry conditions (both genders, women trailing on one of the measures),
// so this is a defensive edge (a gapless or masked primary) rather than a
// variant: the figures themselves live in EqualWorkDetail's badges, and the
// sentence exists only for the case where there are no figures to badge.
function hasNoMeasurableGap(group: GapGroup): boolean {
  const { gapPct } = primaryGapMetric(group)
  return gapPct === null || gapPct <= 0
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
  // Whether the analysis section is already showing this chapter's
  // continuation link (chapterContinuationShown): the step then drops its own
  // primary, so one destination never carries two controls.
  continuationShown?: boolean
  // Threaded from the surface: the step mounts at the top of its own page
  // (h1, the default), or under the analysis pane's own h2/h3 (h4), so the
  // document's heading order stays unbroken either way.
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
      // Every documentation row for THIS group that explains one comparison
      // (the rows carrying a comparisonKey). The group's own row arrives as
      // `analysis`, as for equal work.
      comparisonAnalyses: GroupAnalysis[]
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
    continuationShown = false,
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
  // Equivalent work is documented per COMPARISON: every comparator in the
  // table out-earns this group, so each is a difference DL 3 kap. 9 § asks
  // about, and the group cannot be closed while any of them is unexplained.
  // Equal work keeps the group-level rule, where the group IS the comparison.
  const comparisonRows =
    props.scope === "equivalentWork" ? props.comparisonAnalyses : []
  // Narrowed once: the union's equal-work half has no comparators at all, and
  // every reader below wants the same empty list there.
  const comparisons =
    props.scope === "equivalentWork" ? props.group.comparisons : []
  // A reason from the taxonomy or a written assessment, the same pair equal
  // work accepts: the law asks for a bedömning, not for our chip taxonomy.
  const explainedComparisons = new Set(
    comparisonRows
      .filter((row) => row.reasons.length > 0 || (row.note ?? "").trim() !== "")
      .map((row) => row.comparisonKey)
  )
  const unexplainedComparisons = comparisons.filter(
    (comparison) => !explainedComparisons.has(comparison.key)
  ).length
  const blocked =
    props.scope === "equivalentWork"
      ? requiresDocumentation && unexplainedComparisons > 0
      : requiresDocumentation && !doc.documented
  // One comparison's display name, from the same helper the table and the
  // answer card use.
  const comparisonLabelFor = (comparisonKey: string) => {
    const comparison = comparisons.find(
      (candidate) => candidate.key === comparisonKey
    )
    return comparison === undefined ? comparisonKey : groupLabel(comparison)
  }

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

  const stepActions = {
    onPrevious,
    onSkip,
    // Stated in words rather than only disabling the button: the app's rule
    // is that a flow names its precondition.
    hint:
      props.scope === "equivalentWork" && unexplainedComparisons > 0
        ? t("comparisonsMissing", {
            missing: unexplainedComparisons,
            total: props.group.comparisons.length,
          })
        : undefined,
    // The chapter's own continuation replaces this button only for a step
    // that is already done. A group the queue never listed (an equal-work
    // group with nothing to explain) can still be open and unmarked while
    // every flagged group around it is finished, and dropping its primary
    // there left the step with no control that could mark it done at all.
    primaryLabel: continuationShown && done ? undefined : t("markDoneNext"),
    onPrimary: continuationShown && done ? undefined : handleMarkDone,
    primaryDisabled: locked || blocked,
    onUndo: done && !blocked && !locked ? handleUndo : undefined,
  }
  return (
    // The step IS the frame: its header carries the group's own title, the
    // badges that describe it, the chapter's statutory duty as the help
    // beside them and the group's documentation menu as the toolbar, and
    // every block below sits on the frame's ground instead of floating on a
    // white card with nothing between the sections.
    <FrameCard
      size="lg"
      title={props.group.roleTitle ?? label}
      titleLevel={headingLevel}
      // The figures live in EqualWorkDetail's badges below, next to the plot
      // that shows the same gap. A sentence restating them put the same
      // percentage on screen four times (here, in the figures, on the plot's
      // own gap label, and in the flag badge).
      //
      // The exception is a group with no measurable difference: there are no
      // figures to badge, so words are the only way to say that nothing was
      // found. Skipping this would leave the step's most reassuring result as
      // a blank space.
      {...(props.scope === "equalWork" && hasNoMeasurableGap(props.group)
        ? {
            description: tFinding("none", {
              women: props.group.womenCount,
              men: props.group.menCount,
            }),
          }
        : {})}
      // The header's right edge carries the group's STATE and the menu that
      // acts on it, so a long role title is never pushed onto a second line
      // by chips. The title row itself stays the title alone.
      toolbar={
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
      // An empty action row still holds its footer's height, so the footer
      // is passed only when the row would draw something.
      footer={
        hasStepActions(stepActions) ? (
          <ReviewStepActions {...stepActions} />
        ) : undefined
      }
    >
      {props.scope === "equalWork" ? (
        <>
          {/* The detail view leads (Iteration 2 note 3): the figures in
              their own panel, then the scatter and the member roster as the
              bounded objects they already are. */}
          <EqualWorkDetail
            group={props.group}
            rows={rows}
            currency={currency}
            referenceDateMs={referenceDateMs}
            documentation={{ runId, actions, notes, locked }}
          />
          {/* The block the reader writes in, in its own panel. No section
              title, because the form already names its two parts (the
              objective reasons and the deepened analysis) and a panel title
              above them would name the same section a third time. */}
          <FrameCardSection>
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
          </FrameCardSection>
        </>
      ) : (
        // No lead sentences. "X is women-dominated (100% women)" became the
        // share badge on the title row, and "16 equally or lower valued jobs
        // earn more on average" restated the table directly below it, which
        // lists exactly those jobs with the difference in its own column. A
        // group with no comparator never reaches this step: nothing
        // out-earns it, so it owes no answer, and the chapter lists only
        // groups that do (the report states the result).
        <>
          {/* The comparators and the instruction that follows from them are
              one panel: the table is the finding, and the sentence under it
              names the act the reader owes each row. */}
          <FrameCardSection>
            <ComparatorTable
              baseline={props.group}
              comparisons={props.group.comparisons}
              currency={currency}
              selectedKey={selectedComparison}
              onSelect={setSelectedComparison}
              // The answer opens INSIDE the selected row: the finding and
              // the answer are then the same object, instead of the reader
              // having to carry "which row was I answering for" past a
              // chart to a panel at the bottom of the page.
              renderExpanded={(comparisonKey) => (
                <ComparisonReasonsPanel
                  runId={runId}
                  groupKey={props.group.key}
                  comparisonKey={comparisonKey}
                  // The same label the table and the answer card show for
                  // this comparison, from the same helper: three names for
                  // one row is three things to reconcile.
                  comparisonLabel={comparisonLabelFor(comparisonKey)}
                  groupLabel={label}
                  analysis={comparisonRows.find(
                    (row) => row.comparisonKey === comparisonKey
                  )}
                  locked={locked}
                  // The OTHER comparisons still owing an answer, never this
                  // one: the bulk control's label counts what it is about to
                  // fill, and this row is the one being answered.
                  remainingCount={
                    comparisons.filter(
                      (comparison) =>
                        comparison.key !== comparisonKey &&
                        !explainedComparisons.has(comparison.key)
                    ).length
                  }
                  groupDone={done}
                  onGroupReopened={() => setDone(false)}
                />
              )}
              notesByComparison={
                new Map(
                  comparisonRows.flatMap((row) =>
                    row.comparisonKey === null || row.note === null
                      ? []
                      : [[row.comparisonKey, row.note] as const]
                  )
                )
              }
              reasonsByComparison={
                new Map(
                  comparisonRows.flatMap((row) =>
                    row.comparisonKey === null
                      ? []
                      : [[row.comparisonKey, row.reasons] as const]
                  )
                )
              }
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
            {props.group.comparisons.length > 0 &&
              selectedComparison === null && (
                // The table alone does not say that answering is the task, so
                // the step says it once. The answer opens inside the row.
                <p className="text-muted-foreground text-sm">
                  {t("selectComparison")}
                </p>
              )}
          </FrameCardSection>
          {/* The individuals, right under the table of averages. Averages
              say WHETHER there is a gap; the plot is where a documenter can
              see whether something like length of service explains it, which
              is the objective ground they have to weigh. */}
          <WomenDominatedScatter
            group={props.group}
            rows={rows}
            currency={currency}
            referenceDateMs={referenceDateMs}
            highlightComparisonKey={selectedComparison}
          />
          {/* The group's own roster, collapsed under the plot exactly as
              under equal work: the person a documenter decides to act on is
              found HERE, and the per-row menu is where the action goes. Its
              members only: the comparators' people are on the plot above,
              and this group is compared with them, not within itself, so the
              table carries no in-group difference column. */}
          <EvidenceDisclosure
            label={tGap("groupMembers")}
            count={props.group.headcount}
          >
            <GroupMemberTable
              group={props.group}
              rows={rows}
              currency={currency}
              documentation={{
                runId,
                scope: "equivalentWork",
                actions,
                notes,
                locked,
              }}
            />
          </EvidenceDisclosure>
        </>
      )}
    </FrameCard>
  )
}
