"use client"

import { SettingsFrame, SettingsRow } from "@/components/settings-frame"
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
        callbackURL: "/change-email?step=confirmed",
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
      <SettingsFrame title={t("title")} description={t("description")}>
        <div className="space-y-1 px-5 py-4">
          <p className="font-medium text-sm">{t("confirmationTitle")}</p>
          <p className="text-muted-foreground text-sm">
            {t("confirmationBody")}
          </p>
        </div>
      </SettingsFrame>
    )
  }

  return (
    <SettingsFrame
      title={t("title")}
      description={t("description")}
      footer={
        <SubmitButton
          type="submit"
          form="change-email-form"
          isSubmitting={isSubmitting}
          disabled={!isValid}
        >
          {t("change")}
        </SubmitButton>
      }
    >
      <SettingsRow label={t("currentLabel")} align="center">
        <p className="text-sm">{currentEmail}</p>
      </SettingsRow>
      <Form {...form}>
        <form id="change-email-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  label={
                    <span className="flex items-center gap-1.5">
                      <FormLabel>{t("newLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("changeEmailLabel")}>
                        {tHelp("changeEmailBody")}
                      </HelpMorphButton>
                    </span>
                  }
                >
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
          {error && (
            <p role="alert" className="px-5 pb-3 text-destructive text-sm">
              {t("error")}
            </p>
          )}
        </form>
      </Form>
    </SettingsFrame>
  )
}
