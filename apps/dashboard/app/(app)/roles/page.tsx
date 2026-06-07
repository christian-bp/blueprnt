"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
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
import { useOrganization } from "@/components/org-context"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { groupByFamily } from "@/lib/role-groups"
import { statusBadgeVariant } from "@/lib/role-status"

export default function RolesPage() {
  const t = useTranslations("dashboard.roles")
  const tFamily = useTranslations("dashboard.roles.family")
  const tStatus = useTranslations("assessment.status")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })

  if (roles === undefined || model === undefined || model === null) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  const groups = groupByFamily(roles)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateRoleDialog
          orgId={orgId}
          tracks={model.tracks}
          triggerLabel={t("newCta")}
        />
      </div>
      {roles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.familyId ?? "__none__"}>
              <div className="mb-2 flex items-baseline gap-2">
                {group.familyId !== null ? (
                  <h3 className="font-medium text-sm">
                    <Link
                      href={`/roles/families/${group.familyId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {group.familyName}
                    </Link>
                  </h3>
                ) : (
                  <h3 className="text-muted-foreground text-sm">
                    {tFamily("none")}
                  </h3>
                )}
                {group.familyId !== null && (
                  <span className="text-muted-foreground text-xs">
                    {tFamily("roleCount", { count: group.rows.length })}
                  </span>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.title")}</TableHead>
                    <TableHead>{t("table.track")}</TableHead>
                    <TableHead>{t("table.team")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.rated")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((role) => (
                    <TableRow key={role.roleId}>
                      <TableCell>
                        <Link
                          href={`/roles/${role.roleId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {role.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.trackName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.team}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(role.status)}>
                          {tStatus(
                            role.status as "draft" | "inReview" | "approved"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {role.ratedCount}/{role.totalCriteria}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
