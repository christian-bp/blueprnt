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
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
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

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tv = useTranslations("dashboard.validation")
  usePageTitle(t("title"))
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const [error, setError] = useState<"generic" | "compromised" | null>(null)

  const schema = useMemo(() => makeResetPasswordSchema(tv), [tv])
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "" },
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
        setError(isPasswordCompromised(resetError) ? "compromised" : "generic")
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
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-semibold text-xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
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
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {t(error === "compromised" ? "compromised" : "error")}
                </p>
              )}
              <SubmitButton
                type="submit"
                className="w-full"
                isSubmitting={form.formState.isSubmitting}
                disabled={!form.formState.isValid}
              >
                {t("cta")}
              </SubmitButton>
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
