"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { newGestureId } from "@/lib/gesture"
import { toast } from "@/lib/toast"
import { PayGapReasonChips } from "./pay-gap-reason-chips"
import { REVIEW_NOTE_FIELD_CLASS } from "./review-step-actions"
import type { GroupAnalysis } from "./pay-mapping-gap-types"

// The objective reasons for ONE comparison in the equivalent-work chapter.
//
// DL 3 kap. 8 § p3 compares a women-dominated group against each equally or
// lower valued job that out-earns it, and 3 kap. 9 § asks what explains each
// of those differences. The unit of assessment is therefore the pair: a group
// out-earned by four jobs at 13.6%, 7.1%, 2.4% and 1.8% cannot answer for all
// four with one reason, and the reasons genuinely differ (an external market
// for one job, individual experience for another).
//
// Saves on every toggle, like the group form beside it: this is a continuous
// editing surface, not a submit form.
const NOTE_SAVE_DEBOUNCE_MS = 800

export function ComparisonReasonsPanel({
  runId,
  groupKey,
  comparisonKey,
  comparisonLabel,
  groupLabel,
  analysis,
  locked,
  remainingCount,
  groupDone,
  onGroupReopened,
}: {
  runId: Id<"payMappingRuns">
  groupKey: string
  comparisonKey: string
  comparisonLabel: string
  groupLabel: string
  // This comparison's own documentation row, if it has one yet.
  analysis: GroupAnalysis | undefined
  locked: boolean
  // How many OTHER comparisons in this group still have no reason. It is what
  // the bulk control counts, so the label can never promise more rows than
  // the click will fill.
  remainingCount: number
  // Whether the GROUP is currently marked done. Editing a comparison on a
  // done group invalidates that sealed adjudication, exactly as editing the
  // group's own documentation does.
  groupDone: boolean
  onGroupReopened: () => void
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const upsertGroupAnalysis = useMutation(
    api.payMapping.analyses.upsertGroupAnalysis
  )
  const applyToRemaining = useMutation(
    api.payMapping.analyses.applyReasonsToRemainingComparisons
  )

  const noteId = useId()
  const [reasons, setReasons] = useState<PayGapReason[]>(
    () => analysis?.reasons ?? []
  )
  const [note, setNote] = useState(() => analysis?.note ?? "")
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)
  // The trimmed note known to be persisted: the last successful save, or the
  // last prop value accepted into local state. Lets the sync effect tell an
  // in-flight edit apart from an already-saved value round-tripping back.
  const lastSavedNoteRef = useRef((analysis?.note ?? "").trim())
  // Read by the debounced save, which can fire long after the render that
  // scheduled it, so it must carry the CURRENT reasons rather than the ones
  // closed over at schedule time.
  const reasonsRef = useRef(reasons)
  reasonsRef.current = reasons

  // Re-seeds when the reader picks another row, and when this row's own save
  // round-trips back. Keyed on the comparison and on the row's own values,
  // never on the analysis object's identity (a new reference every render),
  // so an in-flight toggle is never clobbered by its own save resolving.
  const analysisReasonsKey = (analysis?.reasons ?? []).join(",")
  const analysisNote = analysis?.note ?? ""
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the row's own values and the selected comparison, not on analysis identity
  useEffect(() => {
    setReasons(analysis?.reasons ?? [])
    // The note never re-seeds while the textarea has focus, or while the local
    // value is dirty relative to the last save: a save's own round-trip could
    // otherwise land mid-keystroke and stomp what was just typed. Switching to
    // another comparison is a different matter, and takes the stored value.
    const isNoteDirty = note.trim() !== lastSavedNoteRef.current
    const isNoteFocused =
      noteRef.current !== null &&
      noteRef.current.ownerDocument.activeElement === noteRef.current
    if (isNoteDirty && isNoteFocused) return
    lastSavedNoteRef.current = analysisNote.trim()
    setNote(analysisNote)
  }, [analysisReasonsKey, analysisNote, comparisonKey])

  useEffect(() => {
    return () => {
      if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
    }
  }, [])

  // A done group whose comparison loses or gains an explanation is no longer
  // the group that was adjudicated, so the edit reopens it in the same call
  // rather than letting the next klarmarkering attempt fail server-side.
  //
  // Takes the caller's gesture id: the reopen is an automatic CONSEQUENCE of
  // the edit above it, and both write the same event type, so without a shared
  // id the log shows one chip click as two identical-looking pay-mapping edits
  // a millisecond apart with nothing saying the second followed from the first.
  // In a statutory kartlaggning trail that is the place a reader most needs
  // one act to read as one story.
  async function reopenGroupIfNeeded(gestureId: string) {
    if (!groupDone) return
    await upsertGroupAnalysis({
      orgId,
      gestureId,
      runId,
      scope: "equivalentWork",
      groupKey,
      reasons: [],
      done: false,
    })
    onGroupReopened()
    toast.success(tToast("payMappingGroupReopened"))
  }

  async function handleToggle(reason: PayGapReason) {
    if (locked) return
    const next = reasons.includes(reason)
      ? reasons.filter((candidate) => candidate !== reason)
      : [...reasons, reason]
    setReasons(next)
    const gestureId = newGestureId()
    try {
      await upsertGroupAnalysis({
        orgId,
        gestureId,
        runId,
        scope: "equivalentWork",
        groupKey,
        comparisonKey,
        reasons: next,
        done: false,
      })
      await reopenGroupIfNeeded(gestureId)
    } catch {
      setReasons(reasons)
      toast.error(tToast("error"))
    }
  }

  async function saveNote(value: string) {
    const trimmed = value.trim()
    // Nothing changed since the last save: skip the no-op mutation, which
    // would still write an audit row.
    if (trimmed === lastSavedNoteRef.current) return
    const gestureId = newGestureId()
    try {
      await upsertGroupAnalysis({
        orgId,
        gestureId,
        runId,
        scope: "equivalentWork",
        groupKey,
        comparisonKey,
        reasons: reasonsRef.current,
        ...(trimmed === "" ? {} : { note: trimmed }),
        done: false,
      })
      lastSavedNoteRef.current = trimmed
      await reopenGroupIfNeeded(gestureId)
    } catch {
      toast.error(tToast("error"))
    }
  }

  function handleNoteChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (locked) return
    const value = event.target.value
    setNote(value)
    if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(() => {
      noteTimerRef.current = null
      void saveNote(value)
    }, NOTE_SAVE_DEBOUNCE_MS)
  }

  function handleNoteBlur() {
    if (locked) return
    if (noteTimerRef.current !== null) {
      clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    void saveNote(note)
  }

  async function handleApplyToRemaining() {
    if (locked || reasons.length === 0) return
    const gestureId = newGestureId()
    try {
      await applyToRemaining({ orgId, gestureId, runId, groupKey, reasons })
      await reopenGroupIfNeeded(gestureId)
      toast.success(tToast("payMappingReasonsApplied"))
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <div className="space-y-3">
      <PayGapReasonChips
        reasons={reasons}
        disabled={locked}
        onToggle={handleToggle}
        title={
          <p className="font-medium text-sm">
            {t("comparisonReasonsHeading", {
              group: groupLabel,
              comparator: comparisonLabel,
            })}
          </p>
        }
      />
      {/* The prose that motivates the reasons above, on the same row as the
          reasons it motivates. Unlike the group form's note this needs no
          imperative flush before klarmarkering: that writes the GROUP's own
          document, so a pending save here cannot round-trip a stale `done`
          over it. The fixed height keeps the controls below from moving while
          the reader types. */}
      <div className="space-y-2">
        <Label htmlFor={noteId}>{t("comparisonNoteLabel")}</Label>
        <Textarea
          id={noteId}
          ref={noteRef}
          className={REVIEW_NOTE_FIELD_CLASS}
          value={note}
          disabled={locked}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />
        <p className="text-muted-foreground text-sm">
          {t("comparisonNoteHelper")}
        </p>
      </div>
      {/* Offered only when it would actually save work: one explanation often
          covers several comparators, and typing it once per row is what makes
          a per-row rule feel unworkable. It never overwrites a comparison
          that already carries its own reasons. */}
      {remainingCount > 0 && reasons.length > 0 && !locked && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleApplyToRemaining()}
        >
          {t("applyToRemaining", { count: remainingCount })}
        </Button>
      )}
    </div>
  )
}
