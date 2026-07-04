"use client"

import {
  Audit02Icon,
  Briefcase01Icon,
  Home01Icon,
  Layers01Icon,
  UserGroup03Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import type * as React from "react"
import { type NavItem, NavMain } from "@/components/nav-main"
import { NavOrganization } from "@/components/nav-organization"
import { NavUser } from "@/components/nav-user"
import { useOrganization } from "@/components/org-context"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("dashboard")
  const { role } = useOrganization()

  // Home is the dashboard landing. Job architecture owns the role world (the
  // band Overview at /work and the role register at /roles); its two sub-pages
  // are switched from header tabs (SectionTabs), so it is a single flat item
  // here that stays active across both paths. Model edits the assessment model.
  const navMain: NavItem[] = [
    {
      title: t("nav.home"),
      url: "/",
      icon: <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.work"),
      url: "/work",
      match: ["/roles"],
      icon: <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.model"),
      url: "/model",
      icon: <HugeiconsIcon icon={Layers01Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.people"),
      url: "/people",
      icon: <HugeiconsIcon icon={UserGroup03Icon} strokeWidth={2} />,
    },
  ]

  // Admin-only destinations (team/org settings and the org's event trail),
  // shown below a separator from the primary work nav. The adminQuery is the
  // real gate; hiding the items just keeps them out of editors' sight.
  const navAdmin: NavItem[] = []
  if (role === "admin") {
    navAdmin.push({
      title: t("nav.organization"),
      url: "/organization",
      icon: <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} />,
    })
    navAdmin.push({
      title: t("nav.auditLog"),
      url: "/audit-log",
      icon: <HugeiconsIcon icon={Audit02Icon} strokeWidth={2} />,
    })
  }

  return (
    // collapsible="icon" (the sidebar-07 pattern): collapsing shrinks the
    // sidebar to an icon rail instead of removing it. The inset variant set
    // by AppShell keeps the rounded content panel in both states.
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavOrganization />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {navAdmin.length > 0 ? (
          <>
            <SidebarSeparator />
            <NavMain items={navAdmin} />
          </>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
