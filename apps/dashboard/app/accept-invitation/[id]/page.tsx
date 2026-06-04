"use client"

import { Authenticated, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

// AuthClient from @convex-dev/better-auth uses a portable union type that
// omits plugin-specific methods. The organization plugin IS registered at
// runtime (see lib/auth-client.ts), so we cast locally to call acceptInvitation.
// This cast is intentional and narrowly scoped.
type WithOrganization = {
  organization: {
    acceptInvitation: (args: {
      invitationId: string
    }) => Promise<{ error: unknown | null }>
  }
}

export default function AcceptInvitationPage() {
  const t = useTranslations("dashboard.auth")
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)

  return (
    <main>
      <h1>{t("invitation.title")}</h1>
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
            const { error: acceptError } = await (
              authClient as unknown as WithOrganization
            ).organization.acceptInvitation({
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
