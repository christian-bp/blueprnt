"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

// Rendered at / for unauthenticated visitors. Email + password first; if Better
// Auth requires a second factor (twoFactorRedirect), swap to the challenge
// before the session is created. On full success the reactive auth state swaps
// the route to the dashboard shell.
export function SignInScreen() {
  const router = useRouter()
  const t = useTranslations("dashboard")
  const [phase, setPhase] = useState<"credentials" | "challenge">("credentials")

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={t("title")} className="h-10 self-center text-brand" />
        {phase === "credentials" ? (
          <EmailPasswordForm
            onSubmit={async ({ email, password }) => {
              const { data, error } = await authClient.signIn.email({
                email,
                password,
              })
              if (error) throw error
              // 2FA-enabled users get twoFactorRedirect instead of a session.
              if (
                data !== null &&
                typeof data === "object" &&
                "twoFactorRedirect" in data &&
                data.twoFactorRedirect === true
              ) {
                setPhase("challenge")
                return
              }
              router.push("/")
            }}
          />
        ) : (
          <TwoFactorChallenge onVerified={() => router.push("/")} />
        )}
      </div>
    </main>
  )
}
