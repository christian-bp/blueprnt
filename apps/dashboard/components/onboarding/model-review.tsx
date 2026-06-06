"use client"

import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import { ModelEditor } from "@/components/model/model-editor"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"

// Screen 5 (template path): the shared ModelEditor renders the criteria list
// (read-only with an Edit toggle for importance, removal, and the add dialog)
// plus the AI importance review panel. The continue/change-choice footer is
// always present. Continue hands control back to the wizard (onContinue), which
// advances to the families screen; completion happens there, not here.
export function ModelReview({
  orgId,
  onContinue,
  onChangeChoice,
}: {
  orgId: string
  onContinue: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.model.review")
  const tScreens = useTranslations("dashboard.onboarding.screens")

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-lg">{t("heading")}</h2>
      <ModelEditor orgId={orgId} withAiReview />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onChangeChoice && <ChangeChoiceButton onConfirm={onChangeChoice} />}
        </div>
        <Button onClick={onContinue}>{tScreens("continueCta")}</Button>
      </div>
    </div>
  )
}
