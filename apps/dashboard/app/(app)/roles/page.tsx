"use client"

import { Briefcase01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { useOrganization } from "@/components/org-context"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { RolesTable, RolesTableSkeleton } from "@/components/roles/roles-table"
import { usePageTitle } from "@/hooks/use-page-title"

// The role register: header + create CTA, then the grouped data table
// (search, filters, family group rows) in components/roles/roles-table.tsx.
// This page owns only the queries and the zero-roles empty state.
export default function RolesPage() {
  const t = useTranslations("dashboard.roles")
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("roles"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })

  // The header and its create action are static i18n content, so they render
  // immediately (the action as a plain no-op button until the dialog has its
  // tracks; the load is brief and disabling would just flash gray); only the
  // data-shaped parts swap in from the skeleton.
  if (
    roles === undefined ||
    model === undefined ||
    model === null ||
    results === undefined
  ) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("heading")}
          description={t("description")}
          action={<Button type="button">{t("newCta")}</Button>}
        />
        <RolesTableSkeleton />
      </div>
    )
  }

  // Band lives in the results query (only complete roles have one); merge it
  // onto each row so the table can show the outcome.
  const bandByRole = new Map(
    results.rows.map((resultRow) => [
      resultRow.roleId as string,
      resultRow.band ?? null,
    ])
  )
  const rows = roles.map((role) => ({
    ...role,
    band: bandByRole.get(role.roleId as string) ?? null,
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        action={
          <CreateRoleDialog
            orgId={orgId}
            tracks={model.tracks}
            triggerLabel={t("newCta")}
            existing={roles}
          />
        }
      />
      {roles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={Briefcase01Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RolesTable roles={rows} tracks={model.tracks} />
      )}
    </div>
  )
}
