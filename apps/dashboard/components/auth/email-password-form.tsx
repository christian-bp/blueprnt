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

export interface EmailPasswordValues {
  email: string
  password: string
}

// Layout based on the shadcn login-01 block, adapted for i18n. Sign-in
// only: accounts are provisioned via the dev seed and, later, the
// invitation flow. There is no self-serve sign-up.
export function EmailPasswordForm(props: {
  onSubmit: (values: EmailPasswordValues) => Promise<void>
}) {
  const t = useTranslations("dashboard.auth")
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError(false)
    try {
      await props.onSubmit({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      })
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signIn.title")}</CardTitle>
        <CardDescription>{t("signIn.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <Input id="password" name="password" type="password" required />
            </Field>
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPasswordLink")}
            </Link>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            ) : null}
            <Field>
              <Button type="submit" disabled={pending}>
                {t("signIn.cta")}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
