"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { type FormEvent, useState } from "react"

export interface EmailPasswordValues {
  email: string
  password: string
  name?: string
}

// Layout based on the shadcn login-01 block, adapted for i18n and the
// shared sign-in/sign-up behavior.
export function EmailPasswordForm(props: {
  mode: "signIn" | "signUp"
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
        name: data.get("name") === null ? undefined : String(data.get("name")),
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
        <CardTitle>{t(`${props.mode}.title`)}</CardTitle>
        <CardDescription>{t(`${props.mode}.description`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {props.mode === "signUp" ? (
              <Field>
                <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
                <Input id="name" name="name" type="text" required />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={props.mode === "signUp" ? 8 : undefined}
              />
            </Field>
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            ) : null}
            <Field>
              <Button type="submit" disabled={pending}>
                {t(`${props.mode}.cta`)}
              </Button>
              <FieldDescription className="text-center">
                {props.mode === "signIn" ? (
                  <>
                    {t("signIn.noAccount")}{" "}
                    <Link href="/sign-up">{t("signUp.cta")}</Link>
                  </>
                ) : (
                  <>
                    {t("signUp.haveAccount")}{" "}
                    <Link href="/">{t("signIn.cta")}</Link>
                  </>
                )}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
