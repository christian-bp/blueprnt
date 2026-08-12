"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LanguageMenuSub } from "@/components/language-menu"
import { OrgSwitchMenuSub } from "@/components/org-switch-menu"
import { authClient } from "@/lib/auth-client"
import { initialsOf } from "@/lib/initials"

// The signed-in user's account menu: switch company, change language, sign out.
// Used in the auth/onboarding shell's headerRight slot.
export function AccountMenu() {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const initials = initialsOf(name, email)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar key={session?.user?.image || "no-avatar"} className="h-8 w-8">
          {session?.user?.image ? (
            <AvatarImage src={session.user.image} alt={name} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Lets the user switch away from a bare company's onboarding to an
            onboarded one; renders nothing with fewer than two companies. */}
        <OrgSwitchMenuSub />
        <LanguageMenuSub />
        <DropdownMenuItem render={<Link href="/account" />}>
          {t("nav.accountSettings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
