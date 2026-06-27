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
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { AuthHeading } from "@/components/auth/auth-heading"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import {
  makeResetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth-schemas"
import { authClient } from "@/lib/auth-client"
import { usePageTitle } from "@/hooks/use-page-title"

// Better Auth's haveIBeenPwned plugin rejects a breached password with a 400
// carrying code "PASSWORD_COMPROMISED"; surface a specific message for it.
function isPasswordCompromised(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PASSWORD_COMPROMISED"
  )
}

// Better Auth burns the one-time reset token before hashing the new password, so
// a rejected attempt (e.g. a breached password) leaves the token spent and a
// retry 400s with code "INVALID_TOKEN". Surface a clear "request a new link"
// message rather than the generic failure.
function isInvalidToken(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "INVALID_TOKEN"
  )
}

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tv = useTranslations("dashboard.validation")
  usePageTitle(t("title"))
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const [error, setError] = useState<
    "generic" | "compromised" | "invalidToken" | null
  >(null)

  const schema = useMemo(() => makeResetPasswordSchema(tv), [tv])
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(values: ResetPasswordValues) {
    if (token === null) return
    setError(null)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: values.password,
        token,
      })
      if (resetError) {
        setError(
          isPasswordCompromised(resetError)
            ? "compromised"
            : isInvalidToken(resetError)
              ? "invalidToken"
              : "generic"
        )
        return
      }
      router.push("/")
    } catch {
      setError("generic")
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <AuthHeading title={t("title")} description={t("description")} />
        {token === null ? (
          <p role="alert" className="text-destructive text-sm">
            {t("missingToken")}
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("passwordLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("confirmLabel")}</FormLabel>
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
                {t("cta")}
              </SubmitButton>
              {error === "invalidToken" ? (
                <p role="alert" className="text-destructive text-sm">
                  {t("expired")}{" "}
                  <Link
                    href="/forgot-password"
                    className="underline underline-offset-4"
                  >
                    {t("requestNew")}
                  </Link>
                </p>
              ) : error ? (
                <p role="alert" className="text-destructive text-sm">
                  {t(error === "compromised" ? "compromised" : "error")}
                </p>
              ) : null}
            </form>
          </Form>
        )}
      </div>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
