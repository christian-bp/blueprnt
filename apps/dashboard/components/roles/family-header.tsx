"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useTranslations } from "next-intl"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"

// Family page header: the breadcrumb (Roles > family) whose last crumb doubles
// as the page title, with a top-right actions menu (rename, delete).
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
    <div className="flex items-start justify-between gap-3">
      <PageBreadcrumb
        segments={[{ label: tNav("roles"), href: "/roles" }, { label: name }]}
      />
      <FamilyActionsMenu
        orgId={orgId}
        familyId={familyId}
        name={name}
        roleTitles={roleTitles}
      />
    </div>
  )
}
