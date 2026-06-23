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
import Link from "next/link"
import { type FormEvent, useState } from "react"
import { Logo } from "@/components/logo"
import { usePageTitle } from "@/hooks/use-page-title"
import { authClient } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  const t = useTranslations("dashboard.auth.forgotPassword")
  const tApp = useTranslations("dashboard")
  usePageTitle(t("title"))
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") ?? "")
    setPending(true)
    // Enumeration-safe: show the same confirmation whether the request
    // succeeds, the email is unknown, or it is rate-limited. We never reveal
    // which addresses are registered, so a thrown error is swallowed here.
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
    } catch {
      // intentionally ignored (enumeration-safe)
    } finally {
      setSubmitted(true)
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
            {submitted ? (
              <FieldGroup>
                <p className="text-muted-foreground text-sm" role="status">
                  {t("confirmation")}
                </p>
                <Link
                  href="/"
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                >
                  {t("backToSignIn")}
                </Link>
              </FieldGroup>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">
                      {tApp("auth.email")}
                    </FieldLabel>
                    <Input id="email" name="email" type="email" required />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={pending}>
                      {t("cta")}
                    </Button>
                  </Field>
                  <Link
                    href="/"
                    className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                  >
                    {t("backToSignIn")}
                  </Link>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
