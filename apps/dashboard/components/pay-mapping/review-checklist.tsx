"use client"

import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import type { useTranslations } from "next-intl"

// The review checklist's shared presentation (the wizard's "All steps"
// sheet and the analysis summary's checklist read the same): a plain row
// button with a leading done icon and the step label, nothing else visible.
// The done/remaining state stays as sr-only text
// because the icon is aria-hidden; gap/status details live on the step
// cards themselves. Chapters render as AccordionSection sections at rest
// and as flat title+meta sections while a search query is active (a
// collapsed chapter hiding its own hits would make the filter lie).

// The minimum a row must carry to render; callers extend it with their own
// selection payload (the summary an OpenStep, the jump menu a closure).
export interface ChecklistRowBase {
  id: string
  label: string
  // See the module comment: the state for assistive tech only.
  srStatus: string
  done: boolean
}

function ChecklistRowButton({
  row,
  current,
  onSelect,
}: {
  row: ChecklistRowBase
  current: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? "true" : undefined}
        className={cn(
          // relative anchors the sr-only status span (position: absolute) to
          // THIS button: without it the span's containing block is the sticky
          // column wrapper outside the card's scroll clip, and 70+ invisible
          // 1px boxes at their unclipped flow positions stretch the page far
          // below the card.
          "relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          current ? "bg-muted font-medium" : "hover:bg-muted/50"
        )}
      >
        <HugeiconsIcon
          icon={row.done ? CheckmarkCircle02Icon : CircleIcon}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            row.done ? "text-success" : "text-muted-foreground"
          )}
        />
        <span className="flex-1 truncate">{row.label}</span>
        <span className="sr-only">{row.srStatus}</span>
      </button>
    </li>
  )
}

// A chapter's row list alone (used inside both section forms).
export function ChecklistRows<T extends ChecklistRowBase>({
  rows,
  currentId,
  onSelect,
}: {
  rows: T[]
  currentId: string | null
  onSelect: (row: T) => void
}) {
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <ChecklistRowButton
          key={row.id}
          row={row}
          current={row.id === currentId}
          onSelect={() => onSelect(row)}
        />
      ))}
    </ul>
  )
}

// A chapter while a search query is active: the plain heading (title +
// right-aligned meta, mirroring AccordionSection's own trigger layout) +
// only the matching rows, no collapse. Omitted entirely when nothing
// matches.
export function ChecklistSearchSection<T extends ChecklistRowBase>({
  title,
  meta,
  rows,
  currentId,
  onSelect,
}: {
  title: string
  meta: string | undefined
  rows: T[]
  currentId: string | null
  onSelect: (row: T) => void
}) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 font-medium text-sm">
        <span>{title}</span>
        {meta !== undefined && (
          <span className="ml-auto font-normal text-muted-foreground tabular-nums">
            {meta}
          </span>
        )}
      </h4>
      <ChecklistRows rows={rows} currentId={currentId} onSelect={onSelect} />
    </section>
  )
}

// A countable chapter's meta: absent when nothing in it requires
// documentation (a "0 of 0" count would add noise without information,
// mirroring pay-mapping-journey-card.tsx's own chapterStatusFor), otherwise
// the EXACT "x of y" key/format the journey card uses (journey.count)
// against the SAME queue.progress numbers -- never a second count invented
// from how many rows a chapter happens to render, which can be more than
// the queue's own total (a chapter's non-queue rows never require
// documentation, so they never enter this count). Rendered right-aligned in
// the section trigger (the to-do widget's anatomy, via AccordionSection).
export function chapterMeta(
  count: { done: number; total: number },
  tJourney: ReturnType<typeof useTranslations<"dashboard.payMapping.journey">>
): string | undefined {
  if (count.total === 0) return undefined
  return tJourney("count", count)
}
