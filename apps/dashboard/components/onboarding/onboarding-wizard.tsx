"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { ModelSetupStep } from "@/components/onboarding/model-setup-step"
import { OnboardingHeader } from "@/components/onboarding/onboarding-header"
import { OrganizationSetupStep } from "@/components/onboarding/organization-setup-step"

export interface OnboardingStatus {
  organization: { orgId: string; name: string; role: string } | null
  settingsComplete: boolean
  hasModel: boolean
  // Explicit completion state from the server (set by completeOnboarding). The
  // derived step below stays based on organization/settingsComplete/hasModel;
  // completed only gates whether the dashboard unlocks, in the gate.
  completed: boolean
}

// Typed i18n keys are active (i18n-env.d.ts): the translator only accepts
// literal key unions, so step labels go through a literal-keyed map instead
// of a template string.
const STEP_LABEL_KEYS = ["steps.organization", "steps.model"] as const

export function OnboardingWizard({
  status,
  onFinished,
}: {
  status: OnboardingStatus
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding")
  // The wizard is two steps. Step 1 is the merged organization setup (name,
  // default language, country, currency, industry); step 2 is the model setup.
  // The step is derived from server state: no organization or incomplete
  // settings keep the user on step 1; complete settings advance to step 2.
  // Back-navigation overlays a revisited step 1 in edit mode without mutating
  // the derived state.
  const derived =
    status.organization === null || !status.settingsComplete ? 1 : 2
  const [backTo, setBackTo] = useState<1 | null>(null)
  // Effective step. The min-style guard neutralizes a stale backTo: once the
  // derived step advances past (or to) backTo, the revisit is dropped and the
  // derived step shows again.
  const current = backTo !== null && backTo < derived ? backTo : derived

  // Members who are not admins cannot run setup mutations; tell them to wait.
  if (status.organization !== null && status.organization.role !== "admin") {
    return (
      <>
        <OnboardingHeader />
        <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
          <p className="text-muted-foreground">{t("waitingForAdmin")}</p>
        </main>
      </>
    )
  }

  return (
    <>
      <OnboardingHeader />
      {/* justify-center centers the wizard vertically; when the content is
          taller than the viewport the container grows and it top-flows. */}
      <main className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-center">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6 md:p-10">
          <header className="space-y-2">
            <h1 className="font-semibold text-2xl">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("step", { current, total: STEP_LABEL_KEYS.length })}{" "}
              {t(STEP_LABEL_KEYS[(current - 1) as 0 | 1])}
            </p>
          </header>
          {current === 1 && (
            // existing is passed straight from status.organization, which handles
            // fresh-create (null) vs revisit/partial (non-null) uniformly. A
            // successful save in edit mode clears backTo so the derived step 2
            // shows again.
            <OrganizationSetupStep
              existing={
                status.organization === null
                  ? null
                  : {
                      orgId: status.organization.orgId,
                      name: status.organization.name,
                    }
              }
              onDone={() => setBackTo(null)}
            />
          )}
          {current === 2 && status.organization !== null && (
            <ModelSetupStep
              orgId={status.organization.orgId}
              onFinished={onFinished}
              onBack={() => setBackTo(1)}
            />
          )}
        </div>
      </main>
    </>
  )
}
