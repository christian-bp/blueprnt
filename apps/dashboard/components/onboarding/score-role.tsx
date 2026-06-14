"use client"

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"

// One role's inline scoring inside the wizard: profile capture (the two
// mandatory fields), then the blind RatingStepper (auto-saves per criterion),
// then the RatingResult reveal. "Back to your roles" returns to the list. The
// stepper and result are reused unchanged.
export function ScoreRole({
  orgId,
  roleId,
  onDone,
}: {
  orgId: string
  roleId: string
  // Called when the user leaves the role (after the reveal) back to the list.
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.score")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const updateRole = useMutation(api.assessment.roles.updateRole)

  const [purpose, setPurpose] = useState("")
  const [responsibilities, setResponsibilities] = useState("")
  const [savedProfile, setSavedProfile] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Re-sync the capture fields whenever the role's stored values change, not
  // just once. The null sentinel means "never synced yet". Adjust-state-
  // during-render (the same idiom the wizard uses for `acked`): the guards go
  // false on the next pass. role.purpose only changes via (a) this component's
  // own updateRole save (local state already equals it, so the re-sync is a
  // no-op) or (b) an external AI prefill (the families step generates the
  // profile from the title and patches the role, and we WANT the textarea to
  // follow the prefilled value). A user who typed locally without saving is
  // never clobbered: role.purpose has not moved.
  const [lastSyncedPurpose, setLastSyncedPurpose] = useState<string | null>(
    null
  )
  const [lastSyncedResponsibilities, setLastSyncedResponsibilities] = useState<
    string | null
  >(null)

  // Enter saves and continues from the profile review screen (the matching Kbd
  // hint sits on the Continue button). The ref bridges to a key handler bound
  // once below; it is set ONLY on the review screen and cleared on every other
  // render, so Enter never fires during the stepper phase (the stepper owns its
  // own Enter shortcut) nor while an editable field is focused.
  const continueRef = useRef<{
    canContinue: boolean
    pending: boolean
    submit: () => void
  } | null>(null)
  continueRef.current = null

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const handler = continueRef.current
      if (handler === null) return
      if (event.key !== "Enter") return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      if (target instanceof HTMLElement && target.closest("button") !== null) {
        return
      }
      if (!handler.canContinue || handler.pending) return
      event.preventDefault()
      handler.submit()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  if (role !== undefined && role !== null) {
    if (role.purpose !== lastSyncedPurpose) {
      setLastSyncedPurpose(role.purpose)
      setPurpose(role.purpose)
    }
    if (role.responsibilities !== lastSyncedResponsibilities) {
      setLastSyncedResponsibilities(role.responsibilities)
      setResponsibilities(role.responsibilities)
    }
  }

  if (role === undefined || model === undefined) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner aria-label={tOnboarding("loading")} />
      </div>
    )
  }
  if (role === null || model === null) return null

  if (finished) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <RatingResult orgId={orgId} roleId={roleId} />
        <Button type="button" variant="outline" onClick={onDone}>
          {t("backToRolesCta")}
        </Button>
      </div>
    )
  }

  // The profile review/capture step: always shown when opening a role to score
  // (until the user continues past it), so the prefilled purpose +
  // responsibilities are a review-and-edit step rather than a hidden value.
  // Profiles are prefilled on the families step; when prefill failed the fields
  // are empty and this is the manual fallback. The heading/hint adapt to which
  // case it is (review the draft vs. describe from scratch).
  if (!savedProfile) {
    const prefilled = role.profileComplete
    const canContinue =
      purpose.trim().length > 0 && responsibilities.trim().length > 0

    // Persist the reviewed profile (skipping a no-op write when nothing changed,
    // the common prefilled case) and advance to the stepper. Shared by the
    // Continue button and the Enter shortcut.
    const continueToEvaluation = async () => {
      const nextPurpose = purpose.trim()
      const nextResponsibilities = responsibilities.trim()
      if (
        nextPurpose === role.purpose &&
        nextResponsibilities === role.responsibilities
      ) {
        setSavedProfile(true)
        return
      }
      setPending(true)
      setFailed(false)
      try {
        await updateRole({
          orgId,
          roleId: role.roleId,
          purpose: nextPurpose,
          responsibilities: nextResponsibilities,
        })
        setSavedProfile(true)
      } catch {
        setFailed(true)
      } finally {
        setPending(false)
      }
    }

    continueRef.current = {
      canContinue,
      pending,
      submit: () => {
        void continueToEvaluation()
      },
    }

    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-lg">
            {/* The role title is the derived value: brand only it (the <brand>
                tag in the message), the static words stay default color. */}
            {prefilled
              ? t.rich("captureHeadingPrefilled", {
                  title: role.title,
                  brand: (chunks) => (
                    <span className="text-brand">{chunks}</span>
                  ),
                })
              : t.rich("captureHeading", {
                  title: role.title,
                  brand: (chunks) => (
                    <span className="text-brand">{chunks}</span>
                  ),
                })}
          </h2>
          <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
            {tHelp("onboardingScoreBody")}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">
          {prefilled ? t("captureHintPrefilled") : t("captureHint")}
        </p>
        <div className="space-y-2">
          <Label htmlFor="score-role-purpose">{t("purposeLabel")}</Label>
          <Textarea
            id="score-role-purpose"
            value={purpose}
            rows={3}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="score-role-responsibilities">
              {t("responsibilitiesLabel")}
            </Label>
            <span className="text-muted-foreground text-xs">
              {t("responsibilitiesHint")}
            </span>
          </div>
          <Textarea
            id="score-role-responsibilities"
            value={responsibilities}
            rows={3}
            onChange={(event) => setResponsibilities(event.target.value)}
          />
        </div>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("saveError")}
          </p>
        )}
        {/* Footer: back to the list on the left, the forward action on the
            right (the standard wizard/dialog footer; the stepper phase keeps
            its top back link since RatingStepper owns its own Back/Next row). */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onDone}>
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
            {t("backToRolesCta")}
          </Button>
          <Button
            type="button"
            disabled={!canContinue || pending}
            onClick={continueToEvaluation}
          >
            {t("captureContinueCta")}
            <Kbd
              data-icon="inline-end"
              aria-hidden="true"
              className="translate-x-0.5"
            >
              ⏎
            </Kbd>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
        {t("backToRolesCta")}
      </Button>
      <h2 className="font-medium text-lg">
        {t.rich("assessmentHeading", {
          title: role.title,
          brand: (chunks) => <span className="text-brand">{chunks}</span>,
        })}
      </h2>
      <RatingStepper
        orgId={orgId}
        roleId={role.roleId}
        criteria={model.criteria}
        ratings={role.ratings}
        onCompleted={() => setFinished(true)}
      />
    </div>
  )
}
