"use client"

import {
  Briefcase01Icon,
  PlusSignIcon,
  UserGroup03Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useOrganization } from "@/components/org-context"

// The top bar's Create menu: the app's entry points for new content, by the
// destinations' own names (the same labels their pages carry), navigation
// only. Inviting is admin-gated like its page.
export function CreateMenu() {
  const t = useTranslations("dashboard")
  const { role } = useOrganization()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="gap-1" />}
      >
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" />
        <span className="hidden sm:inline">{t("shell.create")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-52">
        <DropdownMenuItem render={<Link href="/roles" />}>
          <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />
          {t("roles.newCta")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/roles/import" />}>
          <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />
          {t("roles.import.title")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/people/import" />}>
          <HugeiconsIcon icon={UserGroup03Icon} strokeWidth={2} />
          {t("people.import.title")}
        </DropdownMenuItem>
        {role === "admin" && (
          <DropdownMenuItem render={<Link href="/organization/members" />}>
            <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} />
            {t("organization.invite.cta")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
