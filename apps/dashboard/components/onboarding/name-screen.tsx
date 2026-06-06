"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { organizationSlug } from "@/lib/slug"

// Screen 1: the organization name. Create mode (existing null) creates the
// Better Auth organization on continue (creator becomes admin; the
// onOrganizationCreate trigger seeds the settings row). Revisit mode
// prefills and renames only when the name actually changed.
export function NameScreen({
  existing,
  onDone,
}: {
  existing: { orgId: string; name: string } | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const [name, setName] = useState(existing?.name ?? "")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || pending) return
    setPending(true)
    setFailed(false)
    try {
      if (existing) {
        if (trimmed !== existing.name) {
          const { error } = await authClient.organization.update({
            organizationId: existing.orgId,
            data: { name: trimmed },
          })
          if (error) {
            setFailed(true)
            setPending(false)
            return
          }
        }
        onDone()
        return
      }
      const { data, error } = await authClient.organization.create({
        name: trimmed,
        slug: organizationSlug(trimmed),
      })
      if (error || !data) {
        setFailed(true)
        setPending(false)
        return
      }
      onDone()
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return (
    <form
      className="flex flex-col items-center gap-6"
      onSubmit={handleContinue}
    >
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("name.heading")}
      </h1>
      <Input
        aria-label={t("nameLabel")}
        value={name}
        placeholder={t("namePlaceholder")}
        className="max-w-sm text-center"
        onChange={(event) => setName(event.target.value)}
      />
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {tScreens("continueCta")}
      </Button>
    </form>
  )
}
