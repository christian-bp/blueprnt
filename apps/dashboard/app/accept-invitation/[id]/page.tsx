"use client"

import { AuthLoading, Authenticated, Unauthenticated } from "convex/react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { usePageTitle } from "@/hooks/use-page-title"
import { authClient } from "@/lib/auth-client"

export default function AcceptInvitationPage() {
  const t = useTranslations("dashboard.auth")
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)
  usePageTitle(t("invitation.title"))

  return (
    <main>
      <h1>{t("invitation.title")}</h1>
      <AuthLoading>
        <Spinner aria-label={t("loading")} />
      </AuthLoading>
      <Unauthenticated>
        <p>
          <Link href="/">{t("invitation.signInFirst")}</Link>
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
