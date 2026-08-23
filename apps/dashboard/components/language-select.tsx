"use client"

import { routing } from "@workspace/i18n/routing"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"
import { Flag } from "@workspace/ui/flag"
import { FLAG_BY_LOCALE, LANGUAGE_LABEL_KEYS } from "@/lib/locales"
import { onSelectValue } from "@/lib/select"

// The app's one language picker: every locale as its autonym with a
// representative flag, shared by the account display-language row and the
// organization's default-language field, so the same concept never renders
// as language names in one place and country names in another.
export function LanguageSelect({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string
  onValueChange: (locale: string) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}) {
  const t = useTranslations("dashboard")
  return (
    <Select
      value={value}
      onValueChange={onSelectValue(onValueChange)}
      items={Object.fromEntries(
        routing.locales.map((code) => [
          code,
          <span key={code} className="flex items-center gap-2">
            <Flag code={FLAG_BY_LOCALE[code]} alt="" size="S" />
            {t(LANGUAGE_LABEL_KEYS[code])}
          </span>,
        ])
      )}
    >
      <SelectTrigger aria-label={ariaLabel} className={className}>
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
