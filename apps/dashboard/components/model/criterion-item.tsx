"use client"

import { motion } from "motion/react"
import type { Variants } from "motion/react"
import type { ReactNode } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// The criterion row of the method surface: the method panel's documentation
// list, mirrored by CriterionListSkeleton while that list loads. It stays a
// shared component rather than folding into the panel because the skeleton has
// to measure identical to it, and a row whose box lives in one file cannot
// drift from a placeholder built against it.
//
// Read-only: the method surface documents and approves criteria, it does not
// remove them. The section's one remove gesture is the RemoveConfirm morph on
// the Kriterier chapter's PlacedCriterionCard.
//
// Zero-layout-shift design: a single bordered row keeps the same box in every
// state. State changes reveal controls outside the row's layout box; nothing
// resizes its neighbors.
//
//   - The weight slot is a fixed-size right-aligned container that renders the
//     weight control filling the slot. It is omitted entirely where the
//     surface carries no weighting (importanceNode undefined).
//   - The note slot is a reserved-height block below the main row, carrying a
//     criterion's share of the model. Its height is reserved so a changed
//     figure never reflows neighboring rows.
//   - The gap between items is marginBottom: 12 on the motion.li (animated to
//     0 on exit so the gap collapses with the height). Consumers must not
//     apply space-y or gap on the ul.

// Variants for the outer motion.li so the exit state can carry its own
// per-property transition (staged: fade then collapse) while the enter
// (animate) state uses a uniform spring.
const rowVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginBottom: 12,
    transition: SPRING,
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      opacity: { duration: 0.12 },
      height: { ...SPRING, delay: 0.1 },
      marginBottom: { ...SPRING, delay: 0.1 },
    },
  },
}

// Props:
//   name             - criterion display name
//   description      - optional muted subtitle
//   importanceNode   - the weight control; omit to hide the weight slot
//                      entirely
//   note             - optional reserved-height block below the row (the
//                      criterion's share of the model)
export function CriterionItem({
  name,
  description,
  extendedDescription,
  importanceNode,
  note,
}: {
  name: string
  // Optional muted subtitle (the short description).
  description?: string
  // The criterion's extended description: when given, a morph help icon next to
  // the name reveals it (the panel is titled by the criterion name). The short
  // `description` stays inline as the subtitle.
  extendedDescription?: string
  // The row's weight control, where the surface has one.
  importanceNode?: ReactNode
  // Reserved-height content below the main row (the criterion's share).
  note?: ReactNode
}) {
  return (
    // Outer motion.li carries ONLY animated geometry: layout spring for
    // siblings, height/marginBottom collapse on exit, and opacity fade.
    // It intentionally has no padding, border, min-height, or rounded classes.
    // Without those box properties the exit animation reaches a true height of
    // 0 (nothing clamps it), so AnimatePresence's unmount is a no-op and the
    // page never jumps.
    //
    // Exit staging: fade out quickly first (0.12 s), then collapse the
    // now-invisible shell after a 0.1 s delay. Because the inner div is already
    // transparent when height shrinks, content that momentarily overflows the
    // li boundary is invisible, so overflow-hidden is not needed on the li at
    // rest.
    //
    // Variants are used so the exit state can carry its own per-property
    // transition without affecting the enter (animate) transition.
    <motion.li
      layout
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Inner div owns all visual box styling. */}
      <div className="group relative rounded-md border p-3">
        <div className="flex min-h-9 items-center gap-3">
          {/* Name + description take all remaining space and stay
              truncation-safe. The extended description sits behind the morph
              help icon next to the name (always present when given, so it adds
              no layout shift); the short description stays inline as the
              subtitle. The help panel is titled by the criterion name, like the
              concept help on the page heading. */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">{name}</span>
              {extendedDescription && (
                <HelpMorphButton label={name}>
                  {extendedDescription}
                </HelpMorphButton>
              )}
            </span>
            {description && (
              <span className="truncate text-muted-foreground text-sm">
                {description}
              </span>
            )}
          </span>

          {/* Fixed-size weight slot (w-52): holds a 1-5 weight control when the
              surface has one. Omitted where the row carries no weighting at
              all, so the slot never sits empty. */}
          {importanceNode !== undefined && (
            <span className="flex h-9 w-52 shrink-0 items-center justify-end">
              {importanceNode}
            </span>
          )}
        </div>

        {/* Optional below-row note (Weight phase: the derived share). A single
            constant-height line, so no reserved height is needed: changing the
            weight only changes the percentage in place, never the line count. */}
        {note !== undefined && (
          <div className="mt-1 text-muted-foreground text-xs">{note}</div>
        )}
      </div>
    </motion.li>
  )
}
