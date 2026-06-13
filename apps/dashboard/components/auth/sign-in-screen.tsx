"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

// Rendered at / for unauthenticated visitors; after sign-in the reactive
// auth state swaps the route to the dashboard shell.
export function SignInScreen() {
  const router = useRouter()
  const t = useTranslations("dashboard")
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={t("title")} className="h-10 self-center text-brand" />
        <EmailPasswordForm
          onSubmit={async ({ email, password }) => {
            const { error } = await authClient.signIn.email({
              email,
              password,
            })
            if (error) throw error
            router.push("/")
          }}
        />
      </div>
    </main>
  )
}
