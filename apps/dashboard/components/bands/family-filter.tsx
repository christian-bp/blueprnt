"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"

export interface FamilyOption {
  id: string
  name: string
}

// Multi-select family filter for the Overview: a dropdown with one checkbox
// per family present (plus a "No family" option when some roles are
// unassigned). `hidden` holds the families turned OFF; an empty set means all
// are shown. Toggling a checkbox keeps the menu open so several families can
// be flipped in one pass. Controlled: it reports the next hidden set; the page
// owns the state and the row filtering.
export function FamilyFilter({
  options,
  hidden,
  onHiddenChange,
}: {
  options: FamilyOption[]
  hidden: Set<string>
  onHiddenChange: (hidden: Set<string>) => void
}) {
  const t = useTranslations("dashboard.bands")
  const tFamily = useTranslations("dashboard.roles.family")
  const shownCount = options.filter((option) => !hidden.has(option.id)).length
  const label =
    shownCount === options.length
      ? tFamily("all")
      : t("familiesShown", { shown: shownCount, total: options.length })

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onHiddenChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-48 justify-between font-normal">
          <span className="truncate">{label}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="ml-2 shrink-0 opacity-60"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={!hidden.has(option.id)}
            // Keep the menu open so multiple families can be toggled in one go.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(option.id)}
          >
            {option.name}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onHiddenChange(new Set())}>
          {t("selectAll")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onHiddenChange(new Set(options.map((o) => o.id)))}
        >
          {t("clearAll")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
