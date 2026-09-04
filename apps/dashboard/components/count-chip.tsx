"use client"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { Badge } from "@workspace/ui/components/badge"

// How many, beside the name of the thing being counted: the register's own
// size on a frame's title line, and a family's role count on the group row
// that heads it. One component so a count reads the same wherever it appears,
// and live, so it rolls when a filter narrows what is being counted.
export function CountChip({
  value,
  icon,
  label,
}: {
  value: number
  // What is being counted. Required, so a number never stands alone: a
  // register of people wears the person mark, one of roles the briefcase, and
  // a new surface has to decide rather than inherit whatever the last one
  // used.
  icon: IconSvgElement
  // The count in words, for a reader who cannot see the mark. Pass it where
  // the chip's number is not read together with a title that already names
  // the unit (a group band inside a table); a register's own heading does
  // that job, so its chip needs no second voice.
  label?: string
}) {
  const chip = (
    <Badge
      variant="outline"
      className="rounded-full tabular-nums"
      aria-hidden={label === undefined ? undefined : true}
    >
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-3.5 shrink-0"
      />
      <NumberFlow value={value} />
    </Badge>
  )
  if (label === undefined) return chip
  // The mark is a visual channel, so a labelled chip hands the whole phrase
  // to assistive tech instead and takes the silent number out of the way.
  return (
    <>
      {chip}
      <span className="sr-only">{label}</span>
    </>
  )
}
