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
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
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

  // The header and its actions are static i18n content, so they render
  // immediately (the create button as a plain no-op until the dialog has its
  // tracks, and the import link works right away); only the data-shaped
  // parts swap in from the skeleton.
  if (
    roles === undefined ||
    model === undefined ||
    model === null ||
    results === undefined
  ) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={tNav("roles")}
          description={t("description")}
          action={
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline">
                {t("newCta")}
              </Button>
              <Link href="/roles/import" className={cn(buttonVariants())}>
                <HugeiconsIcon
                  icon={Briefcase01Icon}
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {t("import.cta")}
              </Link>
            </div>
          }
        />
        <RolesTableSkeleton />
      </div>
    )
  }

  // Level lives in the results query (only complete roles have one); merge it
  // onto each row so the table can show the outcome.
  const levelByRole = new Map(
    results.rows.map((resultRow) => [
      resultRow.roleId as string,
      resultRow.level ?? null,
    ])
  )
  const rows = roles.map((role) => ({
    ...role,
    level: levelByRole.get(role.roleId as string) ?? null,
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={tNav("roles")}
        description={t("description")}
        action={
          // Import is the primary: a register is built fastest in bulk, and
          // this matches the people header, where the bulk path also leads.
          <div className="flex items-center gap-2">
            <CreateRoleDialog
              orgId={orgId}
              tracks={model.tracks}
              triggerLabel={t("newCta")}
              existing={roles}
              triggerVariant="outline"
            />
            <Link href="/roles/import" className={cn(buttonVariants())}>
              <HugeiconsIcon
                icon={Briefcase01Icon}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
              {t("import.cta")}
            </Link>
          </div>
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
            <EmptyTitle>{tNav("roles")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/roles/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("import.cta")}
          </Link>
        </Empty>
      ) : (
        <RolesTable roles={rows} tracks={model.tracks} />
      )}
    </div>
  )
}
