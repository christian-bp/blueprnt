"use client"

import { INDUSTRY_KEYS } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"

// Reusable industry picker over the product's whole industry set. Industries
// have no flag or icon (the onboarding industry screen shows text-only option
// cards), so this is a plain text select. The selected industry's name surfaces
// in the trigger because shadcn SelectItem wraps its children in
// SelectPrimitive.ItemText, which the trigger's SelectValue mirrors.
export function IndustrySelect({
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
        {INDUSTRY_KEYS.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`industries.${code}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
