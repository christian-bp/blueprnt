"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

// Switch-only company picker as a submenu for an avatar/account menu. Used in
// the onboarding header so a user can leave a bare company's onboarding wizard
// for an onboarded one (switching the active company re-resolves the gate).
// Renders nothing unless the user belongs to more than one company (nothing to
// switch to), so a single-company menu is unchanged. Mirrors LanguageMenuSub;
// the dashboard sidebar uses NavOrganization instead.
export function OrgSwitchMenuSub() {
  const t = useTranslations("dashboard")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const list = orgs.data ?? []
  if (list.length < 2) return null
  const current = list.find((o) => o.id === active.data?.id) ?? list[0]
  if (current === undefined) return null

  async function handleSelect(orgId: string) {
    if (orgId === current?.id) return
    await authClient.organization.setActive({ organizationId: orgId })
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Avatar className="size-5 shrink-0">
          <AvatarFallback className="text-xs">
            {initialsOf(current.name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{current.name}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("orgSwitcher.label")}
        </DropdownMenuLabel>
        {list.map((org) => {
          const isActive = org.id === current?.id
          return (
            <DropdownMenuItem
              key={org.id}
              aria-current={isActive ? "true" : undefined}
              className="gap-2"
              onClick={() => handleSelect(org.id)}
            >
              <Avatar className="size-5 shrink-0">
                <AvatarFallback className="text-xs">
                  {initialsOf(org.name)}
                </AvatarFallback>
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
