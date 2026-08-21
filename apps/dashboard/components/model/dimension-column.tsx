"use client"

import { Badge } from "@workspace/ui/components/badge"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useId } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { HelpMorphButton } from "@/components/help-morph-button"
import { DimensionFrame } from "@/components/model/dimension-frame"

// One dimension's column on the Kriterier chapter: the shared DimensionFrame
// (the dashed card every chapter draws its dimensions in) holding the criteria
// chosen for that dimension, with its own way to add another underneath.
//
// What is this chapter's OWN is the lens in the heading row (the count chip
// against the dimension's cap) and the body: the materiality note, the hatch
// standing in for an empty slot, and the add row in the frame's footer.
export function DimensionColumn({
  title,
  helpBody,
  count,
  max,
  full,
  explained,
  note,
  action,
  children,
}: {
  title: string
  // What the dimension covers, shown behind the help affordance beside the
  // title. Supplied by the caller because the wording is localized copy, not
  // this component's own.
  helpBody: string
  count: number
  max: number
  // The dimension cannot take another criterion. Passed separately from
  // count/max because the model's own 6-8 ceiling can close a column that has
  // not reached its per-dimension cap.
  full: boolean
  // The column is empty for a reason it STATES ITSELF (its `note` carries the
  // reason), so the hatch comes off: the hatch says "nothing here yet", which
  // is the wrong story over a column that has just explained its own
  // emptiness. Whether the column can still take a criterion is a separate
  // question, answered by `action`: a dimension tested and found not material
  // has neither, while one decided material but not yet staffed keeps its add
  // row. Today only the fourth column.
  explained?: boolean
  // A block the dimension itself carries, inside the body and above the add
  // row: today only the fourth column's materiality decision, as its question
  // or as the answer that settled it. It LEADS an empty column (it is the
  // context for the emptiness) and FOLLOWS a filled one (there the criteria
  // are the content).
  note?: ReactNode
  // The way to add another criterion, as a quiet row at the column's own
  // bottom. Absent when the dimension can take nothing more: see the render
  // site for why this surface refuses in silence.
  action?: ReactNode
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
    // The shared dimension frame, this chapter's lens in its heading row. The
    // name points at the title's own span, not at the whole row, so the help
    // trigger beside it cannot end up in the name.
    <DimensionFrame
      headingId={titleId}
      data-full={String(full)}
      heading={
        <>
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
              when it filled would shift under the reader. Filled in, it is
              also the whole answer: a full dimension simply loses its add
              row. */}
          <Badge
            variant={full ? "secondary" : "outline"}
            className="shrink-0 tabular-nums"
          >
            {t("columnCount", { count, max })}
          </Badge>
        </>
      }
      // The way to add sits at the column's own bottom, after its cards,
      // inside the card that holds them: adding is this column's work, and a
      // control parked outside the box read as page furniture rather than as
      // the column's last row.
      //
      // Absent, not disabled and not explained, when the dimension can take
      // nothing more: on this surface the cap renders no prose at all. The
      // count chip filling in and the dimension's own help carry it instead,
      // because a fourth sentence across four columns costs more reading than
      // the state is worth.
      footer={action}
    >
      {/* An EMPTY column's note leads: it is the context for the emptiness
            under it, and a slot with its explanation below it reads backwards
            (the reader meets a dashed box, then finds out what it is for). A
            column that holds criteria puts the note last instead: there the
            cards are the content and the note is their footnote. */}
      {count === 0 && note !== undefined && (
        <div className={explained === true ? undefined : "mb-2"}>{note}</div>
      )}
      {/* The hatch leaves by fading only, popped out of flow, so the first
              card added reflows once instead of waiting for a placeholder to
              collapse under it (ui-animation.md rule 6). The column grows under
              the card arriving, so it must never gain overflow-hidden: a card
              animating across this edge would be clipped for the length of the
              spring (rule 4). */}
      <AnimatePresence initial={false} mode="popLayout">
        {count === 0 && explained !== true && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            role="img"
            aria-label={t("columnEmpty")}
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
      {count > 0 && note !== undefined && <div className="mt-2">{note}</div>}
    </DimensionFrame>
  )
}
