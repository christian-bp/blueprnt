"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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

// Derive at most two initials from the display name, or fall back to the
// first letter of the email address, or "?" if neither is available.
function deriveInitials(name: string, email: string): string {
  if (name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
  }
  if (email.length > 0) {
    return (email[0] ?? "").toUpperCase()
  }
  return "?"
}

// The signed-in user's account menu: switch company, change language, sign out.
// Used in the auth/onboarding shell's headerRight slot.
export function AccountMenu() {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const initials = deriveInitials(name, email)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Lets the user switch away from a bare company's onboarding to an
            onboarded one; renders nothing with fewer than two companies. */}
        <OrgSwitchMenuSub />
        <LanguageMenuSub />
        <DropdownMenuItem asChild>
          <Link href="/account">{t("nav.accountSettings")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
