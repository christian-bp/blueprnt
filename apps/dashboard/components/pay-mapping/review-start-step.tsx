"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { ScreenShell } from "@/components/screen-shell"
import { isRunCompletedError } from "@/lib/pay-mapping-errors"
import { ReviewStepActions } from "./review-step-actions"

const SAVE_DEBOUNCE_MS = 800

// The journey's first step: plain-language intro (what a pay mapping is,
// the annual cycle, that this journey produces the statutory documentation)
// plus the samverkansredogörelse (11-12 §§): who took part in the samverkan
// and how. The two fields feed ONE mutation together
// (setPayMappingCollaboration always takes both), so the guarded save
// mirrors PayMappingGroupAnalysisForm with the lastSaved ref keyed on the
// PAIR rather than per field: an edit to either field saves the CURRENT
// value of both. "Fortsätt" never blocks navigation; the gate itself (both
// fields non-empty) is only ever stated as a muted hint, never a disabled
// primary action.
export function ReviewStartStep({
  runId,
  collaboration,
  locked,
  animated,
  headingLevel = "h1",
  onNext,
  onPrevious,
  onSkip,
}: {
  runId: Id<"payMappingRuns">
  collaboration: { participants: string; description: string } | null
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
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const tErrors = useTranslations("errors")
  const { orgId } = useOrganization()
  const setCollaboration = useMutation(
    api.payMapping.runs.setPayMappingCollaboration
  )
  const participantsId = useId()
  const descriptionId = useId()

  const [participants, setParticipants] = useState(
    () => collaboration?.participants ?? ""
  )
  const [description, setDescription] = useState(
    () => collaboration?.description ?? ""
  )
  const participantsRef = useRef<HTMLTextAreaElement | null>(null)
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The trimmed pair known to be persisted (the last successful save, or the
  // last prop value accepted into local state): a single ref, not one per
  // field, because the two fields save together as one mutation call.
  const lastSavedRef = useRef({
    participants: (collaboration?.participants ?? "").trim(),
    description: (collaboration?.description ?? "").trim(),
  })
  // Mirrors of the two fields for the debounced/blur save (the timer can
  // fire well after the render that scheduled it, and a blur on one field
  // must still carry the other field's latest typed value).
  const participantsRefValue = useRef(participants)
  participantsRefValue.current = participants
  const descriptionRefValue = useRef(description)
  descriptionRefValue.current = description

  const propParticipants = collaboration?.participants ?? ""
  const propDescription = collaboration?.description ?? ""
  // Re-seeds from the subscription whenever the ROW'S OWN VALUES change,
  // never on the collaboration object's identity, and never while either
  // field is dirty (an in-flight edit not yet saved) or focused: same guard
  // as the group form's note re-seed, applied to the pair.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the row's own scalar values (see comment above), not collaboration identity or the setters
  useEffect(() => {
    const isDirty =
      participants.trim() !== lastSavedRef.current.participants ||
      description.trim() !== lastSavedRef.current.description
    if (isDirty) return

    lastSavedRef.current = {
      participants: propParticipants.trim(),
      description: propDescription.trim(),
    }
    const isParticipantsFocused =
      participantsRef.current !== null &&
      participantsRef.current.ownerDocument.activeElement ===
        participantsRef.current
    const isDescriptionFocused =
      descriptionRef.current !== null &&
      descriptionRef.current.ownerDocument.activeElement ===
        descriptionRef.current
    if (!isParticipantsFocused) setParticipants(propParticipants)
    if (!isDescriptionFocused) setDescription(propDescription)
  }, [propParticipants, propDescription])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  async function saveNow() {
    const current = {
      participants: participantsRefValue.current,
      description: descriptionRefValue.current,
    }
    const trimmed = {
      participants: current.participants.trim(),
      description: current.description.trim(),
    }
    // Nothing changed since the last save (or the last accepted prop value):
    // skip the no-op mutation (and its audit row).
    if (
      trimmed.participants === lastSavedRef.current.participants &&
      trimmed.description === lastSavedRef.current.description
    )
      return
    try {
      await setCollaboration({
        orgId,
        runId,
        participants: current.participants,
        description: current.description,
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

  return (
    <ScreenShell
      heading={t("introTitle")}
      animated={animated}
      headingLevel={headingLevel}
      align="start"
    >
      {/* Left-aligned, as the intro copy and the collaboration form were in
          the Card they replace: an explicit w-full opts this block out of
          ScreenShell's own centered/shrink-wrapped content alignment. */}
      <div className="w-full space-y-4">
        <p className="text-base text-muted-foreground">{t("introBody")}</p>
        <p className="text-base text-muted-foreground">{t("cycleBody")}</p>
        <p className="text-muted-foreground text-sm">{t("autosaveHint")}</p>

        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm">{t("collaborationTitle")}</p>
            <HelpMorphButton label={tHelp("collaborationLabel")}>
              {tHelp("collaborationBody")}
            </HelpMorphButton>
          </div>

          {locked && (
            <p className="text-muted-foreground text-sm">
              {tForm("lockedHint")}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor={participantsId}>
              {t("collaborationParticipants")}
            </Label>
            <Textarea
              id={participantsId}
              ref={participantsRef}
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
            <Label htmlFor={descriptionId}>
              {t("collaborationDescription")}
            </Label>
            <Textarea
              id={descriptionId}
              ref={descriptionRef}
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
        </div>
      </div>
      <ReviewStepActions
        onPrevious={onPrevious}
        onSkip={onSkip}
        primaryLabel={t("continue")}
        onPrimary={onNext}
        hint={bothFilled ? undefined : t("collaborationHint")}
      />
    </ScreenShell>
  )
}
