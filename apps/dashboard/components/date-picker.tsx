"use client"

import { Calendar01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

// Serialize a picked day to the ISO date string the backend stores
// (YYYY-MM-DD) from the LOCAL date parts: toISOString would shift the day
// across the UTC boundary for evening picks east of Greenwich.
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

// Parse a stored ISO date string as a LOCAL date (new Date("YYYY-MM-DD")
// would parse UTC and render the previous day west of Greenwich).
function fromIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    return undefined
  }
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

// A single-date picker (the DateRangePicker's form-field sibling): an outline
// trigger button whose label is the formatted date (locale output via
// next-intl), opening a one-month calendar with a Clear action. String-valued
// (ISO YYYY-MM-DD, "" = unset) so react-hook-form fields bind it directly.
// Picking a day closes the popover; Clear empties the value.
export function DatePicker({
  value,
  onChange,
  onBlur,
  ariaLabel,
  ref,
}: {
  // ISO date string, "" when unset.
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  ariaLabel: string
  ref?: React.Ref<HTMLButtonElement>
}) {
  const t = useTranslations("dashboard.datePicker")
  const format = useFormatter()
  const [open, setOpen] = useState(false)

  const selected = value === "" ? undefined : fromIsoDate(value)
  const label =
    selected !== undefined
      ? format.dateTime(selected, { dateStyle: "medium" })
      : t("placeholder")

  // Navigating to another month or year RETARGETS an existing selection to
  // the same day there (clamped to the month's length): picking a year in
  // the caption dropdown IS the edit being made, and without this, closing
  // the picker after a year change silently kept the old value (only a day
  // click committed). The picked day stays highlighted in whatever month is
  // shown, and the trigger label updates live, so the value never drifts
  // out of sight. With nothing selected yet, navigation just navigates.
  function handleMonthChange(month: Date) {
    if (selected === undefined) return
    if (
      month.getFullYear() === selected.getFullYear() &&
      month.getMonth() === selected.getMonth()
    ) {
      return
    }
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate()
    const day = Math.min(selected.getDate(), daysInMonth)
    onChange(toIsoDate(new Date(month.getFullYear(), month.getMonth(), day)))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            ref={ref}
            onBlur={onBlur}
            // font-normal: the date is a value, not a button label; muted
            // while unset so the placeholder reads as one.
            className={`w-full justify-start font-normal ${
              selected === undefined ? "text-muted-foreground" : ""
            }`}
          />
        }
      >
        <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          // Month + year dropdowns in the caption: dates like an employment
          // start are often years back, and stepping there month by month
          // with the arrows is a chore. The bounds define the dropdowns'
          // year range (paging beyond next year is never a real pick here).
          captionLayout="dropdown"
          startMonth={new Date(1970, 0)}
          endMonth={new Date(new Date().getFullYear() + 1, 11)}
          // Full month names in the ACTIVE next-intl locale (the vendor
          // default abbreviates and follows the browser locale instead).
          formatters={{
            formatMonthDropdown: (date) =>
              format.dateTime(date, { month: "long" }),
          }}
          onMonthChange={handleMonthChange}
          onSelect={(date) => {
            onChange(date === undefined ? "" : toIsoDate(date))
            setOpen(false)
          }}
          autoFocus
        />
        <div className="border-border border-t p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            {t("clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
