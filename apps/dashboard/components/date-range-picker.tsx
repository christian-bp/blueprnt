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
import { useFormatter } from "next-intl"
import type { DateRange } from "react-day-picker"

// The trigger sizes to its content (a single date or a full range). font-normal
// so the date value does not render bold.
const TRIGGER_CLASS = "font-normal"

// A reusable date-range picker: an outline trigger button whose label is the
// formatted range (locale output, via next-intl's formatter), opening a
// two-month range calendar with a Clear action once a start date is picked.
// Callers pass a default value so the trigger always shows a date, never a
// loader or a bare placeholder.
export function DateRangePicker({
  value,
  onChange,
  placeholder,
  clearLabel,
  todayLabel,
  ariaLabel,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder: string
  clearLabel: string
  todayLabel: string
  ariaLabel: string
}) {
  const format = useFormatter()

  const label =
    value?.from && value.to
      ? format.dateTimeRange(value.from, value.to, { dateStyle: "medium" })
      : value?.from
        ? format.dateTime(value.from, { dateStyle: "medium" })
        : placeholder

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={ariaLabel}
            className={TRIGGER_CLASS}
          />
        }
      >
        <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          autoFocus
        />
        <div className="flex gap-2 border-border border-t p-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              const today = new Date()
              onChange({ from: today, to: today })
            }}
          >
            {todayLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onChange(undefined)}
          >
            {clearLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
