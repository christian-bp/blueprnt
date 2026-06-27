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
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  makeChangePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/account-schemas"
import { isPasswordPwned } from "@/lib/pwned-password"

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

// Better Auth's haveIBeenPwned plugin rejects a breached password with
// PASSWORD_COMPROMISED. We also pre-check client-side (see isPasswordPwned
// usage below), so the server stays the backstop but we surface it early.
function isPasswordCompromised(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PASSWORD_COMPROMISED"
  )
}

type ErrorState = "generic" | "compromised" | "wrongPassword" | null

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
    // Pre-check before submitting: avoids sending a potentially breached
    // password to the server. The server plugin stays the authority.
    if (await isPasswordPwned(values.newPassword)) {
      setErrorState("compromised")
      return
    }
    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        setErrorState(
          isPasswordCompromised(error)
            ? "compromised"
            : isWrongPassword(error)
              ? "wrongPassword"
              : "generic"
        )
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("currentLabel")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newLabel")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SubmitButton
          type="submit"
          isSubmitting={isSubmitting}
          disabled={!isValid}
        >
          {t("cta")}
        </SubmitButton>
        {saved && <p className="text-muted-foreground text-sm">{t("saved")}</p>}
        {errorState && (
          <p role="alert" className="text-destructive text-sm">
            {t(
              errorState === "compromised"
                ? "compromised"
                : errorState === "wrongPassword"
                  ? "wrongPassword"
                  : "error"
            )}
          </p>
        )}
      </form>
    </Form>
  )
}
