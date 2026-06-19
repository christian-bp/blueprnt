"use client"

import { Logout01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

export function AdminShell(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  const tAdmin = useTranslations("dashboard.admin")
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3 lg:px-6">
        <Logo label={t("title")} className="h-7 text-brand" />
        <span className="font-medium text-muted-foreground text-sm">
          {tAdmin("platformAdminLabel")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{tAdmin("backToApp")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            {t("nav.signOut")}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
        {props.children}
      </main>
    </div>
  )
}
