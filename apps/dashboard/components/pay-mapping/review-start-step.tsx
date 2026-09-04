"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { DatePicker } from "@/components/date-picker"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { isoToMs, msToIso } from "@/lib/iso-date"
import { isRunCompletedError } from "@/lib/pay-mapping-errors"
import {
  REVIEW_NOTE_FIELD_CLASS,
  hasStepActions,
  ReviewStepActions,
} from "./review-step-actions"

const SAVE_DEBOUNCE_MS = 800

// The stored collaboration day (epoch ms, null when unset) as the ISO string
// the DatePicker binds to ("" when unset).
function dateToIso(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? "" : msToIso(ms)
}

// The journey's first step: the samverkansredogörelse (11-12 §§), who took
// part in the samverkan, how, the parties' own remarks and on which day. The
// four fields feed ONE mutation together (setPayMappingCollaboration always
// takes all of them), so the guarded save mirrors PayMappingGroupAnalysisForm
// with the lastSaved ref keyed on the SET rather than per field: an edit to
// any field saves the CURRENT value of all of them. "Fortsätt" never blocks
// navigation; the gate itself (the two required fields non-empty, remarks and
// date outside it) is only ever stated as a muted hint, never a disabled
// primary action.
export function ReviewStartStep({
  runId,
  collaboration,
  locked,
  continuationShown = false,
  headingLevel = "h1",
  onNext,
  onPrevious,
  onSkip,
}: {
  runId: Id<"payMappingRuns">
  collaboration: {
    participants: string
    description: string
    // Epoch ms, null while no day is recorded.
    date: number | null
    // The parties' own synpunkter, null while none are recorded.
    remarks: string | null
  } | null
  locked: boolean
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
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tForm = useTranslations("dashboard.payMapping.analysisForm")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const { orgId } = useOrganization()
  const setCollaboration = useMutation(
    api.payMapping.runs.setPayMappingCollaboration
  )
  const participantsId = useId()
  const descriptionId = useId()
  const remarksId = useId()

  const [participants, setParticipants] = useState(
    () => collaboration?.participants ?? ""
  )
  const [description, setDescription] = useState(
    () => collaboration?.description ?? ""
  )
  const [remarks, setRemarks] = useState(() => collaboration?.remarks ?? "")
  const [date, setDate] = useState(() => dateToIso(collaboration?.date))
  const participantsRef = useRef<HTMLTextAreaElement | null>(null)
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const remarksRef = useRef<HTMLTextAreaElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The trimmed values known to be persisted (the last successful save, or
  // the last prop value accepted into local state): a single ref, not one
  // per field, because the fields save together as one mutation call.
  const lastSavedRef = useRef({
    participants: (collaboration?.participants ?? "").trim(),
    description: (collaboration?.description ?? "").trim(),
    remarks: (collaboration?.remarks ?? "").trim(),
    date: dateToIso(collaboration?.date),
  })
  // Mirrors of the fields for the debounced/blur save (the timer can fire
  // well after the render that scheduled it, and a blur on one field must
  // still carry the other fields' latest values).
  const participantsRefValue = useRef(participants)
  participantsRefValue.current = participants
  const descriptionRefValue = useRef(description)
  descriptionRefValue.current = description
  const remarksRefValue = useRef(remarks)
  remarksRefValue.current = remarks
  const dateRefValue = useRef(date)
  dateRefValue.current = date

  const propParticipants = collaboration?.participants ?? ""
  const propDescription = collaboration?.description ?? ""
  const propRemarks = collaboration?.remarks ?? ""
  const propDate = collaboration?.date ?? null
  // Re-seeds from the subscription whenever the ROW'S OWN VALUES change,
  // never on the collaboration object's identity, and never while any field
  // is dirty (an in-flight edit not yet saved) or focused: same guard as the
  // group form's note re-seed, applied to the set. The date needs no focus
  // guard: a popover trigger is never left focused mid-edit the way a
  // textarea is, and a pick saves immediately.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the row's own scalar values (see comment above), not collaboration identity or the setters
  useEffect(() => {
    const isDirty =
      participants.trim() !== lastSavedRef.current.participants ||
      description.trim() !== lastSavedRef.current.description ||
      remarks.trim() !== lastSavedRef.current.remarks ||
      date !== lastSavedRef.current.date
    if (isDirty) return

    lastSavedRef.current = {
      participants: propParticipants.trim(),
      description: propDescription.trim(),
      remarks: propRemarks.trim(),
      date: dateToIso(propDate),
    }
    setDate(dateToIso(propDate))
    const isFocused = (element: HTMLTextAreaElement | null) =>
      element !== null && element.ownerDocument.activeElement === element
    if (!isFocused(participantsRef.current)) setParticipants(propParticipants)
    if (!isFocused(descriptionRef.current)) setDescription(propDescription)
    if (!isFocused(remarksRef.current)) setRemarks(propRemarks)
  }, [propParticipants, propDescription, propRemarks, propDate])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  async function saveNow() {
    const current = {
      participants: participantsRefValue.current,
      description: descriptionRefValue.current,
      remarks: remarksRefValue.current,
      date: dateRefValue.current,
    }
    const trimmed = {
      participants: current.participants.trim(),
      description: current.description.trim(),
      remarks: current.remarks.trim(),
      date: current.date,
    }
    // Nothing changed since the last save (or the last accepted prop value):
    // skip the no-op mutation (and its audit row).
    if (
      trimmed.participants === lastSavedRef.current.participants &&
      trimmed.description === lastSavedRef.current.description &&
      trimmed.remarks === lastSavedRef.current.remarks &&
      trimmed.date === lastSavedRef.current.date
    )
      return
    try {
      await setCollaboration({
        orgId,
        runId,
        participants: current.participants,
        description: current.description,
        // An omitted date clears the stored day, which is what an empty
        // picker means; the same for an emptied remarks field.
        ...(current.date === "" ? {} : { date: isoToMs(current.date) }),
        ...(trimmed.remarks === "" ? {} : { remarks: current.remarks }),
      })
      lastSavedRef.current = trimmed
    } catch (error) {
      toast.error(
        isRunCompletedError(error)
          ? tErrors("payMappingRunCompleted")
          : tToast("error")
      )
    }
  }

  function scheduleSave() {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void saveNow()
    }, SAVE_DEBOUNCE_MS)
  }

  function handleBlur() {
    if (locked) return
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    void saveNow()
  }

  const bothFilled = participants.trim() !== "" && description.trim() !== ""

  // The step's own work is finished and the section already offers the way
  // on, so its primary would be a second control for one destination.
  const finished = bothFilled || continuationShown

  const stepActions = {
    onPrevious,
    onSkip,
    primaryLabel: finished ? undefined : t("continue"),
    onPrimary: finished ? undefined : onNext,
    hint: bothFilled ? undefined : t("collaborationHint"),
  }

  return (
    // The step IS the frame: its header carries the journey's opening
    // heading and the chapter's statutory duty as the help beside it, the
    // samverkan record is its one panel, and the step's actions sit in the
    // frame's foot under it.
    //
    // It used to open with three paragraphs on what a pay mapping is and how
    // its annual cycle runs. That is framing prose: the reader is inside a
    // run, in a chapter the sidebar names, on a step whose heading and help
    // say the same thing, and the sentences described the surface instead of
    // asking anything of it.
    <FrameCard
      size="lg"
      title={t("introTitle")}
      titleLevel={headingLevel}
      // An empty action row still holds its footer's height, so the footer
      // is passed only when the row would draw something.
      footer={
        hasStepActions(stepActions) ? (
          <ReviewStepActions {...stepActions} />
        ) : undefined
      }
    >
      <FrameCardSection
        title={t("collaborationTitle")}
        help={
          <HelpMorphButton label={tHelp("collaborationLabel")}>
            {tHelp("collaborationBody")}
          </HelpMorphButton>
        }
      >
        {locked && (
          <p className="text-muted-foreground text-sm">{tForm("lockedHint")}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor={participantsId}>
            {t("collaborationParticipants")}
          </Label>
          <Textarea
            id={participantsId}
            ref={participantsRef}
            className={REVIEW_NOTE_FIELD_CLASS}
            value={participants}
            disabled={locked}
            onChange={(event) => {
              if (locked) return
              setParticipants(event.target.value)
              scheduleSave()
            }}
            onBlur={handleBlur}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={descriptionId}>{t("collaborationDescription")}</Label>
          <Textarea
            id={descriptionId}
            ref={descriptionRef}
            className={REVIEW_NOTE_FIELD_CLASS}
            value={description}
            disabled={locked}
            onChange={(event) => {
              if (locked) return
              setDescription(event.target.value)
              scheduleSave()
            }}
            onBlur={handleBlur}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={remarksId}>{t("collaborationRemarks")}</Label>
          <Textarea
            id={remarksId}
            ref={remarksRef}
            className={REVIEW_NOTE_FIELD_CLASS}
            value={remarks}
            disabled={locked}
            onChange={(event) => {
              if (locked) return
              setRemarks(event.target.value)
              scheduleSave()
            }}
            onBlur={handleBlur}
          />
        </div>

        <div className="space-y-2">
          {/* No htmlFor: the picker's trigger carries its own accessible
                name (ariaLabel), so the visible label is plain text. */}
          <Label>{t("collaborationDate")}</Label>
          <DatePicker
            value={date}
            disabled={locked}
            onChange={(value) => {
              setDate(value)
              // A pick is a deliberate act: save it now, not after the
              // text fields' debounce.
              if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
              }
              dateRefValue.current = value
              void saveNow()
            }}
            ariaLabel={t("collaborationDate")}
          />
        </div>
      </FrameCardSection>
    </FrameCard>
  )
}
