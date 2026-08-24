"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// THE APP'S THREE DISCLOSURE TIERS, so the next surface picks rather than
// invents a fourth:
//
//  1. AccordionSection (components/accordion-section.tsx) is for a titled
//     SECTION with a count: the whole trigger row is the button, the title
//     lives inside it, and a brand chevron leads. Reach for it when the thing
//     being revealed has a name and a size worth stating before it opens (the
//     pay-mapping review checklist, the consequence panel's group tables, the
//     evidence behind a kartläggning step).
//  2. DisclosureToggle (this file) is for DEPTH under something already
//     titled: an inline "show me more" whose label is the affordance, not a
//     heading. Reach for it when the surrounding element owns the title (the
//     rating stepper's context and scale panels, the library picker's
//     per-criterion depth, a queue class's overflow).
//  3. ZoneBandHeader (components/levels/zone-band-header.tsx) is a bespoke
//     BAND header, not a general tier: it carries a letter, a name, a span and
//     a count on one line and borrows the roles register's family-band chrome.
//     It exists because that anatomy is shared by the ladder and the matrix,
//     and nothing else in the app has it.
//
// The audit log's story row is served by NONE of them, deliberately: its whole
// <TableRow> is the button, so a nested <button> is invalid, and its chevron is
// drawn from the shared DisclosureChevron below rather than by this component.
// This docstring used to claim that row as a call site it had consolidated,
// which was never true.
//
// Four surfaces grew their own copy of this control within a single phase, and
// a fifth predated them with the chevron on the other side at a different
// size. That is the drift a named component exists to stop: a reader who
// learns the gesture on one surface should meet the same control everywhere.
//
// LABEL FIRST, chevron after. The label is what the reader is looking for; the
// chevron only says which way it will go. `aria-expanded` carries the state, so
// the chevron is decorative and rotates rather than swapping glyphs, which
// keeps the control's width fixed and its box from jogging as it opens.
//
// The caller owns the panel and the animation: this is the trigger only, so a
// surface can reveal in place, inside a table cell, or through AnimatePresence
// without this component knowing which.

// The glyph itself, so the one surface that cannot use the button (the audit
// story row) still draws the identical chevron rather than a second copy of
// its spec. Decorative: the control that owns it carries aria-expanded, so it
// rotates rather than swapping glyphs, which keeps its box from jogging.
export function DisclosureChevron({
  open,
  className,
}: {
  open: boolean
  className?: string
}) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      strokeWidth={2}
      aria-hidden="true"
      className={cn(
        "size-3.5 transition-transform motion-reduce:transition-none",
        open && "rotate-180",
        className
      )}
    />
  )
}

export function DisclosureToggle({
  label,
  open,
  panelId,
  onToggle,
  className,
}: {
  label: string
  open: boolean
  // Present when the caller renders a panel this trigger controls; omitted for
  // a trigger whose panel is not a separately identified region (a table row
  // that expands into sibling rows).
  panelId?: string
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      {...(panelId !== undefined ? { "aria-controls": panelId } : {})}
      className={cn(
        "flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground",
        className
      )}
      onClick={onToggle}
    >
      {label}
      <DisclosureChevron open={open} />
    </button>
  )
}
