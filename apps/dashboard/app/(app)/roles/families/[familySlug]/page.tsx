"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
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
import { use } from "react"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"
import { TrackBadge } from "@/components/track-badge"
import { usePageTitle } from "@/hooks/use-page-title"

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
  const family = families?.find((entry) => entry.slug === familySlug)
  usePageTitle(family?.name)

  if (families === undefined || roles === undefined || results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tFamily("rolesHeading")} />
      </main>
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
          <FamilyActionsMenu
            orgId={orgId}
            familyId={family.familyId}
            name={family.name}
            roleTitles={familyRoles.map((role) => role.title)}
          />
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.title")}</TableHead>
            <TableHead>{t("table.track")}</TableHead>
            <TableHead className="text-right">{tAssessment("band")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {familyRoles.map((role) => {
            const result = bandByRole.get(role.roleId as string)
            return (
              <TableRow key={role.roleId}>
                <TableCell>
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/roles/${role.slug}`}
                  >
                    {role.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <TrackBadge trackKey={role.trackKey} name={role.trackName} />
                </TableCell>
                <TableCell className="text-right">
                  {result?.band != null ? <Badge>{result.band}</Badge> : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
