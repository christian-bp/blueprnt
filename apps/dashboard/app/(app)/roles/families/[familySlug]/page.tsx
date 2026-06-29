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
import { usePageTitle } from "@/hooks/use-page-title"
import { FamilyHeader } from "@/components/roles/family-header"

// Per-family progression: the family's roles grouped per track (by track
// order), sorted by level within each track. Band outcomes appear only for
// complete roles, the same visibility rule as the results view.
export default function FamilyPage(props: {
  params: Promise<{ familySlug: string }>
}) {
  const { familySlug } = use(props.params)
  const t = useTranslations("dashboard.roles")
  const tFamily = useTranslations("dashboard.roles.family")
  const tAssessment = useTranslations("assessment")
  const tBands = useTranslations("dashboard.bands")
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
  const familyRoles = roles.filter((role) => role.familyId === family.familyId)

  // Deduplicate tracks ordered by trackOrder for the progression sections.
  const trackKeys = [
    ...new Map(
      familyRoles.map((role) => [
        role.trackKey,
        { key: role.trackKey, name: role.trackName, order: role.trackOrder },
      ])
    ).values(),
  ].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">
      <FamilyHeader
        familyId={family.familyId}
        name={family.name}
        orgId={orgId}
      />
      {/* The only band column outside the results surfaces: carry the same
          band-1-is-highest note its siblings show (guidance convention). */}
      <p className="text-muted-foreground text-sm">{tBands("bandHighest")}</p>
      {trackKeys.map((track) => {
        const trackRoles = familyRoles
          .filter((role) => role.trackKey === track.key)
          .sort((a, b) => a.title.localeCompare(b.title))
        return (
          <div key={track.key} className="space-y-2">
            <h3 className="font-medium text-sm">{track.name}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.title")}</TableHead>
                  <TableHead className="text-right">
                    {tAssessment("band")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackRoles.map((role) => {
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
                      <TableCell className="text-right">
                        {result?.band != null ? (
                          <Badge>{result.band}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t("notEvaluated")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      })}
    </div>
  )
}
