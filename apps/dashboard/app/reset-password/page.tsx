"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Logo } from "@/components/logo"
import { usePageTitle } from "@/hooks/use-page-title"
import { authClient } from "@/lib/auth-client"

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tApp = useTranslations("dashboard")
  usePageTitle(t("title"))
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  // Mirror the server's minPasswordLength (better-auth emailAndPassword); the
  // server stays authoritative, this only blocks an obviously-too-short submit.
  const MIN_PASSWORD_LENGTH = 8

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (token === null || password.length < MIN_PASSWORD_LENGTH) return
    setPending(true)
    setError(false)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (resetError) {
        setError(true)
        return
      }
      router.push("/")
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={tApp("title")} className="h-10 self-center text-brand" />
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {token === null ? (
              <p role="alert" className="text-destructive text-sm">
                {t("missingToken")}
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-password">
                      {t("passwordLabel")}
                    </FieldLabel>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  {error && (
                    <p role="alert" className="text-destructive text-sm">
                      {t("error")}
                    </p>
                  )}
                  <Field>
                    <Button
                      type="submit"
                      disabled={
                        pending || password.length < MIN_PASSWORD_LENGTH
                      }
                    >
                      {t("cta")}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
