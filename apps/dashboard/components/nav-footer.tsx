"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ACTIVE_CLASSES, RAIL_CLASSES } from "@/components/nav-main"
import { NavSearch } from "@/components/nav-search"
import { isNavActive, NAV_DOCS } from "@/lib/navigation"

// The sidebar footer's own destinations, above the account row: the user guide
// is a reference surface rather than one of the work areas, so it sits here
// instead of in a nav group. It renders the same SidebarMenuButton as a nav
// entry, with the same rail and active treatment, so collapsing the sidebar
// leaves a glyph with a tooltip exactly like the rows above it. Unlike NavMain
// it renders no SidebarGroup: SidebarFooter already carries that padding, and
// nesting a group here would double it and break the alignment with NavUser.
export function NavFooter() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const title = t(NAV_DOCS.labelKey)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isNavActive(pathname, NAV_DOCS.href, NAV_DOCS.match)}
          tooltip={title}
          className={`${RAIL_CLASSES} ${ACTIVE_CLASSES}`}
          render={<Link href={NAV_DOCS.href} />}
        >
          <HugeiconsIcon icon={NAV_DOCS.icon} strokeWidth={2} />
          <span>{title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {/* Below Documentation: the footer reads Documentation, Search, then
          the user. Only the row lives here; the palette it opens is mounted
          above the sidebar (CommandPaletteProvider), because everything in
          here is unmounted with the navigation sheet on a narrow window. */}
      <NavSearch />
    </SidebarMenu>
  )
}
