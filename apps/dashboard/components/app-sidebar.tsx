"use client"

import {
  Briefcase01Icon,
  Home01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import type * as React from "react"
import { type NavItem, NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("dashboard")

  // Home is the dashboard landing. Work groups the role world: the band
  // Overview and the role register. Results was removed; its band view moved
  // into Work > Overview.
  const navMain: NavItem[] = [
    {
      title: t("nav.home"),
      url: "/",
      icon: <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.work"),
      icon: <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />,
      items: [
        { title: t("nav.overview"), url: "/work" },
        { title: t("nav.roles"), url: "/roles" },
      ],
    },
    {
      title: t("nav.model"),
      url: "/model",
      icon: <HugeiconsIcon icon={Layers01Icon} strokeWidth={2} />,
    },
  ]

  return (
    // collapsible="icon" (the sidebar-07 pattern): collapsing shrinks the
    // sidebar to an icon rail instead of removing it. The inset variant set
    // by AppShell keeps the rounded content panel in both states.
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
