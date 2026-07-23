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
  usePageTitle(run?.label)

  // /pay-mappings/<slug>[/<sub>...] -> the sub-page's tab key. Deriving it
  // from the pathname (the shell lives in the persistent [slug] layout, so
  // no page can pass it) keeps the title in the standard PageHeader slot.
  const [, , sub] = pathname.split("/").filter(Boolean)
  // The /review takeover (PayMappingReview) is a fixed, full-viewport
  // overlay with its own complete chrome (WizardShell); it only visually
  // covers this shell's PageHeader, which stays in the DOM underneath it,
  // reachable by keyboard/screen reader and mislabeled "Overview"
  // (payMappingSubPageKey has no "review" entry, so it falls back). Render
  // no chrome element at all here on that sub-route: nothing to hide means
  // nothing left in the accessibility tree.
  const isReviewTakeover = sub === "review"

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

  if (isReviewTakeover) {
    return (
      <PayMappingRunProvider value={{ run, gap, analyses }}>
        {children}
      </PayMappingRunProvider>
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
      <PayMappingRunProvider value={{ run, gap, analyses }}>
        {children}
      </PayMappingRunProvider>
    </div>
  )
}
