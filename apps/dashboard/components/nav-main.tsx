"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

// A nav entry is a leaf link. `match` lists extra path-prefixes that also mark
// it active (e.g. Work owns /roles as well as its own /work).
export type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  match?: string[]
}

// The collapsed icon-rail tweaks: 20px icon, centered square, label hidden when
// the rail is collapsed.
const RAIL_CLASSES =
  "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5! [&_svg]:size-5 group-data-[collapsible=icon]:[&_span]:hidden"

// Primary navigation: flat leaf links. A leaf is active on an exact URL match
// or a sub-path (so /work does not match /workspace); the optional `match`
// prefixes extend that (Work is active across /work and /roles). Sub-navigation
// within a section lives in the header (SectionTabs), not here, so this stays a
// plain flat menu that reads identically in the expanded and collapsed rail.
export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const isActive = (url: string) =>
    url === "/"
      ? pathname === "/"
      : pathname === url || pathname.startsWith(`${url}/`)
  const itemActive = (item: NavItem) =>
    isActive(item.url) || (item.match?.some(isActive) ?? false)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={itemActive(item)}
                tooltip={item.title}
                className={RAIL_CLASSES}
              >
                <Link href={item.url}>
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
