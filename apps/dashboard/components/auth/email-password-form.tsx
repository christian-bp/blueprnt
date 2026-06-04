"use client"

import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"

export interface EmailPasswordValues {
  email: string
  password: string
  name?: string
}

export function EmailPasswordForm(props: {
  mode: "signIn" | "signUp"
  onSubmit: (values: EmailPasswordValues) => Promise<void>
}) {
  const t = useTranslations("dashboard.auth")
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError(false)
    try {
      await props.onSubmit({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        name: data.get("name") === null ? undefined : String(data.get("name")),
      })
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t(`${props.mode}.title`)}</h1>
      {props.mode === "signUp" ? (
        <label>
          {t("name")}
          <input name="name" type="text" required />
        </label>
      ) : null}
      <label>
        {t("email")}
        <input name="email" type="email" required />
      </label>
      <label>
        {t("password")}
        <input name="password" type="password" required minLength={8} />
      </label>
      {error ? <p role="alert">{t("error")}</p> : null}
      <button type="submit" disabled={pending}>
        {t(`${props.mode}.cta`)}
      </button>
    </form>
  )
}
