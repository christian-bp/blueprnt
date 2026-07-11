"use client"

import {
  MoreVerticalCircle01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { useQuery } from "convex/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

// Switch-only company picker. Additional companies and memberships are
// provisioned by the back-office platform admin (ADR-0009); only the first org
// is created in-app during onboarding. So there is deliberately no create or
// add affordance here.
export function NavOrganization() {
  const { isMobile } = useSidebar()
  const t = useTranslations("dashboard")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()
  // The active org's uploaded logo (org-domain content). Resolved from the
  // settings mirror; the switcher shows it for the active org and falls back to
  // initials otherwise.
  const activeOrgId = active.data?.id
  const settings = useQuery(
    api.accounts.organization.getOrganizationSettings,
    activeOrgId ? { orgId: activeOrgId } : "skip"
  )
  const logoUrl = settings?.imageUrl ?? null

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
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t("orgSwitcher.switch")}
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:-mx-px group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center"
              />
            }
          >
            <Avatar
              key={logoUrl ?? "no-logo"}
              variant="brand"
              className="shrink-0 group-data-[collapsible=icon]:size-9"
            >
              {logoUrl ? (
                <AvatarImage src={logoUrl} alt={current.name} />
              ) : null}
              <AvatarFallback>{initialsOf(current.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{current.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {t("orgSwitcher.label")}
              </span>
            </div>
            <HugeiconsIcon
              icon={MoreVerticalCircle01Icon}
              strokeWidth={2}
              className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            // align start (not end like NavUser): this trigger sits at the TOP
            // of the sidebar, so the menu drops down from the trigger's top edge.
            align="start"
            sideOffset={4}
          >
            {/* Base UI group labels must sit inside a Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
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
                      {org.id === current?.id && logoUrl ? (
                        <AvatarImage src={logoUrl} alt={org.name} />
                      ) : null}
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
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
