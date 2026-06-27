"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { AuthHeading } from "@/components/auth/auth-heading"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { makeSignInSchema, type SignInValues } from "@/lib/auth-schemas"

// Better Auth surfaces a rate-limited request as HTTP 429 (the Convex auth
// proxy passes the status through verbatim). Detect it so a throttled user
// gets a distinct message instead of the generic failure.
function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  )
}

// Better Auth rejects bad credentials with HTTP 401 and the code
// INVALID_EMAIL_OR_PASSWORD (the same code for a wrong password and an unknown
// email, so the message stays enumeration-safe). Surface a credentials message
// rather than the generic "something went wrong".
function isInvalidCredentials(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const e = error as { code?: unknown; status?: unknown }
  return e.code === "INVALID_EMAIL_OR_PASSWORD" || e.status === 401
}

// Maps a sign-in failure to its message key under dashboard.auth.
function signInErrorKey(
  error: unknown
): "error" | "rateLimited" | "invalidCredentials" {
  if (isRateLimitError(error)) return "rateLimited"
  if (isInvalidCredentials(error)) return "invalidCredentials"
  return "error"
}

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
  const tv = useTranslations("dashboard.validation")
  const [error, setError] = useState<
    "error" | "rateLimited" | "invalidCredentials" | null
  >(null)

  const schema = useMemo(() => makeSignInSchema(tv), [tv])
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: SignInValues) {
    setError(null)
    try {
      await props.onSubmit(values)
    } catch (e) {
      setError(signInErrorKey(e))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("signIn.title")}
        description={t("signIn.description")}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                {/* Forgot-password link sits inline with the label, pushed to
                    the right (the shadcn login layout). */}
                <div className="flex items-center">
                  <FormLabel>{t("password")}</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    {t("forgotPasswordLink")}
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SubmitButton
            type="submit"
            className="w-full"
            isSubmitting={form.formState.isSubmitting}
            disabled={!form.formState.isValid}
          >
            {t("signIn.cta")}
          </SubmitButton>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {t(error)}
            </p>
          ) : null}
        </form>
      </Form>
    </div>
  )
}
