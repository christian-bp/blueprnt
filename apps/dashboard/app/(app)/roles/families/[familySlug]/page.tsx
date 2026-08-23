"use client"

import { Medallion } from "@/components/medallion"
import { Briefcase01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use, useState } from "react"
import { useOrganization } from "@/components/org-context"
import type { Crumb } from "@/components/page-breadcrumb"
import { FrameTable } from "@/components/frame-table"
import { NoMatchesEmpty } from "@/components/no-matches-empty"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"
import {
  ALL_TRACKS,
  matchesRoleQuery,
  RoleTableToolbar,
} from "@/components/roles/role-table-toolbar"
import {
  ROLE_SKELETON_COLUMNS,
  RoleEmployeesCell,
  RoleLevelCell,
  RoleTableHeadings,
  RoleTeamCell,
  RoleTitleCell,
  RoleTrackCell,
} from "@/components/roles/role-table-row"
import { TableSkeleton } from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// Per-family progression: the family's roles in one table with a track column,
// ordered by track (track order) then title. Level outcomes appear only for
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
  const { orgId } = useOrganization()
  const locale = useLocale()

  // Filter state lives outside the data, so the loading toolbar shares it: a
  // query typed while the roles load carries over to the real table. It is
  // keyed by the family, because sibling families share this route (and this
  // component instance): carrying a filter across the switch would drop the
  // visitor into a zero-match table on a family they just opened. Adjusting
  // state during render is React's documented alternative to a reset effect.
  const [filters, setFilters] = useState({
    slug: familySlug,
    query: "",
    track: ALL_TRACKS,
  })
  if (filters.slug !== familySlug) {
    setFilters({ slug: familySlug, query: "", track: ALL_TRACKS })
  }
  const { query, track } = filters
  const setQuery = (next: string) =>
    setFilters((current) => ({ ...current, query: next }))
  const setTrack = (next: string) =>
    setFilters((current) => ({ ...current, track: next }))

  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const family = families?.find((entry) => entry.slug === familySlug)
  usePageTitle(family?.name)

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
      <div className="space-y-4">
        <PageBreadcrumbRow
          // The ancestor crumbs are static; the family name arrives with the
          // data, so a skeleton crumb holds its place.
          segments={[
            { label: tNav("work"), href: "/work" },
            { label: tNav("roles"), href: "/roles" },
            { skeleton: true },
          ]}
        />
        <FrameTable
          size="sm"
          title={<Skeleton className="h-5 w-40" />}
          toolbar={
            <>
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
            </>
          }
          filters={
            <RoleTableToolbar
              tracks={[]}
              query={query}
              onQueryChange={setQuery}
              track={track}
              onTrackChange={setTrack}
            />
          }
        >
          <Table className="table-fixed">
            <RoleTableHeadings />
            <TableSkeleton rows={5} columns={ROLE_SKELETON_COLUMNS} />
          </Table>
        </FrameTable>
      </div>
    )
  }

  if (family === undefined) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbRow
          segments={[
            { label: tNav("work"), href: "/work" },
            { label: tNav("roles"), href: "/roles" },
          ]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{tNav("roles")}</EmptyTitle>
            <EmptyDescription>{tFamily("notFound")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/roles"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("detail.backToRoles")}
          </Link>
        </Empty>
      </div>
    )
  }

  const levelByRole = new Map(
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
    { label: tNav("work"), href: "/work" },
    { label: tNav("roles"), href: "/roles" },
    { label: family.name },
  ]

  const familyActions = (
    <>
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
    </>
  )

  return (
    <div className="space-y-4">
      <PageBreadcrumbRow segments={familyCrumbs} />
      <FrameTable
        size="sm"
        title={family.name}
        description={tFamily("roleCount", { count: familyRoles.length })}
        toolbar={familyActions}
        filters={
          familyRoles.length > 0 ? (
            <RoleTableToolbar
              tracks={model.tracks}
              query={query}
              onQueryChange={setQuery}
              track={track}
              onTrackChange={setTrack}
              shown={shownRoles.length}
              total={familyRoles.length}
            />
          ) : undefined
        }
      >
        {familyRoles.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Medallion icon={Briefcase01Icon} size="lg" />
              </EmptyMedia>
              <EmptyTitle>{family.name}</EmptyTitle>
              <EmptyDescription>{tFamily("rolesEmpty")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : shownRoles.length === 0 ? (
          <NoMatchesEmpty
            title={family.name}
            description={tToolbar("noMatches")}
            clearLabel={tToolbar("clearFilters")}
            onClear={clearFilters}
          />
        ) : (
          <Table className="table-fixed">
            <RoleTableHeadings />
            <TableBody>
              {shownRoles.map((role) => {
                const result = levelByRole.get(role.roleId as string)
                return (
                  <TableRow key={role.roleId}>
                    {/* Every cell comes from the shared role row, so this
                          table and the register cannot drift apart. One cell
                          per heading, always: table-fixed slides a short row's
                          later values left under the wrong headings. */}
                    <TableCell>
                      <RoleTitleCell slug={role.slug} title={role.title} />
                    </TableCell>
                    <TableCell>
                      <RoleTrackCell
                        trackKey={role.trackKey}
                        name={role.trackName}
                      />
                    </TableCell>
                    <TableCell>
                      <RoleTeamCell team={role.team} />
                    </TableCell>
                    <TableCell>
                      <RoleEmployeesCell count={role.employeeCount} />
                    </TableCell>
                    <TableCell>
                      <RoleLevelCell level={result?.level ?? null} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </FrameTable>
    </div>
  )
}
