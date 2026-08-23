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
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  makeChangePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/account-schemas"

// Better Auth surfaces a wrong current password as INVALID_PASSWORD (see
// dist/api/routes/update-user.mjs: it verifyPassword on the current password
// before hashing the new one).
function isWrongPassword(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "INVALID_PASSWORD"
  )
}

type ErrorState = "generic" | "wrongPassword" | null

export function ChangePasswordForm() {
  const t = useTranslations("dashboard.account.security.password")
  const tv = useTranslations("dashboard.validation")

  const [errorState, setErrorState] = useState<ErrorState>(null)
  const [saved, setSaved] = useState(false)

  const schema = useMemo(() => makeChangePasswordSchema(tv), [tv])
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: ChangePasswordValues) {
    setErrorState(null)
    setSaved(false)
    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        setErrorState(isWrongPassword(error) ? "wrongPassword" : "generic")
        return
      }
      form.reset()
      setSaved(true)
    } catch {
      setErrorState("generic")
    }
  }

  const { isValid, isSubmitting } = form.formState

  return (
    <SettingsFrame
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <div className="me-auto self-center">
            {saved && (
              <p className="text-muted-foreground text-sm">{t("saved")}</p>
            )}
            {errorState && (
              <p role="alert" className="text-destructive text-sm">
                {t(errorState === "wrongPassword" ? "wrongPassword" : "error")}
              </p>
            )}
          </div>
          <SubmitButton
            type="submit"
            form="change-password-form"
            isSubmitting={isSubmitting}
            disabled={!isValid}
          >
            {t("cta")}
          </SubmitButton>
        </>
      }
    >
      <Form {...form}>
        <form
          id="change-password-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col divide-y divide-border"
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <SettingsRow label={<FormLabel>{t("currentLabel")}</FormLabel>}>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <SettingsRow label={<FormLabel>{t("newLabel")}</FormLabel>}>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <SettingsRow label={<FormLabel>{t("confirmLabel")}</FormLabel>}>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </SettingsFrame>
  )
}
