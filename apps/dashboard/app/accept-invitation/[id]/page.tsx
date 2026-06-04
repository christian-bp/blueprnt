"use client"

import { AuthLoading, Authenticated, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

export default function AcceptInvitationPage() {
  const t = useTranslations("dashboard.auth")
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)

  return (
    <main>
      <h1>{t("invitation.title")}</h1>
      <AuthLoading>
        <p>{t("loading")}</p>
      </AuthLoading>
      <Unauthenticated>
        <p>
          <Link href="/sign-in">{t("invitation.signInFirst")}</Link>
        </p>
      </Unauthenticated>
      <Authenticated>
        {error ? <p role="alert">{t("error")}</p> : null}
        <button
          type="button"
          onClick={async () => {
            const { error: acceptError } =
              await authClient.organization.acceptInvitation({
                invitationId: params.id,
              })
            if (acceptError) {
              setError(true)
              return
            }
            router.push("/")
          }}
        >
          {t("invitation.accept")}
        </button>
      </Authenticated>
    </main>
  )
}
