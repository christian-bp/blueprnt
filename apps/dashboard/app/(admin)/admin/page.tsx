"use client"

import { useTranslations } from "next-intl"
import { OrganizationsSection } from "@/components/admin/organizations-section"
import { UsersSection } from "@/components/admin/users-section"

export default function AdminPage() {
  const t = useTranslations("dashboard.admin")
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="font-medium text-2xl">{t("heading")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <UsersSection />
      <OrganizationsSection />
    </div>
  )
}
