"use client"

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The sortable column heading's clickable content, shared by every sortable
// table (people, classify): plain heading text (no button chrome) that
// underlines on hover like the table's links, with an up/down chevron only on
// the actively sorted column. The chevron renders inside a pre-reserved
// fixed-width slot so its appearance never shifts the label or the column
// widths (layout-shift rule). The wrapping TableHead carries aria-sort.
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
      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
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
