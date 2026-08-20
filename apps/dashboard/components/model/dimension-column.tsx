"use client"

import { Badge } from "@workspace/ui/components/badge"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useId } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { HelpMorphButton } from "@/components/help-morph-button"

// One dimension's column on the Kriterier chapter: the dashed card holding the
// criteria chosen for that dimension, with its own way to add another
// underneath.
//
// Dashed rather than solid because the border is a promise about the box: a
// dashed outline is the app's (and the wider convention's) way of saying "this
// container takes something", and the four of them read as one row of slots
// rather than four cards that happen to be empty.
export function DimensionColumn({
  title,
  helpBody,
  count,
  max,
  full,
  action,
  children,
}: {
  title: string
  // The dimension's guiding question, shown behind the help affordance beside
  // the title. Supplied by the caller because the wording is localized library
  // content, not this component's copy.
  helpBody: string
  count: number
  max: number
  // The dimension cannot take another criterion. Passed separately from
  // count/max because the model's own 6-8 ceiling can close a column that has
  // not reached its per-dimension cap.
  full: boolean
  // What the reader can do here: the add control, or the sentence explaining
  // why the column is closed. Below the box rather than inside it, so adding a
  // criterion never moves the control that added it.
  action: ReactNode
  // The dimension's chosen criteria, as list ITEMS: the column renders them
  // inside its own <ul>, so a card cannot end up an orphan <li> in whichever
  // view mounted it. Absent while count is 0, where the hatch stands in for
  // them.
  children?: ReactNode
}) {
  const t = useTranslations("dashboard.model.criteria")
  const tHelp = useTranslations("dashboard.help")
  const titleId = useId()

  return (
    <div className="space-y-3">
      {/* A section rather than a div with role="group": it is a titled part of
          the page holding its own content, which is what a section is, and
          naming it makes it a place a screen reader can jump straight to,
          which on a four-column surface is how the reader gets to their
          dimension. The name points at the title's own span, not at the
          heading, so the help trigger beside it cannot end up in the name. */}
      <section
        aria-labelledby={titleId}
        data-full={String(full)}
        className="rounded-xl border border-dashed p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1 font-medium text-sm">
            <span id={titleId} className="truncate">
              {title}
            </span>
            {/* Named after what it answers rather than after the dimension: a
                trigger named "Effort" beside a region and a heading of the same
                name puts three nodes with one name in the reader's ear, and
                none of them says what pressing it would tell them. */}
            <HelpMorphButton label={tHelp("dimensionLabel")}>
              {helpBody}
            </HelpMorphButton>
          </h3>
          {/* The count IS the full state, and it says so by FILLING IN rather
              than by gaining a line: a second sentence would be one more thing
              to read on a page carrying four of these, and a column that grew
              when it filled would shift under the reader. The words for what to
              do about it belong with the add control below, which is where the
              reader is reaching. */}
          <Badge
            variant={full ? "secondary" : "outline"}
            className="shrink-0 tabular-nums"
          >
            {t("zoneCount", { count, max })}
          </Badge>
        </div>
        {/* relative: popLayout takes the leaving hatch out of flow, which needs
            a positioned ancestor. */}
        <div className="relative mt-3">
          {/* The hatch leaves by fading only, popped out of flow, so the first
              card added reflows once instead of waiting for a placeholder to
              collapse under it (ui-animation.md rule 6). The column grows under
              the card arriving, so it must never gain overflow-hidden: a card
              animating across this edge would be clipped for the length of the
              spring (rule 4). */}
          <AnimatePresence initial={false} mode="popLayout">
            {count === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                role="img"
                aria-label={t("zoneEmpty")}
                // Deep enough to read as a slot with room in it rather than as
                // a rule under the title, shallow enough that four empty
                // columns side by side stay on one screen, which is the state
                // every new org opens this chapter in.
                className={`h-16 w-full rounded-md ${HATCH_CLASS}`}
              />
            )}
          </AnimatePresence>
          {/* The column owns the list rather than the caller: the chosen cards
              are list items, and a contract that asked every view to remember
              the <ul> around them is one an orphan <li> eventually ships past.
              popLayout again: a removed card is taken out of flow at once, so
              the cards under it close the gap in one pass rather than waiting
              out the fade (rules 3 and 6). */}
          {children !== undefined && (
            <ul className="space-y-2">
              <AnimatePresence initial={false} mode="popLayout">
                {children}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </section>
      {action}
    </div>
  )
}
