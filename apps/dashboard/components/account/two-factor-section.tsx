"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
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
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CopyButton } from "@/components/copy-button"
import { HelpMorphButton } from "@/components/help-morph-button"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import type { ValidationT } from "@/lib/validation"

// Schema factory so the Zod message is translated via i18n.
function makeRegenerateSchema(t: ValidationT) {
  return z.object({
    password: z.string().min(1, t("required")),
  })
}

type RegenerateValues = { password: string }

export function TwoFactorSection() {
  const t = useTranslations("dashboard.account.security.twoFactor")
  const tToast = useTranslations("dashboard.toast")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const tBackup = useTranslations("dashboard.twoFactorSetup.backup")

  const account = useQuery(api.accounts.account.getMyAccount, {})
  const clearMfaConfirmed = useMutation(api.accounts.account.clearMfaConfirmed)

  const [changeMethodOpen, setChangeMethodOpen] = useState(false)
  const [changeMethodError, setChangeMethodError] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [pwError, setPwError] = useState(false)

  const schema = useMemo(() => makeRegenerateSchema(tv), [tv])
  const form = useForm<RegenerateValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "" },
  })

  const mfaMethod = account?.mfaMethod ?? null

  function methodLabel(method: "totp" | "email" | null): string {
    if (method === "totp") return t("methodTotp")
    if (method === "email") return t("methodEmail")
    return t("methodNone")
  }

  async function onRegenerate(values: RegenerateValues) {
    setPwError(false)
    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password: values.password,
    })
    if (error || !data) {
      setPwError(true)
      return
    }
    setBackupCodes(data.backupCodes ?? [])
    form.reset()
    setRegenerateOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current method row */}
        {/* Label with its concept help, and the value stacked directly under it
            so they read as one pair (not split to opposite edges). */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{t("currentMethod")}</span>
            <HelpMorphButton label={tHelp("twoFactorLabel")}>
              {tHelp("twoFactorBody")}
            </HelpMorphButton>
          </div>
          <p className="text-muted-foreground text-sm">
            {methodLabel(mfaMethod)}
          </p>
        </div>

        {/* Change method + regenerate actions share a row with a gap (they are
            inline-flex, so the CardContent space-y does not separate them). */}
        <div className="flex flex-wrap gap-2">
          {/* Change method: controlled AlertDialog so errors can be surfaced
              and the dialog stays open on failure. AlertDialogAction auto-closes
              synchronously, so a plain Button is used for the confirm action
              instead. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setChangeMethodError(false)
              setChangeMethodOpen(true)
            }}
          >
            {t("changeMethod")}
          </Button>
          <AlertDialog
            open={changeMethodOpen}
            onOpenChange={(next) => {
              if (!next) setChangeMethodError(false)
              setChangeMethodOpen(next)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("changeMethodConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("changeMethodConfirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {changeMethodError && (
                <p role="alert" className="text-destructive text-sm">
                  {t("changeMethodError")}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setChangeMethodError(false)
                    try {
                      await clearMfaConfirmed()
                      // On success the reactive query updates mfaMethod;
                      // close the dialog so the setup flow takes over.
                      setChangeMethodOpen(false)
                      toast.success(tToast("twoFactorReset"))
                    } catch {
                      setChangeMethodError(true)
                    }
                  }}
                >
                  {t("changeMethodConfirmCta")}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Regenerate backup codes (inline collapsible form) */}
          {!regenerateOpen && backupCodes.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPwError(false)
                form.reset()
                setRegenerateOpen(true)
              }}
            >
              {t("regenerate")}
            </Button>
          )}
        </div>

        {regenerateOpen && backupCodes.length === 0 && (
          <div className="rounded-lg border p-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onRegenerate)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("regeneratePasswordLabel")}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {pwError && (
                  <p role="alert" className="text-destructive text-sm">
                    {t("wrongPassword")}
                  </p>
                )}
                <div className="flex gap-2">
                  <SubmitButton
                    type="submit"
                    size="sm"
                    isSubmitting={form.formState.isSubmitting}
                    disabled={!form.formState.isValid}
                  >
                    {t("regenerateCta")}
                  </SubmitButton>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRegenerateOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Backup codes panel (same markup as two-factor-setup.tsx done step) */}
        {backupCodes.length > 0 && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium text-sm">{tBackup("heading")}</h2>
              <CopyButton
                value={backupCodes.join("\n")}
                variant="ghost"
                size="sm"
                copiedLabel={tBackup("copied")}
              >
                {tBackup("copy")}
              </CopyButton>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              {tBackup("intro")}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <li
                  key={c}
                  className="rounded bg-muted px-2 py-1 text-center tracking-wider"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
