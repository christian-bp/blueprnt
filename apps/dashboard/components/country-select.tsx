"use client"

import { Globe02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { COUNTRY_KEYS } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Flag } from "@workspace/ui/flag"
import { useTranslations } from "next-intl"

// Reusable country picker over the product's whole country set (Nordic +
// "other"). "other" has no flag and shows a neutral globe in the same slot,
// matching the onboarding country screen. The selected country's flag + name
// surface in the trigger because shadcn SelectItem wraps its children in
// SelectPrimitive.ItemText, which the trigger's SelectValue mirrors (the
// trigger styles select-value children as a flex row with a gap).
function CountryOption({ code, name }: { code: string; name: string }) {
  return (
    <span className="flex items-center gap-2">
      {code === "other" ? (
        <HugeiconsIcon
          icon={Globe02Icon}
          className="size-4 text-muted-foreground"
        />
      ) : (
        // Decorative: the name is the label, so alt stays empty.
        <Flag code={code} alt="" size="S" />
      )}
      {name}
    </span>
  )
}

export function CountrySelect({
  value,
  onValueChange,
  id,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string
  onValueChange: (code: string) => void
  id?: string
  placeholder?: string
  "aria-label"?: string
}) {
  const t = useTranslations("dashboard.onboarding.profile")

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_KEYS.map((code) => (
          <SelectItem key={code} value={code}>
            <CountryOption code={code} name={t(`countries.${code}`)} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
