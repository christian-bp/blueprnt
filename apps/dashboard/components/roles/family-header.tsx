"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useTranslations } from "next-intl"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"

// Family page header: a top-left actions menu (rename, delete) and the
// breadcrumb (Roles > family) whose last crumb doubles as the page title.
export function FamilyHeader({
  orgId,
  familyId,
  name,
  roleTitles,
}: {
  orgId: string
  familyId: Id<"roleFamilies">
  name: string
  roleTitles: string[]
}) {
  const tNav = useTranslations("dashboard.nav")
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FamilyActionsMenu
        orgId={orgId}
        familyId={familyId}
        name={name}
        roleTitles={roleTitles}
      />
      <PageBreadcrumb
        segments={[{ label: tNav("roles"), href: "/roles" }, { label: name }]}
      />
    </div>
  )
}
