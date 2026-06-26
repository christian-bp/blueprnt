"use client"

import { Button } from "@workspace/ui/components/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"

const METHOD_HINT_KEY = "blueprnt.2fa.method"

type Method = "totp" | "email"

// The sign-in second-factor screen. Defaults to the device-remembered method
// (written on a successful setup/login) and always offers the other as a
// fallback. Email is reachable for everyone (it is the universal recovery
// channel), so a lost authenticator is never a dead end.
export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const t = useTranslations("dashboard.auth.twoFactor")
  const [method, setMethod] = useState<Method>(() => {
    if (typeof window === "undefined") return "totp"
    return window.localStorage.getItem(METHOD_HINT_KEY) === "email"
      ? "email"
      : "totp"
  })
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)

  // When the email method is active, request a code on entry / on switch.
  useEffect(() => {
    if (method === "email") void authClient.twoFactor.sendOtp()
  }, [method])

  async function onComplete(value: string) {
    setError(false)
    const verify =
      method === "totp"
        ? authClient.twoFactor.verifyTotp({ code: value })
        : authClient.twoFactor.verifyOtp({ code: value })
    const { error: verifyError } = await verify
    if (verifyError) {
      setCode("")
      setError(true)
      return
    }
    window.localStorage.setItem(METHOD_HINT_KEY, method)
    onVerified()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-center font-medium text-lg">{t("title")}</h1>
      <p className="text-center text-muted-foreground text-sm">
        {method === "totp" ? t("totpPrompt") : t("emailPrompt")}
      </p>
      <InputOTP
        maxLength={6}
        value={code}
        onChange={setCode}
        onComplete={onComplete}
        autoFocus
        aria-label={t("codeLabel")}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      {method === "email" ? (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void authClient.twoFactor.sendOtp()}
          >
            {t("resend")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMethod("totp")}
          >
            {t("useAuthenticator")}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMethod("email")}
        >
          {t("useEmail")}
        </Button>
      )}
    </div>
  )
}
