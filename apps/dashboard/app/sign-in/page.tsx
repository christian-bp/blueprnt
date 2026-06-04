"use client"

import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { authClient } from "@/lib/auth-client"

export default function SignInPage() {
  const router = useRouter()
  return (
    <main>
      <EmailPasswordForm
        mode="signIn"
        onSubmit={async ({ email, password }) => {
          const { error } = await authClient.signIn.email({ email, password })
          if (error) throw error
          router.push("/")
        }}
      />
    </main>
  )
}
