"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

// A nav entry is either a leaf link (url) or a parent group (items).
export type NavItem = {
  title: string
  url?: string
  icon?: React.ReactNode
  items?: { title: string; url: string }[]
}

// The collapsed icon-rail tweaks shared by the leaf link and the group
// trigger: 20px icon, centered square, label hidden when collapsed.
const RAIL_CLASSES =
  "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5! [&_svg]:size-5 group-data-[collapsible=icon]:[&_span]:hidden"

// Primary navigation. A leaf is active when its URL prefixes the path ("/"
// matches exactly); a group is active when any child is active. A group keeps
// its submenu reachable in BOTH sidebar states: inline (Collapsible) when the
// rail is expanded, and as a flyout dropdown off the icon when the rail is
// collapsed (the inline SidebarMenuSub is hidden in the icon rail, so a
// submenu alone would leave the children unreachable there).
export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.items === undefined) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url !== undefined && isActive(item.url)}
                    tooltip={item.title}
                    className={RAIL_CLASSES}
                  >
                    <Link href={item.url ?? "#"}>
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            const subItems = item.items
            const groupActive = subItems.some((sub) => isActive(sub.url))

            // Collapsed icon rail: the inline submenu is hidden, so the parent
            // icon opens a flyout dropdown with the children instead.
            if (collapsed) {
              return (
                <SidebarMenuItem key={item.title}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        aria-label={item.title}
                        isActive={groupActive}
                        className={RAIL_CLASSES}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      className="min-w-44"
                    >
                      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                      {subItems.map((sub) => (
                        <DropdownMenuItem key={sub.title} asChild>
                          <Link href={sub.url}>{sub.title}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              )
            }

            // Expanded rail: inline collapsible submenu, open when active.
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={groupActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={groupActive}
                      tooltip={item.title}
                      className={RAIL_CLASSES}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="ml-auto !size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {subItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(sub.url)}
                          >
                            <Link href={sub.url}>
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
