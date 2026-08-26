"use client"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"
import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useOrganization } from "@/components/org-context"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { BreadcrumbSlotProvider } from "@/components/page-breadcrumb-slots"
import { usePageTitle } from "@/hooks/use-page-title"
import { chapterSegment, currentChapter } from "./analysis-chapters"
import { PayMappingRunProvider } from "./pay-mapping-run-context"
import { payMappingSubPageKey } from "./run-sidebar"

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
  const tNav = useTranslations("dashboard.nav")
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
  // no page can pass it) keeps the name in the breadcrumb row.
  const [, , sub] = pathname.split("/").filter(Boolean)
  const analysisChapter = currentChapter(pathname)
  if (run === null) {
    // Match the roles detail precedent: the register crumb above an Empty
    // stating the miss, with the way back as its action.
    return (
      <div className="space-y-4">
        <PageBreadcrumbRow
          segments={[{ label: tNav("payMapping"), href: "/pay-mappings" }]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{tNav("payMapping")}</EmptyTitle>
            <EmptyDescription>{t("detail.notFound")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/pay-mappings"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("detail.back")}
          </Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* The run sidebar owns the workspace's navigation (the sub-pages and
          the run switcher); this row names where the visitor stands. The run
          label is data, so a skeleton crumb holds its place on first paint. */}
      {/* The analysis section fills this row's slots from its own subtree:
          its concept help after the trail, its journey instrument opposite
          it. The queue both are drawn from lives down there. */}
      <BreadcrumbSlotProvider>
        <PageBreadcrumbRow
          segments={[
            { label: tNav("payMapping"), href: "/pay-mappings" },
            run === undefined ? { skeleton: true } : { label: run.label },
            // On a chapter page the trail ends at the chapter (the sidebar's
            // rows are the nav, so the trail titles what is open), with the
            // Analys crumb linking straight at the first chapter rather than
            // at the bare segment, whose only content is the redirect there.
            ...(analysisChapter === undefined
              ? [{ label: t(`tabs.${payMappingSubPageKey(sub)}`) }]
              : [
                  {
                    label: t("tabs.analysis"),
                    href: `/pay-mappings/${slug}/analysis/${chapterSegment("start")}`,
                  },
                  { label: t(`review.chaptersShort.${analysisChapter}`) },
                ]),
          ]}
        />
        <PayMappingRunProvider
          value={{ run, gap, analyses, actions, notes, runsList }}
        >
          {children}
        </PayMappingRunProvider>
      </BreadcrumbSlotProvider>
    </div>
  )
}
