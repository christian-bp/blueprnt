"use client"

import { Medallion } from "@/components/medallion"
import { Briefcase01Icon } from "@hugeicons/core-free-icons"
import { api } from "@workspace/backend/convex/_generated/api"
import { ZONE_KEYS, ZONE_LEVEL_RANGES } from "@workspace/core"
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
import { ZONE_GROUP_LABEL_CLASS } from "@/components/levels/zone-label"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { usePageTitle } from "@/hooks/use-page-title"
import { trackColumns } from "@/lib/levels"

// Filter key for roles with no family (the "No family" option).
const NO_FAMILY = "__none__"

// How many chips each level row of the loading ladder stands in for. Three
// entries, one per level in a zone (every zone spans exactly three).
const LADDER_SKELETON_CHIPS = [3, 2, 4]

// The page's chrome column: breadcrumbs, the tab row, the filters. One class,
// used by the one element that renders them in every branch, so the chrome's X
// cannot drift between tabs or between the loading and loaded states.
const CHROME_COLUMN = cn("flex w-full flex-col gap-6", PAGE_CONTENT_MAX_W)

// A tab panel that lines up with the chrome above it (the ladder, the matrix).
// The families panel deliberately does NOT take this: it is the one view whose
// content is wider than the reading column.
const PANEL_COLUMN = PAGE_CONTENT_MAX_W

// /work is the app's only full-bleed route (AppShell), which the families view
// needs: a family x level grid is strongly horizontal and wants every pixel the
// region has.
//
// THE CHROME DOES NOT MOVE. Breaking one tab out of the reading column is only
// acceptable while the page's chrome stays exactly where it was: a tab row that
// slid sideways on the third tab would make switching views read as navigating
// to a different page. So the chrome (breadcrumbs, tab row, filters) lives in
// ONE constrained column rendered once, above the panels and outside every
// per-tab branch, and the panels choose their own width underneath it. Only the
// families panel takes the region; the ladder and the matrix keep the reading
// column they line up with every other page by.
//
// The loading placeholder carries the same column, so nothing narrows or
// widens when the data arrives.
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
    <PageBreadcrumbRow
      segments={[{ label: tNav("work") }, { label: tNav("overview") }]}
      adornment={
        <HelpMorphButton label={tHelp("scoreLabel")}>
          {tHelp("scoreBody")}
        </HelpMorphButton>
      }
    />
  )

  if (results === undefined) {
    // Content-shaped loading state mirroring the ladder view: the REAL tabs
    // (static i18n chrome, enabled no-ops while the results load), then level
    // rows (the ladder's real bordered boxes: a w-28 label block and role
    // chips), so nothing reflows when the results arrive.
    return (
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Tabs
          value={view}
          onValueChange={(value) =>
            setView(value as "ladder" | "matrix" | "families")
          }
          className="flex min-h-0 w-full flex-1 flex-col gap-4"
        >
          <div className={CHROME_COLUMN}>
            {header}
            <TabsList variant="line">
              <TabsTrigger value="ladder">{t("viewLadder")}</TabsTrigger>
              <TabsTrigger value="matrix">{t("viewMatrix")}</TabsTrigger>
              <TabsTrigger value="families">{t("viewFamilies")}</TabsTrigger>
            </TabsList>
          </div>
          {/* The ladder's real shape: a FLAT list of level rows with the
              zones railed around them, so the surface does not re-shape when
              the results arrive. The zone letters and level numbers are
              structural law (ZONE_KEYS), not data, so the skeleton states them
              for real; only the short names, counts and chips are bars. */}
          <div
            className={cn(
              "min-h-0 flex-1 space-y-5 overflow-y-auto",
              PANEL_COLUMN
            )}
          >
            {ZONE_KEYS.map((zone) => (
              <section key={zone}>
                <div className="mb-2 flex h-5 items-center gap-1.5">
                  <span className={ZONE_GROUP_LABEL_CLASS}>
                    {t("zoneLabel", { zone })}
                  </span>
                  {/* The short name is content; the help is chrome, but it
                      needs the loaded zone to say anything, so both wait. */}
                  <Skeleton className="h-3 w-32" />
                </div>
                <ul className="space-y-2">
                  {LADDER_SKELETON_CHIPS.map((chips, index) => {
                    const level = ZONE_LEVEL_RANGES[zone].from + index
                    return (
                      <li key={level} className="rounded-xl border p-3">
                        <div className="flex gap-4">
                          {/* The rail bars sit in line boxes matching the
                              real text lines, so the skeleton row measures
                              exactly as tall as a loaded level row. */}
                          <div className="w-28 shrink-0">
                            <div className="flex h-5 items-center font-semibold text-sm">
                              {t("levelRow", { level })}
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
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
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
  // Matrix columns come from the UNFILTERED roles, so the grid stays
  // put when families are filtered (hidden families leave hatched empty cells
  // rather than collapsing the columns, even when everything is hidden).
  const trackCols = trackColumns(results.rows)
  return (
    // The page's own inset, identical to the loading branch's, so the chrome
    // does not step sideways when the results land either.
    <div className="flex min-h-0 flex-1 flex-col p-4">
      {/* The chrome, when there is nothing to tab through: the same column,
          so an org with no roles yet sees its breadcrumbs where every other
          page puts them. */}
      {results.rows.length === 0 ? (
        <div className={CHROME_COLUMN}>
          {header}
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Medallion icon={Briefcase01Icon} size="lg" />
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
        </div>
      ) : (
        <Tabs
          value={view}
          onValueChange={(value) =>
            setView(value as "ladder" | "matrix" | "families")
          }
          className="flex min-h-0 w-full flex-1 flex-col gap-4"
        >
          {/* THE CHROME, rendered ONCE for all three tabs and never inside a
              per-tab branch. Its width is the reading column whatever the
              active view is, so switching to the families view widens the
              GRID and leaves the tab row exactly where the reader's eye left
              it. */}
          <div className={CHROME_COLUMN}>
            {header}
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
          </div>
          {/* The ladder tab scrolls as ONE column, so what is below the
              ladder is below it on the page rather than pinned into view
              beside it. The pending panel used to sit in that pinned slot:
              a permanent block of chips, on every tab, for the work that has
              not started yet, on a surface whose subject is where the
              finished work landed. It goes last now, and it goes away when
              the reader scrolls past it. */}
          <TabsContent
            value="ladder"
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
              PANEL_COLUMN
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
            className={cn("flex min-h-0 flex-1 flex-col gap-4", PANEL_COLUMN)}
          >
            <LevelMatrix
              levels={results.levels}
              rows={filteredRows}
              tracks={trackCols}
              groupByFamily={grouped}
            />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
          {/* THE ONE PANEL THAT TAKES THE REGION. Families run across levels,
              so this grid is as wide as the model is long; capping it at the
              reading column spends the page's whole right side on nothing
              while the grid scrolls sideways inside a narrow window. It takes
              the region's width instead (the p-4 inset is the page's, not the
              column's), and still scrolls INSIDE its own wrapper if it
              outgrows even that, so the page itself never scrolls sideways. */}
          <TabsContent
            value="families"
            className="flex min-h-0 w-full flex-1 flex-col gap-4"
          >
            <FamilyLevelMatrix levels={results.levels} rows={filteredRows} />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
