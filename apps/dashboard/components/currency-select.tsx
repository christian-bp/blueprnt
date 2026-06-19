"use client"

import { CURRENCY_KEYS } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

// Reusable currency picker over the product's distinct currencies (Nordic
// kronor + EUR). Currency codes (SEK/NOK/DKK/EUR) are language-neutral, so the
// code is the item label directly (no i18n name lookup). The selected code
// surfaces in the trigger because shadcn SelectItem wraps its children in
// SelectPrimitive.ItemText, which the trigger's SelectValue mirrors.
export function CurrencySelect({
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
        {CURRENCY_KEYS.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
