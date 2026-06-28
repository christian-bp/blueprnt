"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { useOrganization } from "@/components/org-context"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { RolesTable } from "@/components/roles/roles-table"
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

  if (roles === undefined || model === undefined || model === null) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

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
          />
        }
      />
      {roles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RolesTable roles={roles} tracks={model.tracks} />
      )}
    </div>
  )
}
