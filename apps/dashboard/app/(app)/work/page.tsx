"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
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
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  // Families turned OFF; empty means all are shown.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [grouped, setGrouped] = useState(false)

  if (results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
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
  // Show the anchor legend only when some role is an anchor.
  const hasAnchors = results.rows.some((row) => row.anchor !== null)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {hasAnchors && (
          // Legend: explain the anchor marker where it is used. The deviation
          // flag carries its own meaning in the chip (title + aria-label).
          <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
            <HugeiconsIcon
              icon={AnchorIcon}
              size={12}
              strokeWidth={2}
              className="shrink-0"
              aria-hidden="true"
            />
            <span>{t("anchorLabel")}</span>
            <HelpMorphButton label={tHelp("anchorRoleLabel")}>
              {tHelp("anchorRoleBody")}
            </HelpMorphButton>
          </div>
        )}
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
