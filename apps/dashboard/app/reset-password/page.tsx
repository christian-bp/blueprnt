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

// A reset token is one-time and expires; Better Auth rejects a spent or stale
// one with a 400 carrying code "INVALID_TOKEN". Surface a clear "request a new
// link" message rather than the generic failure.
function isInvalidToken(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "INVALID_TOKEN"
  )
}

// Every way a link can fail ends in the same recovery, so the message varies
// but the way out does not. Shared by both failure paths: the token rejected on
// submit, and the link that arrives already spent.
function LinkProblem({ message }: { message: string }) {
  const t = useTranslations("dashboard.auth.resetPassword")
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}{" "}
      <Link href="/forgot-password" className="underline underline-offset-4">
        {t("requestNew")}
      </Link>
    </p>
  )
}

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tv = useTranslations("dashboard.validation")
  usePageTitle(t("title"))
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  // Better Auth's /reset-password/:token endpoint redirects a spent or expired
  // link here with `?error=INVALID_TOKEN` and NO token at all, so the token has
  // to be read together with the error: on its own, a missing token cannot tell
  // an expired link apart from a malformed one.
  const linkExpired = params.get("error") === "INVALID_TOKEN"
  const [error, setError] = useState<"generic" | "invalidToken" | null>(null)

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
        setError(isInvalidToken(resetError) ? "invalidToken" : "generic")
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
          <LinkProblem
            message={linkExpired ? t("expired") : t("missingToken")}
          />
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
                <LinkProblem message={t("expired")} />
              ) : error ? (
                <p role="alert" className="text-destructive text-sm">
                  {t("error")}
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
