"use client"

import { routing } from "@workspace/i18n/routing"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Flag } from "@workspace/ui/flag"
import { useTranslations } from "next-intl"
import { FLAG_BY_LOCALE, LANGUAGE_LABEL_KEYS } from "@/lib/locales"

// Reusable language picker over the configured locales. Each item shows the
// representative flag (decorative) plus the language autonym. The selected
// language's flag + autonym surface in the trigger because shadcn SelectItem
// wraps its children in SelectPrimitive.ItemText, which the trigger's
// SelectValue mirrors (the trigger styles select-value children as a flex
// row with a gap).
export function LanguageSelect({
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
  const t = useTranslations("dashboard")

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <Flag code={FLAG_BY_LOCALE[code]} alt="" size="S" />
              {t(LANGUAGE_LABEL_KEYS[code])}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
