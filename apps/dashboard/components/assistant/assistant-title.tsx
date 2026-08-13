"use client"

import { AnimatePresence, motion } from "motion/react"

// The chat header's animated conversation title (midday's treatment, ported
// to motion/react): once the AI-generated title lands, it crossfades in
// (width 0 -> auto, opacity 0 -> 1) rather than snapping into place. Keyed by
// the title text itself so switching to a different thread (a different
// title, or one still awaiting its own title) restages the same enter
// animation instead of the text swapping mid-span. mode="wait" so an
// outgoing title fully exits before the next one enters, never overlapping;
// `exit` mirrors `initial` (deliberately added, not in midday's source,
// which leaves mode="wait" with nothing to wait on: dropping an exit must be
// a stated choice, never a silent default, per docs/ui-animation.md's
// standing convention that legitimate enter/leave transitions are animated,
// never instant) so there is an actual animation for mode="wait" to
// sequence.
// Renders nothing while there is no title yet (a fresh thread, or one whose
// generation has not landed): the header row's own flex spacers, not this
// component, keep the three-region layout centered either way.
export function AssistantTitle({ title }: { title: string | undefined }) {
  return (
    <AnimatePresence mode="wait">
      {title !== undefined && (
        <motion.span
          key={title}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="inline-block max-w-[300px] overflow-hidden truncate whitespace-nowrap text-muted-foreground text-sm"
        >
          {title}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
