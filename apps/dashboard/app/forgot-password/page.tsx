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
import { AuthShell } from "@/components/auth/auth-shell"
import { SubmitButton } from "@/components/submit-button"
import {
  type ForgotPasswordValues,
  makeForgotPasswordSchema,
} from "@/lib/auth-schemas"
import { authClient } from "@/lib/auth-client"
import { usePageTitle } from "@/hooks/use-page-title"

export default function ForgotPasswordPage() {
  const t = useTranslations("dashboard.auth.forgotPassword")
  const tApp = useTranslations("dashboard")
  const tv = useTranslations("dashboard.validation")
  usePageTitle(t("title"))
  const [submitted, setSubmitted] = useState(false)

  const schema = useMemo(() => makeForgotPasswordSchema(tv), [tv])
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    // Enumeration-safe: show the same confirmation whether the request
    // succeeds, the email is unknown, or it is rate-limited. We never reveal
    // which addresses are registered, so a thrown error is swallowed here.
    try {
      await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      })
    } catch {
      // intentionally ignored (enumeration-safe)
    } finally {
      setSubmitted(true)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <AuthHeading title={t("title")} description={t("description")} />
        {submitted ? (
          <div className="space-y-6 text-center">
            <p className="text-muted-foreground text-sm" role="status">
              {t("confirmation")}
            </p>
            <Link
              href="/"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="justify-center">
                      {tApp("auth.email")}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" className="text-center" {...field} />
                    </FormControl>
                    <FormMessage className="text-center" />
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
              <Link
                href="/"
                className="block text-center text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                {t("backToSignIn")}
              </Link>
            </form>
          </Form>
        )}
      </div>
    </AuthShell>
  )
}
