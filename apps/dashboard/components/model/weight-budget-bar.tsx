"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ChapterStatusAlert } from "@/components/model/chapter-status-alert"

// The Viktning chapter's budget block, as the one shell both of its states are
// built from: the live block and the placeholder the chapter shows while the
// model loads. Built on the shared ChapterStatusAlert (the Alert, its icon and
// tint, and the role="status" reasoning live there now); this file only
// composes Viktning's own readout/status/help content and its review+save
// action group.
//
// Shared rather than written twice because the two have to MEASURE identically:
// this block opens the chapter, so a placeholder standing a few pixels taller
// would move the whole list under it the moment the data landed, and a shape
// maintained in two files cannot promise that it will not.
//
// It sits at the TOP of the chapter, in the same anatomy the Metod chapter
// opens with (a status block on the left, the actions on the right). It was a
// sticky footer while criteria and weights shared one long page and the save
// had to survive that scroll; with the chapters split, this chapter is short
// and its one action belongs where the reader starts.
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
    <ChapterStatusAlert
      ok={balanced}
      title={
        // A span rather than a p: the loading state stands the two figures
        // in as skeleton bars, which are divs. It is one line of text in
        // both states either way.
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums">{readout}</span>
          <span aria-hidden="true">·</span>
          <span className="font-normal">{status}</span>
          {/* The weighting concept's help sits with the control it is about,
              which is this block, not the chapter's framing line. */}
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
        </span>
      }
      actions={
        <>
          <span
            className={cn("flex", !reviewOffered && "invisible")}
            aria-hidden={!reviewOffered}
          >
            {review}
          </span>
          {action}
        </>
      }
    />
  )
}
