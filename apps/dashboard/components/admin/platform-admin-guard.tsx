"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { AdminShell } from "@/components/admin/admin-shell"

// undefined = query in flight; false = not a platform admin; true = allowed.
export function PlatformAdminGuard(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  const tAdmin = useTranslations("dashboard.admin")
  const allowed = useQuery(api.platform.admin.isPlatformAdmin)

  if (allowed === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("auth.loading")} />
      </main>
    )
  }
  if (allowed === false) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">
          {tAdmin("notAuthorized")}
        </p>
      </main>
    )
  }
  return <AdminShell>{props.children}</AdminShell>
}
