"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  makeChangeEmailSchema,
  type ChangeEmailValues,
} from "@/lib/account-schemas"

// The change-email form triggers Better Auth's double opt-in flow:
// 1. A confirmation link goes to the CURRENT inbox so only the owner can approve.
// 2. A verification link goes to the NEW inbox to confirm ownership.
// Both links must be clicked before the change takes effect.
export function ChangeEmailForm() {
  const t = useTranslations("dashboard.account.email")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")

  const session = authClient.useSession()
  const currentEmail = session.data?.user.email ?? ""

  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(false)

  const schema = useMemo(
    () => makeChangeEmailSchema(tv, currentEmail),
    [tv, currentEmail]
  )

  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ChangeEmailValues) {
    setError(false)
    try {
      const { error: changeError } = await authClient.changeEmail({
        newEmail: values.email,
        callbackURL: "/account/email-verified",
      })
      if (changeError) {
        setError(true)
        return
      }
      setConfirmed(true)
    } catch {
      setError(true)
    }
  }

  const { isValid, isSubmitting } = form.formState

  if (confirmed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium text-sm">{t("confirmationTitle")}</p>
          <p className="text-muted-foreground text-sm">
            {t("confirmationBody")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">{t("currentLabel")}</p>
            <p className="text-sm">{currentEmail}</p>
          </div>
          <Form {...form}>
            <form
              id="change-email-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>{t("newLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("changeEmailLabel")}>
                        {tHelp("changeEmailBody")}
                      </HelpMorphButton>
                    </div>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        className="max-w-sm"
                        {...field}
                      />
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
            </form>
          </Form>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <SubmitButton
          type="submit"
          form="change-email-form"
          isSubmitting={isSubmitting}
          disabled={!isValid}
        >
          {t("change")}
        </SubmitButton>
      </CardFooter>
    </Card>
  )
}
