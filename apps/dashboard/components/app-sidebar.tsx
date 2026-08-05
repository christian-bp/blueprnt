"use client"

import {
  Audit02Icon,
  Briefcase01Icon,
  ChartColumnIcon,
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

  // Home is the dashboard landing: the one destination that belongs to no
  // category, so it sits above the labeled groups without a heading of its own.
  const navHome: NavItem[] = [
    {
      title: t("nav.home"),
      url: "/",
      icon: <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />,
    },
  ]

  // Job evaluation: the role world and the model that values it. Job
  // architecture owns both the level Overview at /work and the role register at
  // /roles; its two sub-pages are switched from header tabs (SectionTabs), so
  // it is a single flat item here that stays active across both paths.
  const navEvaluation: NavItem[] = [
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
  ]

  // People & pay: the employee register and the pay mappings built from it.
  // These are the person-data surfaces, kept apart from the role world both in
  // the nav and in the domain (Role != Person).
  const navPeoplePay: NavItem[] = [
    {
      title: t("nav.people"),
      url: "/people",
      icon: <HugeiconsIcon icon={UserGroup03Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.payMapping"),
      url: "/pay-mappings",
      icon: <HugeiconsIcon icon={ChartColumnIcon} strokeWidth={2} />,
    },
  ]

  // Admin-only destinations (team/org settings and the org's event trail),
  // shown as their own labeled group below the work nav. The adminQuery is the
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
        <NavMain items={navHome} />
        <NavMain label={t("nav.groups.evaluation")} items={navEvaluation} />
        <NavMain label={t("nav.groups.peoplePay")} items={navPeoplePay} />
        {navAdmin.length > 0 ? (
          <NavMain label={t("nav.groups.administration")} items={navAdmin} />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
