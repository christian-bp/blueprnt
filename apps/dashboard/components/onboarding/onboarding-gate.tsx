"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { LoadingScreen } from "@/components/loading-screen"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { authClient } from "@/lib/auth-client"
import { resolveActiveOrgId } from "@/lib/active-org"

type Status = NonNullable<
  FunctionReturnType<typeof api.accounts.onboarding.getOnboardingStatus>
>

// Resolves the active company (Better Auth's session.activeOrganizationId) and
// scopes the gate to it. Switching companies re-runs getOnboardingStatus and,
// through OrganizationProvider, re-scopes every org query reactively.
export function OnboardingGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.onboarding")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const orgList = orgs.data ?? null
  // Nothing is decided until the active-organization query settles: while it
  // is in flight its data is null, and resolving that would fall back to the
  // first membership and scope the whole shell to the wrong company for a
  // beat.
  //
  // The resolution is LATCHED on the last settled (non-pending) answer, like
  // AuthGate: a fresh login starts a session with no active company, so the
  // gate settles on the first membership and shows the app while the effect
  // below persists that default. Better Auth answers set-active by refetching
  // the active-organization query, and because its data is still null the
  // store reports isPending: true again for that beat. Deciding on the live
  // isPending swapped the whole app for the loading screen, a visible
  // split-second "reload" right after the overview appeared. Holding the last
  // settled value keeps the app mounted; only a newly settled resolution (a
  // real company switch) may change it. Written during render (an idempotent
  // write), mirroring AuthGate.
  const settled = useRef<{ activeId: string | null } | null>(null)
  if (!active.isPending && orgList !== null) {
    settled.current = { activeId: resolveActiveOrgId(active.data?.id, orgList) }
  }
  const activeId = settled.current === null ? null : settled.current.activeId

  // Persist a default active company when none is set, so
  // session.activeOrganizationId is always populated on the next load.
  //
  // Gated on isPending, not just on data being absent. The active-organization
  // query reports data: null WHILE IT IS STILL IN FLIGHT, which is
  // indistinguishable from "no active company" by data alone, so on every
  // reload this wrote the first company in the list over whatever the user
  // had actually selected. That is why switching company and reloading came
  // back on the first one.
  useEffect(() => {
    if (active.isPending) return
    const first = orgList?.[0]
    if (active.data == null && first) {
      void authClient.organization.setActive({
        organizationId: first.id,
      })
    }
  }, [active.data, active.isPending, orgList])

  const status = useQuery(
    api.accounts.onboarding.getOnboardingStatus,
    activeId !== null ? { orgId: activeId } : "skip"
  )

  // Memberships, or the first settle of which of them is active, still
  // loading. After the first settle a transient refetch never lands here: the
  // latched resolution keeps the app mounted.
  if (orgList === null || settled.current === null) {
    return <LoadingScreen label={t("loading")} />
  }
  // Signed in but provisioned into no company yet (rare: provisioning is
  // back-office and signup is disabled). Nothing to render.
  if (orgList.length === 0) return null
  // Active company resolved, its status query still loading.
  if (status === undefined || status === null) {
    return <LoadingScreen label={t("loading")} />
  }

  // Keyed by the active company so switching resets the wizard-ownership state.
  return (
    <OnboardingSession key={activeId ?? "none"} status={status}>
      {props.children}
    </OnboardingSession>
  )
}

// First-run gate for one company: holds the user in the wizard until the
// organization and its settings exist AND setup was explicitly finished. The
// wizard OWNS the session once started so it stays mounted to the end even as
// derived signals flip mid-flow, until it calls onFinished. Completion is
// explicit server state (status.completed), never inferred. hasModel is a
// defensive guard: the default model is seeded during the families step, so a
// completed org always has one; the check only bites if that ever failed.
function OnboardingSession(props: { status: Status; children: ReactNode }) {
  const { status } = props
  const router = useRouter()
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
      onFinished={() => {
        setSessionFinished(true)
        // The wizard never changes the URL while it runs (it is entirely
        // state-driven), so whatever route the browser carried into the
        // session is still current when it ends. A deep link into the model
        // section (an admin invite, a stale bookmark) would otherwise drop a
        // just-onboarded admin straight into the model editor instead of the
        // overview; finishing always exits to the overview explicitly.
        router.push("/")
      }}
    />
  )
}
