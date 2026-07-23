"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { ScreenShell } from "@/components/screen-shell"
import { BandBadge } from "@/components/band-badge"
import { LevelBadge } from "@/components/track-badge"
import { useMoney } from "@/hooks/use-money"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"
import {
  type PayMappingGroupAnalysisFormHandle,
  PayMappingGroupAnalysisForm,
} from "./pay-mapping-group-analysis-form"
import {
  groupLabel,
  PayMappingGroupUnderlag,
} from "./pay-mapping-group-underlag"
import { MeanComparisonBars } from "./mean-comparison-bars"
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

// The equal-work finding sentence's variant key + raw interpolation numbers
// (less/more/none/only-women/only-men). A pure data-selector, deliberately
// never touching next-intl's own
// translate-function type: threading THAT type through an explicit
// parameter elsewhere in this file triggered a real "Type instantiation is
// excessively deep" compiler error (it is a deeply generic overload set
// keyed to the whole message JSON, meant to be called in place, not passed
// around). The gap is left as a raw signed percent (not yet formatted, and
// not yet abs'd): the render site turns it into the ICU string via its own
// percentText, right where it calls the real, precisely-typed tFinding.
function equalWorkFindingVariant(group: GapGroup): {
  key: "onlyWomen" | "onlyMen" | "none" | "less" | "more"
  women: number
  men: number
  gapPct: number | null
} {
  const { womenCount: women, menCount: men, gapPct } = group
  if (men === 0) return { key: "onlyWomen", women, men, gapPct }
  if (women === 0) return { key: "onlyMen", women, men, gapPct }
  if (gapPct === null || gapPct === 0)
    return { key: "none", women, men, gapPct }
  return { key: gapPct > 0 ? "less" : "more", women, men, gapPct }
}

interface ReviewGroupStepCommonProps {
  analysis: GroupAnalysis | undefined
  runId: Id<"payMappingRuns">
  locked: boolean
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
  requiresDocumentation: boolean
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
      // The full equivalent-work band list: PayMappingGroupUnderlag's own
      // equivalent-work branch needs it (to find the group's own band's
      // women-men gap for its band-context sentence), mirroring the union
      // it composes. The shell holds the run's whole gap result and passes
      // gap.equivalentWork through unchanged.
      equivalentWork: GapGroup[]
    } & ReviewGroupStepCommonProps)

// The wizard's documentation step for one equalWork (equal-work) or
// equivalentWork (women-dominated cross-level comparison) group
// (ADR-0012). Composes, in order: the group's heading (label +
// severity/band chips), the plain-language finding sentence(s) that
// restate the group's own numbers so the reader never has to translate a
// raw percentage into a judgment, MeanComparisonBars (equalWork only, and
// only once both means are known),
// PayMappingGroupAnalysisForm (the reasons/note documentation surface), the
// PayMappingGroupUnderlag disclosure (the underlying rows/tables/scatter),
// and the shared ReviewStepActions row.
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
  const format = useFormatter()
  const money = useMoney()
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

  // The full "roleTitle · level" label, still used by the women-dominated
  // finding sentence; the heading itself shows the title with the level as
  // a badge beside it.
  const label = groupLabel(props.group)
  // The same "still validly done" condition the form uses to decide whether
  // an edit reopens it (see pay-mapping-group-analysis-form.tsx's own
  // handleReasonToggle/saveNote doc comment): once a requiring group's
  // documentation empties out, it can no longer be considered done, so the
  // undo button hides in the SAME render as the edit (no need to wait on the
  // subscription round-trip the form's reopen save triggers), and the
  // primary "mark done" action is gated on the identical condition.
  const blocked = requiresDocumentation && !doc.documented

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
          {props.group.level !== null && (
            <LevelBadge level={props.group.level} />
          )}
          {props.group.band !== null && <BandBadge band={props.group.band} />}
        </>
      }
    >
      <div className="w-full space-y-4">
        <div className="space-y-2">
          {props.scope === "equalWork" ? (
            <p className="text-base text-muted-foreground">
              {(() => {
                const variant = equalWorkFindingVariant(props.group)
                switch (variant.key) {
                  case "onlyWomen":
                    return tFinding("onlyWomen", { count: variant.women })
                  case "onlyMen":
                    return tFinding("onlyMen", { count: variant.men })
                  case "none":
                    return tFinding("none", {
                      women: variant.women,
                      men: variant.men,
                    })
                  default:
                    return tFinding(variant.key, {
                      gap: percentText(Math.abs(variant.gapPct ?? 0)),
                      women: variant.women,
                      men: variant.men,
                    })
                }
              })()}
            </p>
          ) : (
            <>
              <p className="text-base text-muted-foreground">
                {tFinding("wdLead", {
                  label,
                  share: percentText(props.group.womenSharePct),
                })}
              </p>
              {props.group.comparisons.length > 0 && (
                <>
                  <p className="text-base text-muted-foreground">
                    {tFinding("wdComparisons", {
                      count: props.group.comparisons.length,
                    })}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
                    {props.group.comparisons.map((comparison) => (
                      <li key={comparison.key}>
                        {tFinding("wdComparator", {
                          label: groupLabel(comparison),
                          band: comparison.band,
                          diff: money(comparison.diffSek, currency),
                        })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {props.scope === "equalWork" &&
          props.group.womenMeanComp !== null &&
          props.group.menMeanComp !== null && (
            <MeanComparisonBars
              womenMean={props.group.womenMeanComp}
              menMean={props.group.menMeanComp}
              currency={currency}
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

        {props.scope === "equalWork" ? (
          <PayMappingGroupUnderlag
            scope="equalWork"
            group={props.group}
            rows={rows}
            currency={currency}
            referenceDateMs={referenceDateMs}
          />
        ) : (
          <PayMappingGroupUnderlag
            scope="equivalentWork"
            group={props.group}
            equivalentWork={props.equivalentWork}
            rows={rows}
            currency={currency}
            referenceDateMs={referenceDateMs}
          />
        )}
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
