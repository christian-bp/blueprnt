"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { OtpField } from "@/components/auth/otp-field"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"

const METHOD_HINT_KEY = "blueprnt.2fa.method"

type Method = "totp" | "email" | "backup"

// The sign-in second-factor screen. Defaults to the device-remembered method and
// always offers email (the universal recovery channel) and a single-use backup
// code as fallbacks, so a lost authenticator is never a dead end. TOTP and email
// use the 6-digit code field; a backup code is alphanumeric and verified through
// a separate endpoint, so it has its own free-text input.
export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const t = useTranslations("dashboard.auth.twoFactor")
  // The method this device last enrolled/used (written on a successful
  // setup/login). In V1 a user has exactly one enrolled method, so an
  // email-enrolled device means the user never scanned an authenticator: hide
  // the "use authenticator" fallback for them. Only hide it when the hint is
  // explicitly "email"; a totp device or an unknown (new) device keeps it, so we
  // never hide it from a real authenticator user.
  const [enrolled] = useState<Method | null>(() => {
    if (typeof window === "undefined") return null
    const hint = window.localStorage.getItem(METHOD_HINT_KEY)
    return hint === "email" || hint === "totp" ? hint : null
  })
  const hasAuthenticator = enrolled !== "email"
  const [method, setMethod] = useState<Method>(
    enrolled === "email" ? "email" : "totp"
  )
  const [code, setCode] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  // Guards against a double verify if InputOTP re-fires onComplete (paste / remount).
  const verifyingRef = useRef(false)
  // Guards the email-OTP auto-send so we send exactly once per entry into email
  // mode. Without it, React StrictMode's double-invoked mount effect (dev) sends
  // two codes (and only the second is valid, since each send replaces the last).
  // Switching away from email resets it so re-entering re-sends.
  const otpSentRef = useRef(false)
  // Resend feedback: a spinner while sending, then a brief "Code sent".
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const resentTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // When the email method is active, request a code on entry / on switch.
  useEffect(() => {
    if (method !== "email") {
      otpSentRef.current = false
      return
    }
    if (otpSentRef.current) return
    otpSentRef.current = true
    void authClient.twoFactor.sendOtp()
  }, [method])

  // Clear the pending "Code sent" reset if the screen unmounts mid-timeout.
  useEffect(() => () => clearTimeout(resentTimer.current), [])

  // Switching clears the inputs, error, and resend feedback so nothing stale
  // carries over.
  function switchTo(next: Method) {
    setError(false)
    setCode("")
    setBackupCode("")
    setResent(false)
    setMethod(next)
  }

  async function onResend() {
    if (resending) return
    setResending(true)
    const { error: sendError } = await authClient.twoFactor.sendOtp()
    setResending(false)
    if (sendError) return
    setResent(true)
    clearTimeout(resentTimer.current)
    resentTimer.current = setTimeout(() => setResent(false), 3000)
  }

  async function onComplete(value: string) {
    if (verifyingRef.current) return
    verifyingRef.current = true
    setError(false)
    try {
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
    } finally {
      verifyingRef.current = false
    }
  }

  async function onBackupSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const value = backupCode.trim()
    if (value === "") return
    setError(false)
    setSubmitting(true)
    const { error: verifyError } = await authClient.twoFactor.verifyBackupCode({
      code: value,
    })
    setSubmitting(false)
    if (verifyError) {
      setBackupCode("")
      setError(true)
      return
    }
    // Don't remember "backup" as the device method (each code is single-use);
    // the prior hint stays so next sign-in defaults to a reusable method.
    onVerified()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-center font-medium text-lg">{t("title")}</h1>
      <p className="text-center text-muted-foreground text-sm">
        {method === "totp"
          ? t("totpPrompt")
          : method === "email"
            ? t("emailPrompt")
            : t("backupPrompt")}
      </p>

      {method === "backup" ? (
        <form onSubmit={onBackupSubmit} className="flex w-full flex-col gap-4">
          <Input
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value)}
            aria-label={t("backupLabel")}
            // Backup codes are case-sensitive and alphanumeric: keep mobile
            // keyboards from auto-capitalizing/correcting and mangling them.
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            className="text-center"
          />
          <SubmitButton
            type="submit"
            className="w-full"
            isSubmitting={submitting}
            disabled={backupCode.trim() === ""}
          >
            {t("verify")}
          </SubmitButton>
        </form>
      ) : (
        <OtpField
          value={code}
          onChange={setCode}
          onComplete={onComplete}
          ariaLabel={t("codeLabel")}
          autoFocus
        />
      )}

      {error && (
        <p role="alert" className="text-center text-destructive text-sm">
          {t("error")}
        </p>
      )}

      {/* The fallback switches sit in their own tighter group, set apart from
          the code input above. */}
      <div className="flex w-full flex-col items-center gap-1">
        {method === "totp" && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => switchTo("email")}
            >
              {t("useEmail")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => switchTo("backup")}
            >
              {t("useBackupCode")}
            </Button>
          </>
        )}
        {method === "email" && (
          <>
            <SubmitButton
              type="button"
              variant="ghost"
              isSubmitting={resending}
              onClick={onResend}
            >
              {resent ? t("resent") : t("resend")}
            </SubmitButton>
            {hasAuthenticator && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => switchTo("totp")}
              >
                {t("useAuthenticator")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => switchTo("backup")}
            >
              {t("useBackupCode")}
            </Button>
          </>
        )}
        {method === "backup" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => switchTo(hasAuthenticator ? "totp" : "email")}
          >
            {hasAuthenticator ? t("useAuthenticator") : t("useEmail")}
          </Button>
        )}
      </div>
    </div>
  )
}
