"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"
import { authClient } from "@/lib/auth-client"

// Rendered at / for unauthenticated visitors. Email + password first; if Better
// Auth requires a second factor (twoFactorRedirect), swap to the challenge
// before the session is created. On full success the reactive auth state swaps
// the route to the dashboard shell.
export function SignInScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<"credentials" | "challenge">("credentials")

  return (
    <AuthShell>
      {phase === "credentials" ? (
        <EmailPasswordForm
          onSubmit={async ({ email, password }) => {
            const { data, error } = await authClient.signIn.email({
              email,
              password,
            })
            if (error) throw error
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
    </AuthShell>
  )
}
