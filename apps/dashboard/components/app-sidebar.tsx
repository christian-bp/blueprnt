"use client"

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
import { NavFooter } from "@/components/nav-footer"
import { type NavItem, NavMain } from "@/components/nav-main"
import { NavOrganization } from "@/components/nav-organization"
import { NavUser } from "@/components/nav-user"
import { useOrganization } from "@/components/org-context"
import { navGroupsFor } from "@/lib/navigation"
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

  // The groups, their order and their admin gating all come from the shared
  // navigation registry; this component only turns entries into rendered rows.
  // navGroupsFor drops a group whose entries an editor may not see, so the
  // administration heading never appears empty.
  const groups = navGroupsFor(role).map((group) => ({
    labelKey: group.labelKey,
    label: t(group.labelKey),
    items: group.entries.map(
      (entry): NavItem => ({
        title: t(entry.labelKey),
        url: entry.href,
        icon: <HugeiconsIcon icon={entry.icon} strokeWidth={2} />,
        match: entry.match ? [...entry.match] : undefined,
        items: entry.section ? subPages(entry.section) : undefined,
      })
    ),
  }))

  return (
    // collapsible="icon" (the sidebar-07 pattern): collapsing shrinks the
    // sidebar to an icon rail instead of removing it. The inset variant set
    // by AppShell keeps the rounded content panel in both states.
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavOrganization />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavMain
            key={group.labelKey}
            label={group.label}
            items={group.items}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavFooter />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
