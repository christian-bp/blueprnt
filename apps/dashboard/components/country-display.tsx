"use client"

import { Globe02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { COUNTRY_KEYS, type CountryKey } from "@workspace/constants"
import { Flag } from "@workspace/ui/flag"
import { useTranslations } from "next-intl"

const COUNTRY_KEY_SET = new Set<string>(COUNTRY_KEYS)

// Flag + translated country name (globe for "other"); renders nothing for an
// unset or unknown code. The flag/label source for the country select and any
// country display, so they stay consistent.
export function CountryDisplay({ code }: { code: string | null | undefined }) {
  const t = useTranslations("dashboard.onboarding.profile")
  if (code == null || !COUNTRY_KEY_SET.has(code)) return null
  const key = code as CountryKey
  return (
    <span className="flex items-center gap-2">
      {key === "other" ? (
        <HugeiconsIcon
          icon={Globe02Icon}
          className="size-4 text-muted-foreground"
        />
      ) : (
        <Flag code={key} alt="" size="S" />
      )}
      {t(`countries.${key}`)}
    </span>
  )
}
