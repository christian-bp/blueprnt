"use client"

import {
  AiChat02Icon,
  Audit02Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  ChartColumnIcon,
  DashboardSquare02Icon,
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
import { SECTION_PAGES } from "@/lib/section-pages"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("dashboard")
  const { role } = useOrganization()

  // A section's sub-pages come from SECTION_PAGES, the same list its header
  // tabs render, so the sidebar and the header cannot drift apart.
  const subPages = (section: keyof typeof SECTION_PAGES) =>
    SECTION_PAGES[section].map((page) => ({
      title: t(page.labelKey),
      url: page.href,
    }))

  // The dashboard landing. It gets its own heading like every other
  // destination (a single uncaptioned row above captioned ones reads as a
  // stray), and the dashboard grid rather than a house: the page is a panel of
  // widgets, and a house would promise a "home" concept the app does not have.
  const navStatus: NavItem[] = [
    {
      title: t("nav.home"),
      url: "/",
      icon: <HugeiconsIcon icon={DashboardSquare02Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.assistant"),
      url: "/assistant",
      icon: <HugeiconsIcon icon={AiChat02Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.docs"),
      url: "/docs",
      icon: <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} />,
    },
  ]

  // Job evaluation: the role world and the model that values it. Job
  // architecture owns both the level Overview at /work and the role register at
  // /roles, so it is a single item here that stays active across both paths.
  const navEvaluation: NavItem[] = [
    {
      title: t("nav.work"),
      url: "/work",
      match: ["/roles"],
      icon: <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />,
      items: subPages("work"),
    },
    {
      title: t("nav.model"),
      url: "/model",
      icon: <HugeiconsIcon icon={Layers01Icon} strokeWidth={2} />,
      items: subPages("model"),
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
      items: subPages("people"),
    },
    // Pay mappings has no static sub-pages: inside one kartläggning the
    // header owns the per-run tabs (they are scoped to the run's slug).
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
      items: subPages("organization"),
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
        <NavMain label={t("nav.groups.status")} items={navStatus} />
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
