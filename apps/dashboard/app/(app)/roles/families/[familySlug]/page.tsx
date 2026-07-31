"use client"

import { Briefcase01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
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
import { use, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"
import {
  ALL_TRACKS,
  RoleTableToolbar,
} from "@/components/roles/role-table-toolbar"
import { matchesRoleQuery } from "@/components/roles/roles-table"
import { TrackBadge } from "@/components/track-badge"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// Skeleton shape per column, mirroring the real row content (title link,
// track badge, team text, right-aligned band badge).
const FAMILY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-40 max-w-full" },
  { className: "h-5 w-20 rounded-full" },
  { className: "w-24 max-w-full" },
  { className: "ml-auto h-5 w-10 rounded-full" },
]

// Per-family progression: the family's roles in one table with a track column,
// ordered by track (track order) then title. Band outcomes appear only for
// complete roles (the same visibility rule as the results view); a role
// without one shows a muted "not yet evaluated" line instead of a blank cell.
// The register's toolbar (shared component, shared search matcher) sits above
// it, so a large family narrows the same way the register does.
export default function FamilyPage(props: {
  params: Promise<{ familySlug: string }>
}) {
  const { familySlug } = use(props.params)
  const t = useTranslations("dashboard.roles")
  const tNav = useTranslations("dashboard.nav")
  const tFamily = useTranslations("dashboard.roles.family")
  const tToolbar = useTranslations("dashboard.roles.toolbar")
  const tAssessment = useTranslations("assessment")
  const { orgId } = useOrganization()
  const locale = useLocale()

  // Filter state lives outside the data, so the loading toolbar shares it: a
  // query typed while the roles load carries over to the real table.
  const [query, setQuery] = useState("")
  const [track, setTrack] = useState(ALL_TRACKS)

  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const family = families?.find((entry) => entry.slug === familySlug)
  usePageTitle(family?.name)

  // Shared by the loaded table and the loading skeleton so the two cannot
  // drift. Fixed widths (with table-fixed) match the roles register; band is
  // w-40 to fit the column's widest content on one line (the sv "Inte
  // utvärderad ännu" cell text).
  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("table.title")}</TableHead>
        <TableHead className="w-44">{t("table.track")}</TableHead>
        <TableHead className="w-[22%]">{t("table.team")}</TableHead>
        <TableHead className="w-40 text-right">{tAssessment("band")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  if (
    families === undefined ||
    roles === undefined ||
    results === undefined ||
    model === undefined ||
    model === null
  ) {
    // Content-shaped loading state: bars stand in for the data (the family
    // name, the rows); the actions are static chrome, so they render as
    // their real buttons (enabled no-ops: the load is brief and disabling
    // would just flash gray).
    return (
      <div className="space-y-6">
        <PageHeader
          // The Roles crumb is static; the family crumb joins it with the
          // data.
          breadcrumb={
            <PageBreadcrumb
              segments={[{ label: tNav("roles"), href: "/roles" }]}
            />
          }
          title={<Skeleton className="h-7 w-48 max-w-full" />}
          action={
            <div className="flex items-center gap-2">
              <Button type="button">{t("newCta")}</Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={tFamily("actionsMenu")}
                className="shrink-0"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </div>
          }
        />
        <div className="space-y-4">
          {/* The toolbar is static chrome too: real controls, the track
              filter showing its all-option until the tracks arrive. */}
          <RoleTableToolbar
            tracks={[]}
            query={query}
            onQueryChange={setQuery}
          />
          <Table className="table-fixed">
            {tableHeader}
            <TableSkeleton rows={5} columns={FAMILY_SKELETON_COLUMNS} />
          </Table>
        </div>
      </div>
    )
  }

  if (family === undefined) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{tFamily("notFound")}</p>
        <Link className="text-sm underline underline-offset-4" href="/roles">
          {t("detail.backToRoles")}
        </Link>
      </div>
    )
  }

  const bandByRole = new Map(
    results.rows.map((row) => [row.roleId as string, row])
  )
  // One flat list, ordered by track (track order) then title.
  const familyRoles = roles
    .filter((role) => role.familyId === family.familyId)
    .sort(
      (a, b) => a.trackOrder - b.trackOrder || a.title.localeCompare(b.title)
    )

  // Search (the register's shared matcher) and the track filter narrow the
  // table; the full list stays the counter's total.
  const shownRoles = familyRoles.filter(
    (role) =>
      matchesRoleQuery(role, query) &&
      (track === ALL_TRACKS || role.trackKey === track)
  )

  function clearFilters() {
    setQuery("")
    setTrack(ALL_TRACKS)
  }

  const familyCrumbs: Crumb[] = [
    { label: tNav("roles"), href: "/roles" },
    { label: family.name },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={familyCrumbs} />}
        title={family.name}
        action={
          <div className="flex items-center gap-2">
            <CreateRoleDialog
              orgId={orgId}
              tracks={model.tracks}
              triggerLabel={t("newCta")}
              existing={roles}
              defaultFamilyId={family.familyId}
            />
            <FamilyActionsMenu
              orgId={orgId}
              familyId={family.familyId}
              name={family.name}
              roleTitles={familyRoles.map((role) => role.title)}
            />
          </div>
        }
      />
      {familyRoles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={Briefcase01Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{family.name}</EmptyTitle>
            <EmptyDescription>{tFamily("rolesEmpty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          <RoleTableToolbar
            tracks={model.tracks}
            query={query}
            onQueryChange={setQuery}
            track={track}
            onTrackChange={setTrack}
            shown={shownRoles.length}
            total={familyRoles.length}
          />
          {shownRoles.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{family.name}</EmptyTitle>
                <EmptyDescription>{tToolbar("noMatches")}</EmptyDescription>
              </EmptyHeader>
              <Button type="button" variant="outline" onClick={clearFilters}>
                {tToolbar("clearFilters")}
              </Button>
            </Empty>
          ) : (
            <Table className="table-fixed">
              {tableHeader}
              <TableBody>
                {shownRoles.map((role) => {
                  const result = bandByRole.get(role.roleId as string)
                  return (
                    <TableRow key={role.roleId}>
                      <TableCell>
                        {/* block truncate: a long title clamps inside the fixed
                        column instead of widening it. */}
                        <Link
                          className="block truncate font-medium underline-offset-4 hover:underline"
                          href={`/roles/${role.slug}`}
                        >
                          {role.title}
                        </Link>
                      </TableCell>
                      {/* Block flex wrappers: an inline-flex badge directly in
                      the cell sits on the text baseline and inflates the
                      line box, desyncing the row height from the skeleton
                      rows. */}
                      <TableCell>
                        <div className="flex items-center">
                          <TrackBadge
                            trackKey={role.trackKey}
                            name={role.trackName}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">
                        {role.team}
                      </TableCell>
                      <TableCell>
                        {result?.band != null ? (
                          <div className="flex items-center justify-end">
                            <Badge>{result.band}</Badge>
                          </div>
                        ) : (
                          <span className="block truncate text-right text-muted-foreground">
                            {t("notEvaluated")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
