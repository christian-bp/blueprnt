"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { BandLadder } from "@/components/bands/band-ladder"
import { BandMatrix } from "@/components/bands/band-matrix"
import { FamilyFilter } from "@/components/bands/family-filter"
import { PendingRoles } from "@/components/bands/pending-roles"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageHeading } from "@/components/page-heading"
import { usePageTitle } from "@/hooks/use-page-title"
import { trackColumns } from "@/lib/bands"

// Filter key for roles with no family (the "No family" option).
const NO_FAMILY = "__none__"

// Work > Overview: the band ladder (default) and a band-by-track matrix
// toggle. A multi-select family filter shows/hides families, and a "group by
// family" switch clusters roles by family inside each band (ladder) or cell
// (matrix), animating them into and out of their groups. Score and band
// recompute reactively from the model and ratings (ADR-0002: never stored).
export default function WorkOverviewPage() {
  const t = useTranslations("dashboard.bands")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("work"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  // Families turned OFF; empty means all are shown.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [grouped, setGrouped] = useState(false)

  // The header is static i18n content, so both branches render it for real;
  // one node so the two cannot drift.
  const header = (
    <div>
      <div className="flex items-center gap-1.5">
        <PageHeading>{t("heading")}</PageHeading>
        <HelpMorphButton label={tHelp("scoreLabel")}>
          {tHelp("scoreBody")}
        </HelpMorphButton>
      </div>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
    </div>
  )

  if (results === undefined) {
    // Content-shaped loading state mirroring the ladder view: the tabs bar,
    // then band rows (the ladder's real bordered boxes: a w-28 label block
    // and role chips), so nothing reflows when the results arrive.
    return (
      <div className="space-y-6">
        {header}
        <div className="space-y-4">
          <Skeleton className="h-9 w-44 rounded-md" />
          <ul className="space-y-2">
            {[3, 2, 4, 1, 2].map((chips, band) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                key={band}
                className="rounded-xl border p-3"
              >
                <div className="flex gap-4">
                  <div className="w-28 shrink-0 space-y-1.5">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex flex-1 flex-wrap items-start gap-2 self-center">
                    {Array.from({ length: chips }, (_, chip) => (
                      <Skeleton
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                        key={chip}
                        className="h-8 w-28 rounded-md"
                      />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // Distinct families present in the rows, sorted by name (same order as the
  // grouped roles page).
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
  // "No family" joins the filter options only when some roles are unassigned.
  const hasNoFamily = results.rows.some((row) => row.familyId === null)
  const familyOptions = hasNoFamily
    ? [...familiesInResults, { id: NO_FAMILY, name: tFamily("none") }]
    : familiesInResults

  const filteredRows =
    hidden.size === 0
      ? results.rows
      : results.rows.filter(
          (row) => !hidden.has((row.familyId as string | null) ?? NO_FAMILY)
        )
  // Matrix columns come from the UNFILTERED placed roles, so the grid stays
  // put when families are filtered (hidden families leave hatched empty cells
  // rather than collapsing the columns, even when everything is hidden).
  const trackCols = trackColumns(
    results.rows.filter((row) => row.band !== null)
  )
  return (
    <div className="space-y-6">
      {header}
      {results.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/roles"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("emptyCta")}
          </Link>
        </Empty>
      ) : (
        <Tabs defaultValue="ladder" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList variant="line">
              <TabsTrigger value="ladder">{t("viewLadder")}</TabsTrigger>
              <TabsTrigger value="matrix">{t("viewMatrix")}</TabsTrigger>
            </TabsList>
            {hasAnyFamily && (
              <FamilyFilter
                options={familyOptions}
                hidden={hidden}
                onHiddenChange={setHidden}
              />
            )}
            {hasAnyFamily && (
              <div className="flex items-center gap-2">
                <Switch
                  id="group-by-family"
                  checked={grouped}
                  onCheckedChange={setGrouped}
                />
                <Label
                  htmlFor="group-by-family"
                  className="text-muted-foreground text-sm"
                >
                  {t("groupByFamily")}
                </Label>
              </div>
            )}
          </div>
          <TabsContent value="ladder" className="space-y-4">
            <BandLadder
              bands={results.bands}
              rows={filteredRows}
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
          <TabsContent value="matrix" className="space-y-4">
            <BandMatrix
              bands={results.bands}
              rows={filteredRows}
              tracks={trackCols}
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
