"use client"

import { Briefcase01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import { cn } from "@workspace/ui/lib/utils"
import { PAGE_CONTENT_MAX_W } from "@/components/app-shell"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { FamilyFilter } from "@/components/levels/family-filter"
import { FamilyLevelMatrix } from "@/components/levels/family-level-matrix"
import { LevelLadder } from "@/components/levels/level-ladder"
import { LevelMatrix } from "@/components/levels/level-matrix"
import { PendingRoles } from "@/components/levels/pending-roles"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageHeading } from "@/components/page-heading"
import { usePageTitle } from "@/hooks/use-page-title"
import { trackColumns } from "@/lib/levels"

// Filter key for roles with no family (the "No family" option).
const NO_FAMILY = "__none__"

// /work is the app's only full-bleed route (AppShell), which the matrix and
// families views need: they are horizontal and want every pixel. The ladder is
// a vertical list of level rows, so it instead lines up with every other page by
// applying the shell's content width. The loading placeholder below carries it
// too, so the panel does not narrow when the data arrives.
// Work > Overview: the level ladder (default) and a level-by-track matrix
// toggle. A multi-select family filter shows/hides families, and a "group by
// family" switch clusters roles by family inside each level (ladder) or cell
// (matrix), animating them into and out of their groups. Score and level
// recompute reactively from the model and ratings (ADR-0002: never stored).
export default function WorkOverviewPage() {
  const t = useTranslations("dashboard.levels")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const tNav = useTranslations("dashboard.nav")
  // Title and heading are the page's nav label (nav.overview), so the browser
  // tab, the header tab, the sidebar sub-page, and the h1 all say one thing.
  usePageTitle(tNav("overview"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  // Families turned OFF; empty means all are shown.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [grouped, setGrouped] = useState(false)
  // The active tab, owned by the page so BOTH branches render the same
  // controlled Tabs. The Tabs instance persists across the loading-to-loaded
  // branch swap (same tree position), and Base UI drops an uncontrolled
  // selection when the active trigger remounts in a new spot, which left the
  // loaded page with no view selected. Page-owned state also lets a tab
  // picked during loading carry over.
  const [view, setView] = useState<"ladder" | "matrix" | "families">("ladder")

  // The header is static i18n content, so both branches render it for real;
  // one node so the two cannot drift.
  const header = (
    <div>
      <div className="flex items-center gap-1.5">
        <PageHeading>{tNav("overview")}</PageHeading>
        <HelpMorphButton label={tHelp("scoreLabel")}>
          {tHelp("scoreBody")}
        </HelpMorphButton>
      </div>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
    </div>
  )

  if (results === undefined) {
    // Content-shaped loading state mirroring the ladder view: the REAL tabs
    // (static i18n chrome, enabled no-ops while the results load), then level
    // rows (the ladder's real bordered boxes: a w-28 label block and role
    // chips), so nothing reflows when the results arrive.
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {header}
        <Tabs
          value={view}
          onValueChange={(value) =>
            setView(value as "ladder" | "matrix" | "families")
          }
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList variant="line">
            <TabsTrigger value="ladder">{t("viewLadder")}</TabsTrigger>
            <TabsTrigger value="matrix">{t("viewMatrix")}</TabsTrigger>
            <TabsTrigger value="families">{t("viewFamilies")}</TabsTrigger>
          </TabsList>
          <ul
            className={cn(
              "min-h-0 w-full flex-1 space-y-2 overflow-y-auto",
              PAGE_CONTENT_MAX_W
            )}
          >
            {[3, 2, 4, 1, 2].map((chips, level) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                key={level}
                className="rounded-xl border p-3"
              >
                <div className="flex gap-4">
                  {/* The rail bars sit in line boxes matching the real text
                      lines (text-sm 20px + text-xs 16px = a 36px rail), so
                      the skeleton row measures exactly as tall as a loaded
                      level row (measured in headless Chrome: 62px vs 60px
                      with naively stacked bars). */}
                  <div className="w-28 shrink-0">
                    <div className="flex h-5 items-center">
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex h-4 items-center">
                      <Skeleton className="h-3 w-20" />
                    </div>
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
        </Tabs>
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
    results.rows.filter((row) => row.level !== null)
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {header}
      {results.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={Briefcase01Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{tNav("overview")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/roles"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("emptyCta")}
          </Link>
        </Empty>
      ) : (
        <Tabs
          value={view}
          onValueChange={(value) =>
            setView(value as "ladder" | "matrix" | "families")
          }
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <TabsList variant="line">
              <TabsTrigger value="ladder">{t("viewLadder")}</TabsTrigger>
              <TabsTrigger value="matrix">{t("viewMatrix")}</TabsTrigger>
              <TabsTrigger value="families">{t("viewFamilies")}</TabsTrigger>
            </TabsList>
            {hasAnyFamily && (
              <FamilyFilter
                options={familyOptions}
                hidden={hidden}
                onHiddenChange={setHidden}
              />
            )}
            {/* Group-by-family is meaningless on the families view (family
                IS the row axis there); it trails the row, so hiding it
                shifts nothing else. */}
            {hasAnyFamily && view !== "families" && (
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
          <TabsContent
            value="ladder"
            className={cn(
              "min-h-0 w-full flex-1 space-y-4 overflow-y-auto",
              PAGE_CONTENT_MAX_W
            )}
          >
            <LevelLadder
              levels={results.levels}
              rows={filteredRows}
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
          {/* The matrix panels are flex columns WITHOUT their own scroll:
              the matrix wrapper (MATRIX_WRAPPER_CLASS) is the vertical
              scroller, so its sticky column headers can stick; a scrolling
              panel would double-scroll and un-stick them. The ladder has no
              sticky header, so its panel scrolls itself. */}
          <TabsContent
            value="matrix"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <LevelMatrix
              levels={results.levels}
              rows={filteredRows}
              tracks={trackCols}
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
          <TabsContent
            value="families"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <FamilyLevelMatrix levels={results.levels} rows={filteredRows} />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
