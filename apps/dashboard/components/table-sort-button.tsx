"use client"

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The sortable column heading's clickable content, shared by every sortable
// table (people, classify): a quiet heading pill (muted text that gains the
// secondary wash on hover), with an up/down chevron only on the actively
// sorted column. The chevron renders inside a pre-reserved fixed-width slot
// so its appearance never shifts the label or the column widths
// (layout-shift rule). The wrapping TableHead carries aria-sort.
export function TableSortButton({
  label,
  sorted,
  onToggle,
}: {
  label: string
  // false = not sorted by this column.
  sorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="-ms-2 inline-flex h-6 items-center gap-1 rounded-lg px-2 font-normal text-secondary-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
      onClick={onToggle}
    >
      {label}
      <span className="inline-flex w-3.5" aria-hidden="true">
        {sorted !== false && (
          <HugeiconsIcon
            icon={sorted === "asc" ? ArrowUp01Icon : ArrowDown01Icon}
            size={14}
            strokeWidth={2}
          />
        )}
      </span>
    </button>
  )
}

// Maps a sort state to the th's aria-sort value.
export function ariaSort(
  sorted: false | "asc" | "desc"
): "ascending" | "descending" | undefined {
  if (sorted === "asc") return "ascending"
  if (sorted === "desc") return "descending"
  return undefined
}
