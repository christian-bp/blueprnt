"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"
import { PayMappingRunProvider } from "./pay-mapping-run-context"
import { payMappingSubPageKey } from "./pay-mapping-tabs"

// Shared chrome + data for one kartläggning's sub-pages (Overview / Analysis /
// Report, switched via the header tabs). Mounted from the [slug] route layout,
// which persists across sub-page navigation, so the run + gap + documentation
// subscriptions stay alive and switching tabs never re-fetches or flashes a
// skeleton. Read-only throughout (ADR-0011: the snapshot never changes after
// the freeze). The header tabs and the run indicator live in the site header
// and derive from the URL, so they are real static chrome from the first
// paint.
export function PayMappingRunShell({
  slug,
  children,
}: {
  slug: string
  children: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping")
  const pathname = usePathname()
  const { orgId } = useOrganization()

  const run = useQuery(api.payMapping.runs.getPayMappingRunBySlug, {
    orgId,
    slug,
  })
  // The gap aggregate is issued here, once, so the Overview headline and the
  // Analysis tables share a single subscription. It waits for the run (it
  // needs the runId). getPayMappingGap returns null only for a cross-org run,
  // unreachable once `run` resolved in-org, so null maps to undefined (the
  // pages' loading shape) rather than crashing.
  const gapResult = useQuery(
    api.payMapping.gap.getPayMappingGap,
    run === undefined || run === null ? "skip" : { orgId, runId: run.runId }
  )
  const gap = gapResult === null ? undefined : gapResult
  // The documentation rows (objective reasons, deepened analysis, and
  // Klarmarkerad state per equalWork/equivalentWork group): one shared
  // subscription for the Analysis tables and the Overview documentation
  // card, mirroring the gap query's skip-until-resolved pattern.
  const analyses = useQuery(
    api.payMapping.analyses.listGroupAnalyses,
    run === undefined || run === null ? "skip" : { orgId, runId: run.runId }
  )
  // The work layer (actions + notes): same skip-until-resolved pattern, so
  // the detail views' documentation badges and the actions overview share
  // one subscription each.
  const actions = useQuery(
    api.payMapping.actions.listActions,
    run === undefined || run === null ? "skip" : { orgId, runId: run.runId }
  )
  const notes = useQuery(
    api.payMapping.notes.listNotes,
    run === undefined || run === null ? "skip" : { orgId, runId: run.runId }
  )
  // The org's other runs: the review queue needs to know whether an EARLIER
  // run was completed (the "previous actions" praxis area applies only
  // then). Subscribed here so the two surfaces that read the queue share
  // one subscription and one derivation.
  const runsList = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  usePageTitle(run?.label)

  // /pay-mappings/<slug>[/<sub>...] -> the sub-page's tab key. Deriving it
  // from the pathname (the shell lives in the persistent [slug] layout, so
  // no page can pass it) keeps the title in the standard PageHeader slot.
  const [, , sub] = pathname.split("/").filter(Boolean)
  if (run === null) {
    // Match the roles detail precedent: a plain message + back link, no
    // breadcrumb (the error string does not read as a page name in a crumb).
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{t("detail.notFound")}</p>
        <Link
          href="/pay-mappings"
          className="text-sm underline underline-offset-4"
        >
          {t("detail.back")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* No breadcrumb: the site header owns the workspace chrome (the
          sub-page tabs, and the run switcher in the corner carrying the
          run's name, status, and the way back to the list), so the page
          carries only the sub-page's name as its title. Static i18n, real
          from the first paint. */}
      <PageHeader title={t(`tabs.${payMappingSubPageKey(sub)}`)} />
      <PayMappingRunProvider
        value={{ run, gap, analyses, actions, notes, runsList }}
      >
        {children}
      </PayMappingRunProvider>
    </div>
  )
}
