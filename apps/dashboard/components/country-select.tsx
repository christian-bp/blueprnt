"use client"

import { COUNTRY_KEYS } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { CountryDisplay } from "@/components/country-display"
import { onSelectValue } from "@/lib/select"

// Reusable country picker over the product's whole country set (Nordic +
// "other"). Each item renders CountryDisplay (flag + name, globe for "other"),
// the same component the country display reuses, so the two stay consistent.
// The selected country's flag + name surface in the trigger via the `items`
// map on the Select root: Base UI's SelectValue renders the matching label
// from `items` (without it, the raw country code would show).
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
    <Select
      value={value}
      onValueChange={onSelectValue(onValueChange)}
      items={COUNTRY_KEYS.map((code) => ({
        value: code,
        label: <CountryDisplay code={code} />,
      }))}
    >
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
