"use client"

import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { authClient } from "@/lib/auth-client"

export default function SignInPage() {
  const router = useRouter()
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <EmailPasswordForm
          mode="signIn"
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
