"use client"

import {
  MoreVerticalCircle01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

// Switch-only company picker. Companies and memberships are provisioned by a
// back-office admin interface (ADR-0007), so there is deliberately no create
// or add affordance here.
export function NavOrganization() {
  const { isMobile } = useSidebar()
  const t = useTranslations("dashboard")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const list = orgs.data ?? []
  const current = list.find((o) => o.id === active.data?.id) ?? list[0] ?? null
  if (current === null) return null

  async function handleSelect(orgId: string) {
    if (orgId === current?.id) return
    await authClient.organization.setActive({ organizationId: orgId })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t("orgSwitcher.switch")}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:-mx-px group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center"
            >
              <Avatar
                variant="brand"
                className="shrink-0 group-data-[collapsible=icon]:size-9"
              >
                <AvatarFallback>{initialsOf(current.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{current.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("orgSwitcher.label")}
                </span>
              </div>
              <HugeiconsIcon
                icon={MoreVerticalCircle01Icon}
                strokeWidth={2}
                className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            // align start (not end like NavUser): this trigger sits at the TOP
            // of the sidebar, so the menu drops down from the trigger's top edge.
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("orgSwitcher.label")}
            </DropdownMenuLabel>
            {list.map((org) => {
              const isActive = org.id === current?.id
              return (
                <DropdownMenuItem
                  key={org.id}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => handleSelect(org.id)}
                >
                  <Avatar variant="brand" className="size-6 shrink-0">
                    <AvatarFallback>{initialsOf(org.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{org.name}</span>
                  {isActive ? (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className="ml-auto size-4"
                    />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
