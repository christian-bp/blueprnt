"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Logo } from "@/components/logo"
import { SubmitButton } from "@/components/submit-button"
import {
  makeResetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth-schemas"
import { authClient } from "@/lib/auth-client"
import { usePageTitle } from "@/hooks/use-page-title"

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tApp = useTranslations("dashboard")
  const tv = useTranslations("dashboard.validation")
  usePageTitle(t("title"))
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const [error, setError] = useState(false)

  const schema = useMemo(() => makeResetPasswordSchema(tv), [tv])
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "" },
  })

  async function onSubmit(values: ResetPasswordValues) {
    if (token === null) return
    setError(false)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: values.password,
        token,
      })
      if (resetError) {
        setError(true)
        return
      }
      router.push("/")
    } catch {
      setError(true)
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
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("passwordLabel")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {error && (
                    <p role="alert" className="text-destructive text-sm">
                      {t("error")}
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
