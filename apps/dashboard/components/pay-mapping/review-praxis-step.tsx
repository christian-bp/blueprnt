"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PraxisAreaKey } from "@workspace/constants"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { OptionCard } from "@/components/option-card"
import { ScreenShell } from "@/components/screen-shell"
import { isRunCompletedError } from "@/lib/pay-mapping-errors"
import type { GroupAnalysis } from "./pay-mapping-gap-types"
import { ReviewStepActions } from "./review-step-actions"

const NOTE_SAVE_DEBOUNCE_MS = 800

type Finding = "none" | "found"

// Distinguishes the one reachable backend rejection from this step (marking
// done without a required note) from transient failures, so the toast can
// name the real problem. Same instanceof-ConvexError + data.code idiom as
// PayMappingGroupAnalysisForm's own isDocumentationRequiredError. The
// proactive done:false sends in handleChoice/saveNote below already steer
// around this in the normal flow; this stays as a belt-and-braces fallback
// for any other path that might still hit it (e.g. a concurrent edit).
function isDocumentationRequiredError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingDocumentationRequired"
  )
}

// One lönebestämmelser/praxis review area (DL 3 kap. 8 § p1): a two-choice
// verdict (no deficiencies / deficiencies found) plus a note, required only
// when deficiencies were found. Mirrors PayMappingGroupAnalysisForm's
// continuous-editing save discipline (choice saves immediately, note on
// blur/debounce, no-op skip, focus guard against a re-seed clobbering an
// in-flight edit), but reuses payMappingGroupAnalyses with scope "praxis"
// and reasons always empty (praxis has no objective-reason taxonomy). Unlike
// the group form, THIS step owns `done` itself: its own primary action is
// the only thing that marks the step done (there is no separate wizard
// button layered on top, as there will be for the group step).
export function ReviewPraxisStep({
  area,
  analysis,
  runId,
  locked,
  animated,
  headingLevel = "h1",
  onNext,
  onPrevious,
  onSkip,
}: {
  area: PraxisAreaKey
  analysis: GroupAnalysis | undefined
  runId: Id<"payMappingRuns">
  locked: boolean
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
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tForm = useTranslations("dashboard.payMapping.analysisForm")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const { orgId } = useOrganization()
  const upsertGroupAnalysis = useMutation(
    api.payMapping.analyses.upsertGroupAnalysis
  )
  const noteId = useId()

  const [finding, setFinding] = useState<Finding | undefined>(
    () => analysis?.finding ?? undefined
  )
  const [note, setNote] = useState(() => analysis?.note ?? "")
  const [done, setDone] = useState(() => analysis?.done ?? false)
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)
  const lastSavedNoteRef = useRef((analysis?.note ?? "").trim())
  // Mirrors of finding/done for the debounced note save: the timer can fire
  // well after the render that scheduled it, so the save must read the
  // CURRENT companions, never the ones closed over at schedule time.
  const findingRef = useRef(finding)
  findingRef.current = finding
  const doneRef = useRef(done)
  doneRef.current = done

  const analysisFinding = analysis?.finding ?? undefined
  const analysisNote = analysis?.note ?? ""
  const analysisDone = analysis?.done ?? false
  // Re-seeds from the subscription whenever the ROW'S OWN VALUES change,
  // never on the analysis object's identity, so an in-flight save is never
  // clobbered by its own round-trip; the note additionally never re-seeds
  // while focused or dirty relative to the last save (see the group form's
  // identical guard).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the row's own scalar values (see comment above), not analysis identity or the setters
  useEffect(() => {
    setFinding(analysisFinding)
    setDone(analysisDone)

    const isNoteDirty = note.trim() !== lastSavedNoteRef.current
    if (isNoteDirty) return

    lastSavedNoteRef.current = analysisNote.trim()
    const isNoteFocused =
      noteRef.current !== null &&
      noteRef.current.ownerDocument.activeElement === noteRef.current
    if (!isNoteFocused) setNote(analysisNote)
  }, [analysisFinding, analysisNote, analysisDone])

  useEffect(() => {
    return () => {
      if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
    }
  }, [])

  async function save(next: {
    finding: Finding | undefined
    note: string
    done: boolean
  }) {
    const trimmed = next.note.trim()
    await upsertGroupAnalysis({
      orgId,
      runId,
      scope: "praxis",
      groupKey: area,
      reasons: [],
      ...(trimmed === "" ? {} : { note: trimmed }),
      done: next.done,
      ...(next.finding !== undefined ? { finding: next.finding } : {}),
    })
  }

  function showSaveError(error: unknown) {
    toast.error(
      isDocumentationRequiredError(error)
        ? tErrors("payMappingDocumentationRequired")
        : isRunCompletedError(error)
          ? tErrors("payMappingRunCompleted")
          : tToast("error")
    )
  }

  async function handleChoice(nextFinding: Finding) {
    if (locked || nextFinding === finding) return
    const previousFinding = finding
    const wasDone = done
    // Switching the verdict on a done step reopens it: the sealed
    // conclusion no longer matches what was just clicked, so this sends
    // done:false in the SAME upsert rather than risk the backend's
    // payMappingDocumentationRequired rejection reverting the click. When
    // the step wasn't done yet, done was already false, so this is a no-op.
    setFinding(nextFinding)
    if (wasDone) setDone(false)
    try {
      await save({ finding: nextFinding, note, done: false })
      if (wasDone) toast.success(tToast("payMappingGroupReopened"))
    } catch (error) {
      setFinding(previousFinding)
      if (wasDone) setDone(true)
      showSaveError(error)
    }
  }

  async function saveNote(value: string) {
    const trimmed = value.trim()
    // Nothing changed since the last save (or the last accepted prop
    // value): skip the no-op mutation.
    if (trimmed === lastSavedNoteRef.current) return
    const currentFinding = findingRef.current
    const wasDone = doneRef.current
    // Emptying the note on a done "found" step reopens it, for the same
    // reason as handleChoice above: the note is what made "found" valid, so
    // clearing it invalidates the sealed conclusion. A note edit that stays
    // non-empty (or isn't gating a "found" verdict) keeps done as-is.
    const reopening = wasDone && currentFinding === "found" && trimmed === ""
    try {
      await save({
        finding: currentFinding,
        note: value,
        done: reopening ? false : wasDone,
      })
      lastSavedNoteRef.current = trimmed
      if (reopening) {
        setDone(false)
        toast.success(tToast("payMappingGroupReopened"))
      }
    } catch (error) {
      showSaveError(error)
    }
  }

  function scheduleNoteSave(value: string) {
    if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(() => {
      noteTimerRef.current = null
      void saveNote(value)
    }, NOTE_SAVE_DEBOUNCE_MS)
  }

  function handleNoteChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (locked) return
    const value = event.target.value
    setNote(value)
    scheduleNoteSave(value)
  }

  function handleNoteBlur() {
    if (locked) return
    if (noteTimerRef.current !== null) {
      clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    void saveNote(note)
  }

  const trimmedNote = note.trim()
  const canMarkDone =
    finding !== undefined && (finding !== "found" || trimmedNote !== "")

  async function handleMarkDone() {
    if (locked || !canMarkDone || finding === undefined) return
    // Clear any pending debounced note save and adopt its value as saved
    // BEFORE (and with) the done upsert below, which already carries the
    // current note: otherwise a stale timer could fire after this resolves
    // and fire a redundant, no-longer-needed trailing save.
    if (noteTimerRef.current !== null) {
      clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    try {
      await save({ finding, note, done: true })
      lastSavedNoteRef.current = note.trim()
      setDone(true)
      onNext()
    } catch (error) {
      showSaveError(error)
    }
  }

  async function handleUndo() {
    if (locked) return
    try {
      await save({ finding, note, done: false })
      setDone(false)
      toast.success(tToast("payMappingGroupReopened"))
    } catch (error) {
      showSaveError(error)
    }
  }

  return (
    // The area kicker sits above the heading, outside ScreenShell: it is not
    // part of the reveal/description anatomy, just a small label. Left-
    // aligned like the step itself (align="start": a long question wrapping
    // over two lines reads ragged when centered).
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-sm">
        {t(`praxis.${area}.title`)}
      </p>
      <ScreenShell
        heading={t(`praxis.${area}.question`)}
        description={t(`praxis.${area}.helper`)}
        animated={animated}
        headingLevel={headingLevel}
        align="start"
      >
        <div className="w-full space-y-4">
          {locked && (
            <p className="text-muted-foreground text-sm">
              {tForm("lockedHint")}
            </p>
          )}

          {/* Unlike onboarding's one-shot OptionCard screens the verdict
              stays changeable, so no auto-advance fading. */}
          <div className="flex flex-wrap gap-3">
            <OptionCard
              size="sm"
              title={t("findingNone")}
              selected={finding === "none"}
              disabled={locked}
              onSelect={() => handleChoice("none")}
            />
            <OptionCard
              size="sm"
              title={t("findingFound")}
              selected={finding === "found"}
              disabled={locked}
              onSelect={() => handleChoice("found")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={noteId}>{t("praxisNoteLabel")}</Label>
            <Textarea
              id={noteId}
              ref={noteRef}
              value={note}
              disabled={locked}
              onChange={handleNoteChange}
              onBlur={handleNoteBlur}
            />
            <p className="text-muted-foreground text-sm">
              {t("praxisNoteHelper")}
            </p>
          </div>
        </div>
        <ReviewStepActions
          onPrevious={onPrevious}
          onSkip={onSkip}
          primaryLabel={t("markDoneNext")}
          onPrimary={handleMarkDone}
          primaryDisabled={locked || !canMarkDone}
          onUndo={done && !locked ? handleUndo : undefined}
        />
      </ScreenShell>
    </div>
  )
}
