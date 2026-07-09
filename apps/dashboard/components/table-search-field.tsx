"use client"

import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Input } from "@workspace/ui/components/input"

// The register toolbars' free-text search field (people, roles): a w-64 input
// with the search glyph inside its left padding. One component so every table
// searches the same way, and so a loading toolbar can render the REAL control
// (static chrome is never a skeleton bar) with zero markup drift. Omitting
// `value` leaves the input uncontrolled: a loading state that cannot hold the
// query yet still takes keystrokes instead of freezing or graying out.
export function TableSearchField({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <div className="relative">
      <HugeiconsIcon
        icon={Search01Icon}
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-64 pl-8"
      />
    </div>
  )
}
