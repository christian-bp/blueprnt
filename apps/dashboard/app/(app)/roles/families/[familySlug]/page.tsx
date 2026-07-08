"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
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
import { use } from "react"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"
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
// complete roles, the same visibility rule as the results view.
export default function FamilyPage(props: {
  params: Promise<{ familySlug: string }>
}) {
  const { familySlug } = use(props.params)
  const t = useTranslations("dashboard.roles")
  const tNav = useTranslations("dashboard.nav")
  const tFamily = useTranslations("dashboard.roles.family")
  const tAssessment = useTranslations("assessment")
  const { orgId } = useOrganization()
  const locale = useLocale()

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
  // w-32 to fit the widest locale label (fi "Vaativuusluokka").
  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("table.title")}</TableHead>
        <TableHead className="w-44">{t("table.track")}</TableHead>
        <TableHead className="w-[22%]">{t("table.team")}</TableHead>
        <TableHead className="w-32 text-right">{tAssessment("band")}</TableHead>
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
    // Content-shaped loading state: the page's real layout with bars for the
    // data (the family name, the actions, the rows), so nothing reflows when
    // the data arrives.
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb={<Skeleton className="h-4 w-40" />}
          title={<Skeleton className="h-7 w-48 max-w-full" />}
          action={<Skeleton className="h-9 w-28 rounded-md" />}
        />
        <Table className="table-fixed">
          {tableHeader}
          <TableSkeleton rows={5} columns={FAMILY_SKELETON_COLUMNS} />
        </Table>
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
      <Table className="table-fixed">
        {tableHeader}
        <TableBody>
          {familyRoles.map((role) => {
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
                {/* Block flex wrappers: an inline-flex badge directly in the
                    cell sits on the text baseline and inflates the line box,
                    desyncing the row height from the skeleton rows. */}
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
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
