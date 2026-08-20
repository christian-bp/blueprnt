"use client"

import { InformationCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

// The Viktning chapter's budget block, as the one shell both of its states are
// built from: the live block and the placeholder the chapter shows while the
// model loads.
//
// Shared rather than written twice because the two have to MEASURE identically:
// this block opens the chapter, so a placeholder standing a few pixels taller
// would move the whole list under it the moment the data landed, and a shape
// maintained in two files cannot promise that it will not.
//
// It sits at the TOP of the chapter, in the same anatomy the Metod chapter
// opens with (a status Alert on the left, the actions on the right). It was a
// sticky footer while criteria and weights shared one long page and the save
// had to survive that scroll; with the chapters split, this chapter is short
// and its one action belongs where the reader starts.
//
// What is static lives here (the frame, the weighting help, the reserved slot
// for the AI review trigger); what depends on the data is passed in, as real
// figures by the chapter and as bars by its skeleton.
export function WeightBudgetBar({
  readout,
  status,
  balanced,
  review,
  reviewOffered,
  action,
}: {
  // The "X of Y weight points allocated" sentence.
  readout: ReactNode
  // The one line beside it: balanced, short, over, or nothing allocated yet.
  status: ReactNode
  // Whether the allocation adds up right now: it decides the icon and the
  // tint, which the two states therefore cannot draw differently. The loading
  // state passes true, because nothing is out of balance until the data says
  // so.
  balanced: boolean
  // The AI weight-review trigger. Always rendered, never conditional: see
  // reviewOffered.
  review: ReactNode
  // Whether the review is on offer right now. The trigger's slot is reserved
  // either way and only its CONTENT hides, because at a width where this row
  // wraps, mounting the trigger would add a line and change the block's
  // height. `invisible` is what hides it: visibility:hidden keeps the box
  // while taking the trigger out of the tab order and out of the accessibility
  // tree, so a hidden control can be neither reached nor announced.
  reviewOffered: boolean
  // The save action.
  action: ReactNode
}) {
  const tHelp = useTranslations("dashboard.help")
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Alert
        // role="status" rather than the component's default role="alert":
        // these figures change under the reader's own actions, and an
        // assertive live region would interrupt them with their own edit.
        // Polite is right for a readout the reader is driving themselves.
        role="status"
        className={cn(
          // Alert has no warning variant, so the amber is a call-site
          // override, as everywhere else in this section.
          "w-auto",
          !balanced && "border-amber-500/50 text-amber-700 dark:text-amber-400"
        )}
      >
        <HugeiconsIcon
          icon={balanced ? Tick02Icon : InformationCircleIcon}
          strokeWidth={2}
        />
        <AlertTitle className="flex flex-wrap items-center gap-1.5">
          {/* A span rather than a p: the loading state stands the two figures
              in as skeleton bars, which are divs. It is one line of text in
              both states either way. */}
          <span className="tabular-nums">{readout}</span>
          <span aria-hidden="true">·</span>
          <span className="font-normal">{status}</span>
          {/* The weighting concept's help sits with the control it is about,
              which is this block, not the chapter's framing line. */}
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
        </AlertTitle>
      </Alert>
      <span className="flex items-center gap-2">
        <span
          className={cn("flex", !reviewOffered && "invisible")}
          aria-hidden={!reviewOffered}
        >
          {review}
        </span>
        {action}
      </span>
    </div>
  )
}
