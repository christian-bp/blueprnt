"use client"

import { authClient } from "@/lib/auth-client"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { useSidebar } from "@workspace/ui/components/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout01Icon,
  Settings01Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LanguageMenuSub } from "@/components/language-menu"
import { initialsOf } from "@/lib/initials"

export function NavUser() {
  const { isMobile } = useSidebar()
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const isPlatformAdmin = useQuery(api.platform.admin.isPlatformAdmin)

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const initials = initialsOf(name, email)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <DropdownMenu>
      {/* The rail's account row: avatar only, an icon square like the area
          buttons above it; everything the row used to say (name, email) lives
          in the menu header. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("accountMenu")}
            className="size-8 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          />
        }
      >
        <Avatar
          key={session?.user?.image || "no-avatar"}
          size="sm"
          className="shrink-0"
        >
          {session?.user?.image ? (
            <AvatarImage src={session.user.image} alt={name} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--anchor-width) min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        {/* Base UI group labels must sit inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar key={session?.user?.image || "no-avatar"}>
                {session?.user?.image ? (
                  <AvatarImage src={session.user.image} alt={name} />
                ) : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <LanguageMenuSub />
        {isPlatformAdmin === true && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            {t("nav.admin")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/account" />}>
          <HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
          {t("nav.accountSettings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
