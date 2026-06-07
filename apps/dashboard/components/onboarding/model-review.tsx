"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { MIN_CRITERIA } from "@workspace/core"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { ModelEditor } from "@/components/model/model-editor"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { NextButton } from "@/components/onboarding/next-button"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { capitalizeFirst } from "@/lib/capitalize"

// Screen 5 (template path): the shared ModelEditor renders the criteria list
// (read-only with an Edit toggle for the zero-sum weighting, removal, and the
// add dialog) plus the AI weight review panel. The continue/change-choice
// footer is always present; Continue is gated on the composition floor
// (MIN_CRITERIA), since removal is free while onboarding. Continue hands
// control back to the wizard (onContinue), which advances to the families
// screen; completion happens there, not here.
export function ModelReview({
  orgId,
  organizationName,
  onContinue,
  onChangeChoice,
}: {
  orgId: string
  organizationName: string
  onContinue: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.model.review")
  const tEditor = useTranslations("dashboard.model.editor")
  // Same args as ModelEditor's internal query, so the subscription is shared.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const criteriaCount = model?.criteria.length ?? 0

  return (
    <ScreenShell
      // A name-first heading starts with the name as typed; heading
      // typography still wants a capital ("acme's model" -> "Acme's model").
      heading={capitalizeFirst(
        t("heading", { name: organizationName }),
        locale
      )}
      description={t("description")}
    >
      <div className="w-full space-y-6">
        <ModelEditor orgId={orgId} withAiReview />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onChangeChoice && (
              <ChangeChoiceButton onConfirm={onChangeChoice} />
            )}
          </div>
          {/* The floor hint sits inside the footer row, so its appearance
              never shifts the layout vertically. */}
          {model != null && criteriaCount < MIN_CRITERIA && (
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground text-sm">
              {tEditor("minCriteriaHint", { min: MIN_CRITERIA })}
            </span>
          )}
          <NextButton
            disabled={model == null || criteriaCount < MIN_CRITERIA}
            onClick={onContinue}
          />
        </div>
      </div>
    </ScreenShell>
  )
}
