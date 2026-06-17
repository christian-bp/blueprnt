"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import type { FunctionReturnType } from "convex/server"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { authClient } from "@/lib/auth-client"
import { resolveActiveOrgId } from "@/lib/active-org"

type Status = NonNullable<
  FunctionReturnType<typeof api.accounts.onboarding.getOnboardingStatus>
>

function GateSpinner(props: { label: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner aria-label={props.label} />
    </main>
  )
}

// Resolves the active company (Better Auth's session.activeOrganizationId) and
// scopes the gate to it. Switching companies re-runs getOnboardingStatus and,
// through OrganizationProvider, re-scopes every org query reactively.
export function OnboardingGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.onboarding")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const orgList = orgs.data ?? null
  const activeId = resolveActiveOrgId(active.data?.id, orgList)

  // Persist a default active company when none is set, so
  // session.activeOrganizationId is always populated on the next load.
  useEffect(() => {
    const first = orgList?.[0]
    if (active.data == null && first) {
      void authClient.organization.setActive({
        organizationId: first.id,
      })
    }
  }, [active.data, orgList])

  const status = useQuery(
    api.accounts.onboarding.getOnboardingStatus,
    activeId !== null ? { orgId: activeId } : "skip"
  )

  // Memberships still loading.
  if (orgList === null) return <GateSpinner label={t("loading")} />
  // Signed in but provisioned into no company yet (rare: provisioning is
  // back-office and signup is disabled). Nothing to render.
  if (orgList.length === 0) return null
  // Active company resolved, its status query still loading.
  if (status === undefined || status === null) {
    return <GateSpinner label={t("loading")} />
  }

  // Keyed by the active company so switching resets the wizard-ownership state.
  return (
    <OnboardingSession key={activeId ?? "none"} status={status}>
      {props.children}
    </OnboardingSession>
  )
}

// First-run gate for one company: holds the user in the wizard until the
// organization, its settings, and model exist AND setup was explicitly
// finished. The wizard OWNS the session once started (it stays mounted even
// after hasModel flips, so the model review and AI panels are not skipped)
// until it calls onFinished. Completion is explicit server state
// (status.completed), never inferred from hasModel.
function OnboardingSession(props: { status: Status; children: ReactNode }) {
  const { status } = props
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionFinished, setSessionFinished] = useState(false)
  const incomplete =
    status.organization === null ||
    !status.settingsComplete ||
    !status.hasModel ||
    !status.completed
  useEffect(() => {
    if (incomplete) setSessionStarted(true)
  }, [incomplete])

  const showWizard = incomplete || (sessionStarted && !sessionFinished)
  if (!showWizard) {
    // completed implies the organization exists; null here would be a server
    // bug, so degrade to nothing rather than crash the shell.
    if (status.organization === null) return null
    return (
      <AppShell
        organization={{
          orgId: status.organization.orgId,
          name: status.organization.name,
          role: status.organization.role,
        }}
      >
        {props.children}
      </AppShell>
    )
  }
  return (
    <OnboardingWizard
      status={status}
      onFinished={() => setSessionFinished(true)}
    />
  )
}
