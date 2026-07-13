"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table } from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { useOrganization } from "@/components/org-context"
import {
  MetaField,
  PayMappingDetail,
  PayMappingRowsHeader,
} from "@/components/pay-mapping/pay-mapping-detail"
import { TableSearchField } from "@/components/table-search-field"
import { TableSkeleton } from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// Content-shaped loading state for the detail page: the same header + card +
// table skeleton as the loaded PayMappingDetail (same column widths on the
// header cells, so nothing reflows when the run resolves).
function PayMappingDetailSkeleton() {
  const t = useTranslations("dashboard.payMapping")
  return (
    <div className="space-y-6">
      <PageHeader
        // The Pay mappings crumb is static; the run-label crumb is data, so
        // only the title slot below carries a Skeleton bar for it.
        breadcrumb={
          <PageBreadcrumb
            segments={[{ label: t("heading"), href: "/pay-mappings" }]}
          />
        }
        title={<Skeleton className="h-7 w-56 max-w-full" />}
      />
      <Card>
        {/* Mirrors the loaded metadata card exactly: the same MetaField, with
            its real (static i18n) label and a value-only Skeleton bar, so the
            card measures identical and does not resize when the run resolves.
            Each bar is inline-block + centered in its text-sm line box (per
            the skeleton-measurement rule). */}
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <MetaField label={t("table.label")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("detail.referenceDate")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("table.status")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("table.responsible")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("detail.population")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("detail.withPay")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
            <MetaField label={t("detail.excluded")}>
              <Skeleton className="inline-block h-4 w-16 max-w-full align-middle" />
            </MetaField>
          </dl>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {/* The search toolbar is static chrome, so it renders as the real
            control during loading (no pop-in when the run resolves), and in a
            space-y-4 block so the toolbar-to-table gap matches the loaded view. */}
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchField placeholder={t("detail.searchPlaceholder")} />
        </div>
        <Table className="table-fixed">
          <PayMappingRowsHeader />
          <TableSkeleton
            columns={[
              {},
              { className: "w-20" },
              { className: "w-36 max-w-full" },
              { className: "h-5 w-8 rounded-full" },
              { className: "w-12" },
              { className: "w-24" },
            ]}
          />
        </Table>
      </div>
    </div>
  )
}

export default function PayMappingDetailPage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(props.params)
  const t = useTranslations("dashboard.payMapping")
  const { orgId } = useOrganization()

  const run = useQuery(api.payMapping.runs.getPayMappingRunBySlug, {
    orgId,
    slug,
  })
  usePageTitle(run?.label)

  if (run === undefined) {
    return <PayMappingDetailSkeleton />
  }
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

  return <PayMappingDetail orgId={orgId} run={run} />
}
