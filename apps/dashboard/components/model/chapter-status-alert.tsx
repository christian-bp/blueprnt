"use client"

import { InformationCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { cn } from "@workspace/ui/lib/utils"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import type { ReactNode } from "react"

// The status block every model chapter opens with: a role="status" Alert
// (icon + tint from one ok flag) beside a trailing action group. Shared
// because the Viktning chapter's WeightBudgetBar and the Metod chapter each
// built this shell independently, in both their loaded and loading states; a
// shape kept in more than one file cannot promise it stays the same shape.
//
// ok is a tri-state, not a plain boolean: true is the resolved-good state (a
// checkmark, no tint), false is the resolved-attention state (the info icon,
// amber tint), and undefined is "not yet known" while the chapter's own data
// is still loading (the info icon, but no tint: nothing is confirmed wrong
// yet, only not yet loaded).
//
// title is one opaque slot rather than separate readout/status props: a
// chapter composes whatever spans, separators and help button its own
// readout needs, or hands over a single sentence, and this component imposes
// no structure or classes on content it did not write.
// The size EVERY action in a chapter's status block takes. One size across the
// section, owned here rather than chosen per chapter: the blocks sit at the
// same place on four chapters, and a reader moving between them reads a row of
// controls that changes height as they go. It is the design system's DEFAULT,
// because nothing about this row is a reason to deviate from it (the house
// rule: never hand-pick a size per call site) and because the row's height is
// set by the Alert beside it either way, so the larger control costs no space.
// Viktning's own actions had drifted to `sm` while Metod's export stayed at
// the default; a new chapter passes this rather than picking again.
export const CHAPTER_ACTION_BUTTON_SIZE = "default" as const

export function ChapterStatusAlert({
  ok,
  title,
  actions,
}: {
  ok: boolean | undefined
  // The AlertTitle's whole content.
  title: ReactNode
  // The trailing action group beside the Alert (a review trigger and save, or
  // an export button). Omitted entirely where a chapter has none.
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Alert
        // role="status" rather than the component's default role="alert":
        // these figures change under the reader's own actions, and an
        // assertive live region would interrupt them with their own edit.
        // Polite is right for a readout the reader is driving themselves.
        role="status"
        className={cn(
          "w-auto",
          // Alert has no warning variant, so the amber is a call-site
          // override.
          ok === false && WARNING_ALERT_CLASS
        )}
      >
        <HugeiconsIcon
          icon={ok ? Tick02Icon : InformationCircleIcon}
          strokeWidth={2}
        />
        <AlertTitle>{title}</AlertTitle>
      </Alert>
      {actions !== undefined && (
        // Named, so the size rule above has something a test can hold it to:
        // every control in this slot is a chapter action, whichever chapter
        // put it there.
        <span
          data-slot="chapter-status-actions"
          className="flex items-center gap-2"
        >
          {actions}
        </span>
      )}
    </div>
  )
}
