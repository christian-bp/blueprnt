"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { OrganizationsSection } from "@/components/admin/organizations-section"
import { UsersSection } from "@/components/admin/users-section"

export default function AdminPage() {
  const t = useTranslations("dashboard.admin")
  const tAuth = useTranslations("dashboard.auth")
  const allowed = useQuery(api.platform.admin.isPlatformAdmin)

  if (allowed === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner aria-label={tAuth("loading")} />
      </div>
    )
  }
  if (allowed === false) {
    return <p className="text-muted-foreground text-sm">{t("notAuthorized")}</p>
  }
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
