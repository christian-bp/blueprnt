"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

export default function AdminLayout(props: { children: ReactNode }) {
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
  return <>{props.children}</>
}
