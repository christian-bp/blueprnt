"use client"

import { useDroppable } from "@dnd-kit/core"
import type { DimensionKey } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useId } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  type ZoneDropData,
  zoneAccepts,
  zoneDroppableId,
} from "@/lib/builder-dnd"

// What the zone is doing right now. Carried as a data attribute as well as a
// tint, because "I will take this" versus "I cannot take this" is the entire
// answer the zone gives during a drag, and nothing else on it says so.
type ZoneState = "idle" | "receptive" | "over" | "blocked" | "inactive"

// Colour only, never geometry: a zone must not change size when a card comes
// near it, or the four columns would shuffle under the pointer mid-drag.
const TONE: Record<ZoneState, string> = {
  idle: "border-border",
  receptive: "border-brand/60 bg-brand/5",
  over: "border-brand bg-brand/10",
  // A card that this dimension cannot take, sitting right on top of it. The
  // destructive tint is the "not allowed" answer, given while the drag is
  // still in the air rather than after a drop that silently does nothing.
  blocked: "border-destructive/60 bg-destructive/5",
  // Some other dimension's card is in flight: this zone recedes so the one
  // that CAN take it is the only lit target on the page.
  inactive: "border-border opacity-60",
}

// One dimension's drop zone: the dashed card at the top of its column that
// holds the criteria chosen for that dimension.
//
// Dashed rather than solid because the border is a promise about the box: a
// dashed outline is the app's (and the wider convention's) way of saying "this
// container takes something", and the four of them read as one row of slots
// rather than four cards that happen to be empty.
//
// The zone accepts ONLY its own dimension's cards, and it answers a foreign
// card while the drag is still in the air (see TONE). It stays a live
// droppable in every state, including full: a target that vanished from under
// a drag would leave the reader with no explanation of where their card went,
// where a lit "no" is an answer.
export function DimensionDropZone({
  dimensionKey,
  title,
  helpBody,
  count,
  max,
  full,
  children,
}: {
  dimensionKey: DimensionKey
  title: string
  // The dimension's guiding question, shown behind the help affordance beside
  // the title. Supplied by the caller because the wording is localized library
  // content, not this component's copy.
  helpBody: string
  count: number
  max: number
  // The dimension cannot take another criterion. Passed separately from
  // count/max because the model's own 6-8 ceiling can close a zone that has
  // not reached its per-dimension cap.
  full: boolean
  // The dimension's placed criteria, as list ITEMS: the zone renders them
  // inside its own <ul>, so a card cannot end up an orphan <li> in whichever
  // view mounted it. Absent while count is 0, where the hatch stands in for
  // them.
  children?: ReactNode
}) {
  const t = useTranslations("dashboard.model.build")
  const tHelp = useTranslations("dashboard.help")
  const titleId = useId()
  const data: ZoneDropData = { dimensionKey, full }
  const { setNodeRef, isOver, active } = useDroppable({
    id: zoneDroppableId(dimensionKey),
    data,
  })

  const state: ZoneState =
    active === null
      ? "idle"
      : zoneAccepts(active.data.current, data)
        ? isOver
          ? "over"
          : "receptive"
        : isOver
          ? "blocked"
          : "inactive"

  return (
    // A section rather than a div with role="group": it is a titled part of
    // the page holding its own content, which is what a section is, and naming
    // it makes it a place a screen reader can jump straight to, which on a
    // four-column build surface is how the reader gets to their dimension.
    // The name points at the title's own span, not at the heading, so the help
    // trigger beside it cannot end up in the zone's name.
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      data-state={state}
      data-full={String(full)}
      className={cn(
        // `transition` rather than transition-colors: the receding state is an
        // opacity change, and a zone that snapped to 60% the instant a drag
        // started would read as a glitch rather than as stepping aside.
        "rounded-xl border border-dashed p-3 transition motion-reduce:transition-none",
        TONE[state]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 font-medium text-sm">
          <span id={titleId} className="truncate">
            {title}
          </span>
          {/* Named after what it answers rather than after the dimension: a
              trigger named "Effort" beside a region and a heading of the same
              name puts three nodes with one name in the reader's ear, and none
              of them says what pressing it would tell them. */}
          <HelpMorphButton label={tHelp("dimensionLabel")}>
            {helpBody}
          </HelpMorphButton>
        </h3>
        {/* The count IS the full state, and it says so by FILLING IN rather
            than by gaining a line: a second sentence would be one more thing to
            read on a page carrying four of these, and a zone that grew when it
            filled would shift its column under the reader. The words for what
            to do about it belong on the library cards the cap is blocking,
            which is where the reader is reaching. */}
        <Badge
          variant={full ? "secondary" : "outline"}
          className="shrink-0 tabular-nums"
        >
          {t("zoneCount", { count, max })}
        </Badge>
      </div>
      {/* relative: popLayout takes the leaving hatch out of flow, which needs a
          positioned ancestor. */}
      <div className="relative mt-3">
        {/* The hatch leaves by fading only, popped out of flow, so the first
            card dropped into the zone reflows once instead of waiting for a
            placeholder to finish collapsing under it (ui-animation.md rule 6).
            The zone grows under the card arriving, so it must never gain
            overflow-hidden: a card morphing across this edge would be clipped
            for the length of the spring (rule 4). */}
        <AnimatePresence initial={false} mode="popLayout">
          {count === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              role="img"
              aria-label={t("zoneEmpty")}
              // Deep enough to read as a slot with room in it rather than as a
              // rule under the title, shallow enough that four empty zones
              // side by side do not push their library lists off the screen,
              // which is the state every new org opens this page in.
              className={`h-16 w-full rounded-md ${HATCH_CLASS}`}
            />
          )}
        </AnimatePresence>
        {/* The zone owns the list rather than the caller: the placed cards are
            list items, and a contract that asked every view to remember the
            <ul> around them is one an orphan <li> eventually ships past. */}
        {children !== undefined && <ul className="space-y-2">{children}</ul>}
      </div>
    </section>
  )
}
