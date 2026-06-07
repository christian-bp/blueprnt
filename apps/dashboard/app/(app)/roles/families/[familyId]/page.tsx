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
import { FamilyHeader } from "@/components/roles/family-header"
import { statusBadgeVariant } from "@/lib/role-status"

// Per-family progression: the family's roles grouped per track (by track
// order), sorted by level within each track. Band outcomes appear only for
// complete roles, the same visibility rule as the results view.
export default function FamilyPage(props: {
  params: Promise<{ familyId: string }>
}) {
  const { familyId } = use(props.params)
  const t = useTranslations("dashboard.roles")
  const tFamily = useTranslations("dashboard.roles.family")
  const tStatus = useTranslations("assessment.status")
  const tAssessment = useTranslations("assessment")
  const { orgId } = useOrganization()
  const locale = useLocale()

  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })

  if (families === undefined || roles === undefined || results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tFamily("rolesHeading")} />
      </main>
    )
  }

  const family = families.find((entry) => entry.familyId === familyId)
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
  const familyRoles = roles.filter((role) => role.familyId === familyId)

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
      <FamilyHeader familyId={familyId} name={family.name} orgId={orgId} />
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
                  <TableHead>{t("table.status")}</TableHead>
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
                          href={`/roles/${role.roleId}`}
                        >
                          {role.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(role.status)}>
                          {tStatus(
                            role.status as "draft" | "inReview" | "approved"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {result?.band != null ? (
                          <Badge>{result.band}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t("detail.ratingProgress", {
                              rated: role.ratedCount,
                              total: role.totalCriteria,
                            })}
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
