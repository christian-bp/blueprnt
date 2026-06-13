"use client"

import { AiMagicIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MorphPopover } from "@/components/morph-popover"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"
import { RoleAiPanel } from "@/components/roles/role-ai-panel"

// One role's inline scoring inside the wizard: profile capture (the two
// mandatory fields, with RoleAiPanel hosted in a MorphPopover for a one-click
// AI draft), then the blind RatingStepper (auto-saves per criterion), then the
// RatingResult reveal. "Back to your roles" returns to the list. The stepper,
// result, and AI panel are reused unchanged.
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
  const tAi = useTranslations("dashboard.ai")
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
  // no-op) or (b) an AI accept through the panel (which patches the role and
  // we WANT the textarea to follow the accepted value). A user who typed
  // locally without saving is never clobbered: role.purpose has not moved.
  const [lastSyncedPurpose, setLastSyncedPurpose] = useState<string | null>(
    null
  )
  const [lastSyncedResponsibilities, setLastSyncedResponsibilities] = useState<
    string | null
  >(null)
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

  // The profile gate: the role needs purpose + responsibilities before the
  // blind stepper. A starter role opens empty, so capture comes first.
  if (!role.profileComplete && !savedProfile) {
    const canContinue =
      purpose.trim().length > 0 && responsibilities.trim().length > 0
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-lg">
            {t("captureHeading", { title: role.title })}
          </h2>
          <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
            {tHelp("onboardingScoreBody")}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">{t("captureHint")}</p>
        <div className="flex justify-end">
          {/* The AI draft popover keeps the provenance line always visible
              (ADR-0003). MorphPopover owns its own Radix open state, so typing
              in the capture fields never collapses it. */}
          <MorphPopover
            triggerLabel={tAi("openDraftCta")}
            triggerIcon={AiMagicIcon}
            title={tAi("heading")}
            description={tAi("provenance")}
            closeLabel={tAi("closeLabel")}
          >
            {(close) => (
              <RoleAiPanel orgId={orgId} roleId={role.roleId} onDone={close} />
            )}
          </MorphPopover>
        </div>
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
          <Label htmlFor="score-role-responsibilities">
            {t("responsibilitiesLabel")}
          </Label>
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
            onClick={async () => {
              setPending(true)
              setFailed(false)
              try {
                await updateRole({
                  orgId,
                  roleId: role.roleId,
                  purpose: purpose.trim(),
                  responsibilities: responsibilities.trim(),
                })
                setSavedProfile(true)
              } catch {
                setFailed(true)
              } finally {
                setPending(false)
              }
            }}
          >
            {t("captureContinueCta")}
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
      <h2 className="font-medium text-lg">{role.title}</h2>
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
