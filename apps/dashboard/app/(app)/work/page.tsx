"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { PendingRoles } from "@/components/bands/pending-roles"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"

// Sentinel for "show all families" in the Select.
const ALL_FAMILIES = "__all__"

// Work > Overview: the band ladder (default) and a band-by-track matrix
// toggle, scoped by an optional family filter. An optional "group by family"
// switch clusters the roles by family inside each band (ladder) or cell
// (matrix); toggling it animates the roles into and out of their groups.
// Score and band recompute reactively from the model and ratings (ADR-0002:
// never stored).
export default function WorkOverviewPage() {
  const t = useTranslations("dashboard.bands")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
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

  const filteredRows =
    familyFilter === null
      ? results.rows
      : results.rows.filter(
          (row) => (row.familyId as string | null) === familyFilter
        )

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
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
