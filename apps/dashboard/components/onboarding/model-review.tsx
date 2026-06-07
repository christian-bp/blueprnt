"use client"

import { useTranslations } from "next-intl"
import { ModelEditor } from "@/components/model/model-editor"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { NextButton } from "@/components/onboarding/next-button"
import { ScreenShell } from "@/components/onboarding/screen-shell"

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

  return (
    <ScreenShell heading={t("heading")} description={t("description")}>
      <div className="w-full space-y-6">
        <ModelEditor orgId={orgId} withAiReview />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onChangeChoice && (
              <ChangeChoiceButton onConfirm={onChangeChoice} />
            )}
          </div>
          <NextButton onClick={onContinue} />
        </div>
      </div>
    </ScreenShell>
  )
}
