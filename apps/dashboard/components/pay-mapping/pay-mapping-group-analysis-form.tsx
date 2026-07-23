"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import {
  PAY_GAP_REASON_GROUP_KEYS,
  PAY_GAP_REASON_GROUPS,
} from "@workspace/constants"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useTranslations } from "next-intl"
import {
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { HelpMorphButton } from "@/components/help-morph-button"
import { OptionCard } from "@/components/option-card"
import { useOrganization } from "@/components/org-context"
import { isRunCompletedError } from "@/lib/pay-mapping-errors"
import type { GroupAnalysis } from "./pay-mapping-gap-types"

const NOTE_SAVE_DEBOUNCE_MS = 800

// Distinguishes the one REACHABLE backend rejection from this form (removing
// the last reason, or clearing the note, while the group is already marked
// done: errors.payMappingDocumentationRequired) from transient failures, so
// the toast can name the real problem instead of a generic error. Same
// instanceof-ConvexError + data.code idiom as model-builder.tsx's
// errorKeyFor; the backend serializes the i18n key into `data.code`
// (packages/backend/convex/lib/errors.ts appError).
function isDocumentationRequiredError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingDocumentationRequired"
  )
}

// The imperative escape hatch for the mark-done race documented at
// review-group-step.tsx's own handleMarkDone: at the moment "mark done" is
// clicked, THIS form's note-debounce timer may still be pending. Letting it
// fire on its own would be redundant (the group step's own done:true upsert
// already carries the CURRENT note via onDocumentationChange) and unsafe
// (it would send THIS form's own `doneRef.current`, which has not yet
// observed the done:true the step is about to make, and could round-trip a
// stale `done: false` back over it). flushPendingNoteSave cancels the
// pending timer and marks the note as saved, WITHOUT a network call of its
// own: the caller's own upsert (about to fire right after) is what actually
// persists it.
export interface PayMappingGroupAnalysisFormHandle {
  flushPendingNoteSave: () => void
}

// One group's documentation (objective reasons and a deepened analysis
// note), for the analysis tables (equalWork/equivalentWork). The Klarmarkerad
// done-toggle used to live here as a Switch; it moved out to the wizard's own
// group-step primary button (which gates on `onDocumentationChange`'s
// `documented` flag and sends its own `done: true` upsert), so this form no
// longer renders or flips `done` itself. It still tracks the group's CURRENT
// `done` value (mirrored from `analysis`, never user-edited here) purely so
// every reason/note save it makes round-trips that value unchanged instead of
// clobbering a `done: true` set elsewhere back to `false`. This is a
// CONTINUOUS EDITING surface, like RatingStepper and classify-title-table,
// NOT an RHF+Zod submit form: there is no submit button. Chip toggles save
// immediately on click; the note saves on blur AND on an 800ms typing
// debounce. The backend re-validates independently (canonical reason
// ordering, done-without-documentation rejection on requiring groups).
export function PayMappingGroupAnalysisForm({
  runId,
  scope,
  groupKey,
  requiresDocumentation,
  locked,
  analysis,
  onDocumentationChange,
  ref,
}: {
  runId: Id<"payMappingRuns">
  scope: "equalWork" | "equivalentWork"
  groupKey: string
  requiresDocumentation: boolean
  locked: boolean
  analysis: GroupAnalysis | undefined
  // The wizard's whole window into this form's local state: fired on every
  // local reasons/note change (and once on mount with the initial state) so
  // the group step's primary button can gate on `documented` and forward the
  // same `reasons`/`note` into its own `done: true` upsert.
  onDocumentationChange?: (payload: {
    reasons: PayGapReason[]
    note: string
    documented: boolean
  }) => void
  // React 19 ref-as-prop (no forwardRef): the group step's own handle onto
  // flushPendingNoteSave (see the doc comment above).
  ref?: Ref<PayMappingGroupAnalysisFormHandle>
}) {
  const t = useTranslations("dashboard.payMapping.analysisForm")
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const { orgId } = useOrganization()
  const upsertGroupAnalysis = useMutation(
    api.payMapping.analyses.upsertGroupAnalysis
  )
  const noteId = useId()

  const [reasons, setReasons] = useState<PayGapReason[]>(
    () => analysis?.reasons ?? []
  )
  const [note, setNote] = useState(() => analysis?.note ?? "")
  const [done, setDone] = useState(() => analysis?.done ?? false)
  // Read in the effect below via a ref (not a dependency) so passing a fresh
  // inline callback identity never re-fires it on its own; it must fire
  // exactly when `reasons`/`note` change, never merely on a parent re-render.
  const onDocumentationChangeRef = useRef(onDocumentationChange)
  onDocumentationChangeRef.current = onDocumentationChange
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)
  // The trimmed note value known to be persisted: the last successful save,
  // or the last prop value accepted into local state. Lets the sync effect
  // and the save guards (below) tell an in-flight edit apart from an
  // already-saved value round-tripping back.
  const lastSavedNoteRef = useRef((analysis?.note ?? "").trim())
  // Mirrors of `reasons`/`done` for the debounced note save (see `saveNote`
  // below): the timer can fire well after the render that scheduled it, so
  // the save must read the CURRENT companions, never the ones closed over
  // at schedule time.
  const reasonsRef = useRef(reasons)
  reasonsRef.current = reasons
  const doneRef = useRef(done)
  doneRef.current = done

  // Re-seeds from the subscription (the initial load, or this component's
  // own save round-tripping back) whenever the ROW'S OWN VALUES change, never
  // on the analysis object's identity (a new reference every render). This
  // way an in-flight optimistic toggle is never clobbered by its own save
  // resolving through the query. The note additionally never re-seeds while
  // the textarea has focus, or while the local note is dirty relative to
  // `lastSavedNoteRef` (an edit that has not finished saving yet): otherwise
  // a save's own round-trip could land mid-keystroke, on a RESUMED edit made
  // after the debounce fired, and stomp what the user just typed.
  const analysisReasonsKey = (analysis?.reasons ?? []).join(",")
  const analysisNote = analysis?.note ?? ""
  const analysisDone = analysis?.done ?? false
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the row's own scalar values (see comment above), not analysis identity or the setters
  useEffect(() => {
    setReasons(analysis?.reasons ?? [])
    setDone(analysis?.done ?? false)

    const isNoteDirty = note.trim() !== lastSavedNoteRef.current
    if (isNoteDirty) return

    lastSavedNoteRef.current = analysisNote.trim()
    const isNoteFocused =
      noteRef.current !== null &&
      noteRef.current.ownerDocument.activeElement === noteRef.current
    if (!isNoteFocused) {
      setNote(analysisNote)
    }
  }, [analysisReasonsKey, analysisNote, analysisDone])

  useEffect(() => {
    return () => {
      if (noteTimerRef.current !== null) clearTimeout(noteTimerRef.current)
    }
  }, [])

  // No deps array: re-created every render so the closure always reads the
  // CURRENT `note`, exactly like the debounced-save mirrors above (reasonsRef
  // /doneRef) -- cheap (an object with one function), and correctness here
  // matters more than skipping a recreation.
  useImperativeHandle(ref, () => ({
    flushPendingNoteSave() {
      if (noteTimerRef.current !== null) {
        clearTimeout(noteTimerRef.current)
        noteTimerRef.current = null
      }
      lastSavedNoteRef.current = note.trim()
    },
  }))

  const trimmedNote = note.trim()
  const hasDocumentation = reasons.length > 0 || trimmedNote !== ""

  // Fires on every local reasons/note change, and once on mount with the
  // initial state (this effect's first run): the wizard's whole window into
  // this form's local state (see the callback's own doc comment above). Keyed
  // on a joined string, not the `reasons` array reference: the sync effect
  // above re-seeds `reasons` from `analysis` on every mount (a fresh array
  // with the same content, different identity), which would otherwise
  // re-fire this a second time on mount for no actual content change.
  const reasonsKey = reasons.join(",")
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally NOT keyed on the callback identity (read via the ref above), on `reasons` itself (see reasonsKey above), or on hasDocumentation (a value already derived from reasons/note in this same render)
  useEffect(() => {
    onDocumentationChangeRef.current?.({
      reasons,
      note,
      documented: hasDocumentation,
    })
  }, [reasonsKey, note])

  async function save(next: {
    reasons: PayGapReason[]
    note: string
    done: boolean
  }) {
    const trimmed = next.note.trim()
    await upsertGroupAnalysis({
      orgId,
      runId,
      scope,
      groupKey,
      reasons: next.reasons,
      ...(trimmed === "" ? {} : { note: trimmed }),
      done: next.done,
    })
  }

  // Shared catch-block toast: names the one reachable backend rejection from
  // this form (unchecking the last reason, or clearing the note, while the
  // group is already marked done) instead of the generic error, so the user
  // sees why the save was rejected rather than a spurious-looking failure.
  function showSaveError(error: unknown) {
    toast.error(
      isDocumentationRequiredError(error)
        ? tErrors("payMappingDocumentationRequired")
        : isRunCompletedError(error)
          ? tErrors("payMappingRunCompleted")
          : tToast("error")
    )
  }

  // THE ADJUDICATED REOPEN PATTERN (documented at both call sites: here and
  // review-group-step.tsx, which owns the OTHER half of `done`, see its own
  // header comment). `done` marks a sealed adjudication: a human confirmed
  // THIS specific set of reasons/note is complete and accurate. On a
  // REQUIRING group (`requiresDocumentation`), an edit that EMPTIES the
  // documentation (no reason left active, and no note) invalidates that
  // seal, so the save making the edit proactively carries `done: false`
  // (+ a "reopened" toast) instead of the stale `done: true` it would
  // otherwise round-trip unchanged, which the backend would reject (the one
  // reachable payMappingDocumentationRequired case from this form). This
  // mirrors review-praxis-step.tsx's own saveNote exactly ("emptying the
  // note on a done 'found' step reopens it"), generalized to either
  // documentation source. An edit that leaves (or makes) the documentation
  // non-empty never reopens: `done` stays exactly what it was. The step
  // never has to be told about this separately: it derives its own
  // "still validly done" state from the SAME `requiresDocumentation &&
  // !documented` condition it already uses to gate its primary button (via
  // `onDocumentationChange`'s `documented` field), so both sides go dark in
  // the same render without waiting on the subscription round-trip; the
  // round-trip still lands afterward and is a no-op once it does.
  async function handleReasonToggle(reason: PayGapReason) {
    if (locked) return
    const previousReasons = reasons
    const nextReasons = previousReasons.includes(reason)
      ? previousReasons.filter((candidate) => candidate !== reason)
      : [...previousReasons, reason]
    const wasDone = done
    const nextHasDocumentation = nextReasons.length > 0 || trimmedNote !== ""
    const reopening = wasDone && requiresDocumentation && !nextHasDocumentation
    setReasons(nextReasons)
    if (reopening) setDone(false)
    try {
      await save({ reasons: nextReasons, note, done: reopening ? false : done })
      if (reopening) toast.success(tToast("payMappingGroupReopened"))
    } catch (error) {
      setReasons(previousReasons)
      if (reopening) setDone(true)
      showSaveError(error)
    }
  }

  async function saveNote(value: string) {
    const trimmed = value.trim()
    // Nothing changed since the last save (or the last accepted prop value):
    // skip the no-op mutation (and its audit row). Covers a blur that fires
    // with no edits, and a chip click stealing focus from an untouched note.
    if (trimmed === lastSavedNoteRef.current) return
    const currentReasons = reasonsRef.current
    const wasDone = doneRef.current
    const nextHasDocumentation = currentReasons.length > 0 || trimmed !== ""
    const reopening = wasDone && requiresDocumentation && !nextHasDocumentation
    try {
      await save({
        reasons: currentReasons,
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
    const value = event.target.value
    setNote(value)
    scheduleNoteSave(value)
  }

  function handleNoteBlur() {
    if (noteTimerRef.current !== null) {
      clearTimeout(noteTimerRef.current)
      noteTimerRef.current = null
    }
    void saveNote(note)
  }

  return (
    <div className="space-y-4">
      {locked && (
        <p className="text-muted-foreground text-sm">{t("lockedHint")}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm">{t("reasonsTitle")}</p>
          <HelpMorphButton label={tHelp("payGapReasonsLabel")}>
            {tHelp("payGapReasonsBody")}
          </HelpMorphButton>
        </div>
        {PAY_GAP_REASON_GROUP_KEYS.map((group) => (
          <div key={group} className="space-y-1.5">
            <p className="text-muted-foreground text-xs">
              {tReasons(`groups.${group}`)}
            </p>
            <div className="flex flex-wrap gap-3">
              {PAY_GAP_REASON_GROUPS[group].map((reason) => (
                <OptionCard
                  key={reason}
                  size="sm"
                  title={tReasons(reason)}
                  selected={reasons.includes(reason)}
                  disabled={locked}
                  onSelect={() => handleReasonToggle(reason)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor={noteId}>{t("noteTitle")}</Label>
        <Textarea
          id={noteId}
          ref={noteRef}
          value={note}
          disabled={locked}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />
        <p className="text-muted-foreground text-sm">{t("noteHelper")}</p>
      </div>
    </div>
  )
}
