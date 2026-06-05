"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { DashboardShell } from "@/components/dashboard-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

// First-run gate: holds the user in the onboarding wizard until the
// organization, its settings, and evaluation model exist AND the user has
// explicitly finished setup. Reactive: each completed step flips the status
// query and advances the UI.
//
// Completion is explicit server state (status.completed, backed by the audited
// completeOnboarding mutation), never inferred from hasModel: creating a model
// without finishing must keep the wizard, so a reload resumes setup rather than
// dropping into the dashboard.
//
// The session-ownership logic stays for in-session continuity: hasModel flips
// reactively the moment the model row is created, which would unmount the
// wizard mid-flow and skip the model review screen and the AI panels. The
// wizard therefore OWNS the session once it has started: it stays mounted
// (even after hasModel turns true) until it calls onFinished. On a later
// sign-in the session never starts and the dashboard renders directly.
export function OnboardingGate() {
  const t = useTranslations("dashboard.onboarding")
  const status = useQuery(api.accounts.onboarding.getOnboardingStatus)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionFinished, setSessionFinished] = useState(false)
  const incomplete =
    status !== undefined &&
    status !== null &&
    (status.organization === null ||
      !status.settingsComplete ||
      !status.hasModel ||
      !status.completed)
  useEffect(() => {
    if (incomplete) setSessionStarted(true)
  }, [incomplete])

  // Sign-out resets everything: <Authenticated> in page.tsx unmounts the gate.
  if (status === undefined || status === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </main>
    )
  }
  const showWizard = incomplete || (sessionStarted && !sessionFinished)
  if (!showWizard) return <DashboardShell />
  return (
    <OnboardingWizard
      status={status}
      onFinished={() => setSessionFinished(true)}
    />
  )
}
