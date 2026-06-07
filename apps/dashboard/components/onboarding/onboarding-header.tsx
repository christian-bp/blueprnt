"use client"

import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { LanguageMenuSub } from "@/components/language-menu"

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

export function OnboardingHeader() {
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
    <header className="flex h-14 items-center justify-between px-6">
      <span className="font-semibold text-lg">{t("title")}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("onboarding.accountMenu")}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <LanguageMenuSub />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            {t("nav.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
