"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"

export function DashboardShell() {
  const t = useTranslations("dashboard.overview")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>{t("emptyTitle")}</CardTitle>
              <CardDescription>{t("emptyBody")}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
