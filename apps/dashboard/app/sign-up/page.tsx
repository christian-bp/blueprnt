"use client"

import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { authClient } from "@/lib/auth-client"

export default function SignUpPage() {
  const router = useRouter()
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <EmailPasswordForm
          mode="signUp"
          onSubmit={async ({ email, password, name }) => {
            const { error } = await authClient.signUp.email({
              email,
              password,
              name: name ?? "",
            })
            if (error) throw error
            router.push("/")
          }}
        />
      </div>
    </main>
  )
}
