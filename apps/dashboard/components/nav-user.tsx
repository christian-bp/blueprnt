"use client"

import { authClient } from "@/lib/auth-client"
import { api } from "@workspace/backend/convex/_generated/api"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout01Icon,
  MoreVerticalCircle01Icon,
  Settings01Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LanguageMenuSub } from "@/components/language-menu"

export function NavUser() {
  const { isMobile } = useSidebar()
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const isPlatformAdmin = useQuery(api.platform.admin.isPlatformAdmin)

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // In the collapsed icon square only the avatar remains: the
              // text block and chevron are display-none (their flex-1/gap
              // would otherwise shrink the avatar and push it off center).
              // The square grows to 36px there so the avatar reads slightly
              // larger than the 32px nav squares (matching the bigger nav
              // icons); -mx-px centers the 36px square in the rail's 34px
              // column (1px overhang each side).
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:-mx-px group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="shrink-0 group-data-[collapsible=icon]:size-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {email}
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
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar>
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
            <DropdownMenuSeparator />
            <LanguageMenuSub />
            {isPlatformAdmin === true && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                  {t("nav.admin")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/account">
                <HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
                {t("nav.accountSettings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              {t("nav.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
