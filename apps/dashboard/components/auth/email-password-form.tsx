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
  const [error, setError] = useState<"generic" | "rateLimited" | null>(null)

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
      setError(isRateLimitError(e) ? "rateLimited" : "generic")
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
                <FormLabel className="justify-center">{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" className="text-center" {...field} />
                </FormControl>
                <FormMessage className="text-center" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="justify-center">
                  {t("password")}
                </FormLabel>
                <FormControl>
                  <PasswordInput className="text-center" {...field} />
                </FormControl>
                <FormMessage className="text-center" />
              </FormItem>
            )}
          />
          <Link
            href="/forgot-password"
            className="block text-center text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {t("forgotPasswordLink")}
          </Link>
          {error ? (
            <p role="alert" className="text-center text-destructive text-sm">
              {error === "rateLimited" ? t("rateLimited") : t("error")}
            </p>
          ) : null}
          <SubmitButton
            type="submit"
            className="w-full"
            isSubmitting={form.formState.isSubmitting}
            disabled={!form.formState.isValid}
          >
            {t("signIn.cta")}
          </SubmitButton>
        </form>
      </Form>
    </div>
  )
}
