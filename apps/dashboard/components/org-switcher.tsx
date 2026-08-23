"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { UpDownChevrons } from "@/components/updown-chevrons"
import { authClient } from "@/lib/auth-client"
import { initialsOf } from "@/lib/initials"

// The top bar's company switcher (the sidebar's old NavOrganization, moved to
// the header's left edge). Switch-only: additional companies and memberships
// are provisioned by the back-office platform admin (ADR-0009), so there is
// deliberately no create or add affordance here.
export function OrgSwitcher() {
  const t = useTranslations("dashboard")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()
  // The active org's uploaded logo (org-domain content), resolved from the
  // settings mirror; the switcher shows it for the active org and falls back
  // to initials otherwise.
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label={t("orgSwitcher.switch")}
            className="max-w-56 gap-2 px-2 font-medium"
          />
        }
      >
        <Avatar
          key={logoUrl ?? "no-logo"}
          variant="brand"
          className="size-5 shrink-0"
        >
          {logoUrl ? <AvatarImage src={logoUrl} alt={current.name} /> : null}
          <AvatarFallback className="text-[10px]">
            {initialsOf(current.name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{current.name}</span>
        {/* Up/down chevrons, not a dots glyph: this control SWAPS the active
            company, it is not an actions menu (the menu is switch-only). */}
        <UpDownChevrons />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side="bottom"
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
                  {isActive && logoUrl ? (
                    <AvatarImage src={logoUrl} alt={org.name} />
                  ) : null}
                  <AvatarFallback>{initialsOf(org.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{org.name}</span>
                {isActive && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="ml-auto"
                    aria-hidden="true"
                  />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
