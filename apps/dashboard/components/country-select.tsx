"use client"

import { COUNTRY_KEYS } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"
import { CountryDisplay } from "@/components/country-display"

// Reusable country picker over the product's whole country set (Nordic +
// "other"). Each item renders CountryDisplay (flag + name, globe for "other"),
// the same component the country display reuses, so the two stay consistent.
// The selected country's flag + name surface in the trigger because shadcn
// SelectItem wraps its children in SelectPrimitive.ItemText, which the
// trigger's SelectValue mirrors (the trigger styles select-value children as a
// flex row with a gap).
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
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_KEYS.map((code) => (
          <SelectItem key={code} value={code}>
            <CountryDisplay code={code} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
