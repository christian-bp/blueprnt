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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { HelpMorphButton } from "@/components/help-morph-button"
import Link from "next/link"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { TrackBadge } from "@/components/track-badge"
import { AnchorRolesPanel } from "@/components/results/anchor-roles-panel"
import { BandOverview } from "@/components/results/band-overview"
import { statusBadgeVariant } from "@/lib/role-status"

// Sentinel for "show all families" in the Select.
const ALL_FAMILIES = "__all__"

// The results view: live-derived band distribution + roles table. Score and
// band outcome recompute reactively when the model or any rating changes
// (ADR-0002: never stored, never overridable).
export default function ResultsPage() {
  const t = useTranslations("dashboard.results")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const tStatus = useTranslations("assessment.status")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, {
    orgId,
    locale,
  })
  // Owned here (not inside the panel) so the page's loading gate covers it:
  // the anchor panel renders together with the table instead of popping in
  // above it once its own query resolves (layout-shift rule).
  const anchors = useQuery(api.assessment.anchorRoles.listAnchorRoles, {
    orgId,
  })

  const [familyFilter, setFamilyFilter] = useState<string | null>(null)

  if (results === undefined || anchors === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  // Distinct families present in the results rows, sorted by name so the
  // filter lists them in the same order as the grouped roles page.
  const familiesInResults = (() => {
    const seen = new Map<string, string>()
    for (const row of results.rows) {
      if (row.familyId !== null && row.familyName !== null) {
        seen.set(row.familyId as string, row.familyName)
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })()

  const hasAnyFamily = familiesInResults.length > 0

  const filteredRows =
    familyFilter === null
      ? results.rows
      : results.rows.filter(
          (row) => (row.familyId as string | null) === familyFilter
        )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <div className="flex items-center gap-1.5">
          <p className="text-muted-foreground text-sm">{t("description")}</p>
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </div>
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
          {hasAnyFamily && (
            <Select
              value={familyFilter ?? ALL_FAMILIES}
              onValueChange={(next) =>
                setFamilyFilter(next === ALL_FAMILIES ? null : next)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FAMILIES}>{tFamily("all")}</SelectItem>
                {familiesInResults.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <BandOverview bands={results.bands} rows={filteredRows} />
          <AnchorRolesPanel anchors={anchors} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.title")}</TableHead>
                <TableHead>{t("table.track")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.score")}</TableHead>
                <TableHead className="text-right">{t("table.band")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.roleId}>
                  <TableCell>
                    <Link
                      href={`/roles/${row.roleId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TrackBadge trackKey={row.trackKey} name={row.trackName} />
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
