"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

// The build view's budget bar, as the one shell both of its states are built
// from: the live bar and the placeholder the grid skeleton shows while the
// model loads.
//
// Shared rather than written twice because the two have to MEASURE identically.
// This is the bar the four columns scroll under, so a placeholder that stood a
// few pixels taller would move the whole page the moment the data landed, and
// a shape maintained in two files cannot promise that it will not.
//
// What is static lives here (the frame, the weighting help, the reserved slot
// for the AI review trigger); what depends on the data is passed in, as real
// figures by the view and as bars by the skeleton.
export function BuildBudgetBar({
  readout,
  status,
  review,
  reviewOffered,
  action,
}: {
  // The "X of Y weight points allocated" sentence.
  readout: ReactNode
  // The one line under it: balanced, short, over, or nothing allocated yet.
  status: ReactNode
  // The AI weight-review trigger. Always rendered, never conditional: see
  // reviewOffered.
  review: ReactNode
  // Whether the review is on offer right now. The trigger's slot is reserved
  // either way and only its CONTENT hides, because at a width where this row
  // wraps, mounting the trigger would add a line and change the bar's height.
  // `invisible` is what hides it: visibility:hidden keeps the box while taking
  // the trigger out of the tab order and out of the accessibility tree, so a
  // hidden control can be neither reached nor announced.
  reviewOffered: boolean
  // The save action.
  action: ReactNode
}) {
  const tHelp = useTranslations("dashboard.help")
  return (
    // Sticky at every width, deliberately: the bar carries the only save on the
    // page, and on a narrow screen the four columns stack into the longest
    // scroll this surface has, which is exactly where a save parked at the
    // bottom is hardest to get back to.
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* A div rather than a p: the loading state stands the two figures in
              as skeleton bars, which are divs, and a div inside a p is invalid
              nesting. It is one line of text in both states either way. */}
          <div className="font-medium text-sm tabular-nums">{readout}</div>
          {/* The weighting concept's help sits with the control it is about,
              which is this bar, not the page title (that one introduces the
              criterion). */}
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
          {/* Last in the LEFT group on purpose: the review comes and goes with
              the lock and with the first unsaved edit, and here it grows into
              free space instead of shifting the save button out from under the
              pointer. */}
          <span
            className={cn("flex", !reviewOffered && "invisible")}
            aria-hidden={!reviewOffered}
          >
            {review}
          </span>
        </div>
        {/* The status line's own box, so a bar and a sentence occupy the same
            20px line. */}
        <div className="flex h-5 items-center">{status}</div>
      </div>
      {action}
    </div>
  )
}
