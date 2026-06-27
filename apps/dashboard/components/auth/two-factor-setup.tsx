"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { OtpField } from "@/components/auth/otp-field"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import QRCode from "qrcode"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { SuccessCheck } from "@/components/auth/success-check"
import { HelpMorphButton } from "@/components/help-morph-button"
import { OptionCard } from "@/components/option-card"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  type ConfirmPasswordValues,
  makeConfirmPasswordSchema,
} from "@/lib/two-factor-schemas"

type Method = "totp" | "email"
type Step = "choose" | "password" | "confirm" | "done"

export function TwoFactorSetup({ onConfirmed }: { onConfirmed: () => void }) {
  const t = useTranslations("dashboard.twoFactorSetup")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const confirmMfaSetup = useMutation(api.accounts.twoFactor.confirmMfaSetup)
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""

  const [step, setStep] = useState<Step>("choose")
  const [method, setMethod] = useState<Method>("totp")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState(false)
  const [pwError, setPwError] = useState(false)

  const pwSchema = useMemo(() => makeConfirmPasswordSchema(tv), [tv])
  const pwForm = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(pwSchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  })

  // Render the otpauth URI to a QR data URL for the authenticator method.
  useEffect(() => {
    if (totpUri === null) return
    void QRCode.toDataURL(totpUri).then(setQr)
  }, [totpUri])

  // Focus the code field when the confirm step opens. A bare autoFocus is
  // unreliable here: the step mounts right after enable()'s token refresh, whose
  // re-render churn can swallow it. Focusing from an effect keyed on the step is
  // robust.
  const otpRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (step === "confirm") otpRef.current?.focus()
  }, [step])

  async function onConfirmPassword(values: ConfirmPasswordValues) {
    setPwError(false)
    const { data, error } = await authClient.twoFactor.enable({
      password: values.password,
    })
    if (error || !data) {
      setPwError(true)
      return
    }
    setTotpUri(data.totpURI)
    if (method === "email") await authClient.twoFactor.sendOtp()
    setStep("confirm")
  }

  async function onCodeComplete(value: string) {
    setCodeError(false)
    const verify =
      method === "totp"
        ? authClient.twoFactor.verifyTotp({ code: value })
        : authClient.twoFactor.verifyOtp({ code: value })
    const { error } = await verify
    if (error) {
      setCode("")
      setCodeError(true)
      return
    }
    await confirmMfaSetup({ method })
    // Show the completion screen; onConfirmed (which advances to the app) fires
    // when the user continues from it, not the instant the code verifies.
    setStep("done")
  }

  if (step === "choose") {
    return (
      <AuthShell>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-center font-medium text-lg">{t("heading")}</h1>
            <HelpMorphButton label={tHelp("twoFactorLabel")}>
              {tHelp("twoFactorBody")}
            </HelpMorphButton>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            {t("intro")}
          </p>
          {(["totp", "email"] as const).map((m) => (
            <OptionCard
              key={m}
              title={t(m === "totp" ? "methodTotp.label" : "methodEmail.label")}
              description={t(
                m === "totp"
                  ? "methodTotp.description"
                  : "methodEmail.description"
              )}
              badge={m === "totp" ? t("recommended") : undefined}
              selected={method === m}
              onSelect={() => setMethod(m)}
            />
          ))}
          <Button onClick={() => setStep("password")}>{t("continue")}</Button>
        </div>
      </AuthShell>
    )
  }

  if (step === "password") {
    return (
      <AuthShell>
        <div className="flex flex-col gap-4">
          <h1 className="text-center font-medium text-lg">
            {t("password.heading")}
          </h1>
          <p className="text-center text-muted-foreground text-sm">
            {t("password.description")}
          </p>
          <Form {...pwForm}>
            <form
              onSubmit={pwForm.handleSubmit(onConfirmPassword)}
              className="space-y-6"
            >
              <FormField
                control={pwForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("password.label")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {pwError && (
                <p role="alert" className="text-destructive text-sm">
                  {t("password.error")}
                </p>
              )}
              <SubmitButton
                type="submit"
                className="w-full"
                isSubmitting={pwForm.formState.isSubmitting}
                disabled={!pwForm.formState.isValid}
              >
                {t("password.cta")}
              </SubmitButton>
            </form>
          </Form>
        </div>
      </AuthShell>
    )
  }

  if (step === "done") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <SuccessCheck />
          <h1 className="font-medium text-lg">{t("complete.heading")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("complete.description")}
          </p>
          <Button className="w-full" onClick={() => onConfirmed()}>
            {t("complete.cta")}
          </Button>
        </div>
      </AuthShell>
    )
  }

  // step === "confirm"
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center font-medium text-lg">
          {t(method === "totp" ? "totp.heading" : "email.heading")}
        </h1>
        <p className="text-center text-muted-foreground text-sm">
          {method === "totp"
            ? t("totp.description")
            : t("email.description", { email })}
        </p>
        {method === "totp" && qr && (
          // White, bordered frame around the code. The QR PNG already carries
          // its own quiet-zone margin, so a small padding is enough.
          <div className="rounded-xl border bg-white p-2">
            {/* biome-ignore lint/performance/noImgElement: src is a data URL; Next/Image adds no value here */}
            <img src={qr} alt={t("totp.qrAlt")} className="size-40" />
          </div>
        )}
        {method === "totp" && totpUri && (
          <p className="break-all text-center text-muted-foreground text-xs">
            {t("totp.manualKey")} {new URL(totpUri).searchParams.get("secret")}
          </p>
        )}
        <OtpField
          inputRef={otpRef}
          value={code}
          onChange={setCode}
          onComplete={onCodeComplete}
          ariaLabel={t("codeLabel")}
        />
        {codeError && (
          <p role="alert" className="text-destructive text-sm">
            {t("verifyError")}
          </p>
        )}
        {method === "email" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void authClient.twoFactor.sendOtp()}
          >
            {t("email.resend")}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => setStep("choose")}>
          {t("changeMethod")}
        </Button>
      </div>
    </AuthShell>
  )
}
