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
import { Spinner } from "@workspace/ui/components/spinner"
import { useFormatter } from "next-intl"
import type { DateRange } from "react-day-picker"

// A reusable date-range picker: an outline trigger button whose label is the
// formatted range (locale output, via next-intl's formatter), opening a
// two-month range calendar with a Clear action once a start date is picked.
// While `loading` (e.g. the default span is still resolving), the trigger shows
// a spinner instead of the placeholder so it never flashes a bare label.
export function DateRangePicker({
  value,
  onChange,
  placeholder,
  clearLabel,
  ariaLabel,
  loading = false,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder: string
  clearLabel: string
  ariaLabel: string
  loading?: boolean
}) {
  const format = useFormatter()

  if (loading) {
    return (
      <Button variant="outline" disabled aria-label={ariaLabel}>
        <Spinner />
      </Button>
    )
  }

  const label =
    value?.from && value.to
      ? format.dateTimeRange(value.from, value.to, { dateStyle: "medium" })
      : value?.from
        ? format.dateTime(value.from, { dateStyle: "medium" })
        : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={ariaLabel}>
          <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          autoFocus
        />
        {value?.from ? (
          <div className="border-border border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(undefined)}
            >
              {clearLabel}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
