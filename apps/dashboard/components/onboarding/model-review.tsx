"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ModelEditor } from "@/components/model/model-editor"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"

// Step 4: template path landing. The shared ModelEditor renders the criteria
// list (read-only with an Edit toggle for importance, removal, and the add
// dialog) plus the AI importance review panel. The finish/back/change-choice
// footer is always present.
//
// onBack is optional. When provided (resume path: the user landed here directly
// without having gone through the choice screen in this session), a back button
// is rendered to the left of the finish button so the user can return to the
// profile step. Model creation is already done at this point, but re-choosing
// the model is not needed to reach the profile step, so back is safe.
export function ModelReview({
  orgId,
  onFinished,
  onBack,
  onChangeChoice,
}: {
  orgId: string
  onFinished: () => void
  onBack?: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.model.review")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tError = useTranslations("dashboard.model")
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )
  const [completing, setCompleting] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-lg">{t("heading")}</h2>
      <ModelEditor orgId={orgId} withAiReview />
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {tError("error")}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              {tOnboarding("back")}
            </Button>
          ) : (
            <span />
          )}
          {onChangeChoice && <ChangeChoiceButton onConfirm={onChangeChoice} />}
        </div>
        <Button
          disabled={completing}
          onClick={async () => {
            setCompleting(true)
            setFailed(false)
            try {
              await completeOnboarding({ orgId })
              onFinished()
            } catch {
              setFailed(true)
              setCompleting(false)
            }
          }}
        >
          {t("cta")}
        </Button>
      </div>
    </div>
  )
}
