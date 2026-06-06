"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useOrganization } from "@/components/org-context"
import { BandOverview } from "@/components/results/band-overview"
import { statusBadgeVariant } from "@/lib/role-status"

// The results view: live-derived band distribution + roles table. Score and
// band outcome recompute reactively when the model or any rating changes
// (ADR-0002: never stored, never overridable).
export default function ResultsPage() {
  const t = useTranslations("dashboard.results")
  const tStatus = useTranslations("assessment.status")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, {
    orgId,
    locale,
  })

  if (results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {results.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/roles">{t("emptyCta")}</Link>
          </Button>
        </Empty>
      ) : (
        <>
          <BandOverview bands={results.bands} rows={results.rows} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.title")}</TableHead>
                <TableHead>{t("table.trackLevel")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.score")}</TableHead>
                <TableHead className="text-right">{t("table.band")}</TableHead>
                <TableHead className="text-right">
                  {t("table.warnings")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.rows.map((row) => (
                <TableRow key={row.roleId}>
                  <TableCell>
                    <Link
                      href={`/roles/${row.roleId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.trackName} {row.levelKey}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {tStatus(row.status as "draft" | "inReview" | "approved")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.complete ? (
                      row.score
                    ) : (
                      <span className="text-muted-foreground">
                        {t("table.progress", {
                          rated: row.ratedCount,
                          total: row.totalCriteria,
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.band !== null && <Badge>{row.band}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.warningCount > 0 && (
                      <span className="text-amber-600 text-sm tabular-nums dark:text-amber-500">
                        {row.warningCount}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
