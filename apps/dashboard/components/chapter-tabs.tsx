"use client"

import { motion } from "motion/react"
import Link from "next/link"
import type { ReactNode } from "react"
import { ChapterActionSlot } from "@/components/chapter-action-slot"
import { SPRING } from "@/lib/motion"

// The size EVERY chapter action takes. One size across a section, owned by the
// row they all sit in rather than chosen per chapter: the actions sit at the
// same place on every chapter, and a reader moving between them should not
// meet a control that changes height as they go. It is the design system's
// DEFAULT, because nothing about this row is a reason to deviate from it (the
// house rule: never hand-pick a size per call site).
export const CHAPTER_ACTION_BUTTON_SIZE = "default" as const

// One tab in a chapter row: its identity, what it reads as, where it goes, and
// whether its page is the one open.
//
// Exported although nothing imports it by name today: it is this shared
// primitive's published contract, and a section building its own tab row types
// its rows against it rather than re-describing the shape.
export interface ChapterTab {
  key: string
  // Already localized and already numbered by the section that owns the
  // message (see chapterTabNumber for the position's own treatment).
  label: ReactNode
  href: string
  current: boolean
}

// The chunk renderer a chapter message uses for its position, so the two
// sections' rows recede their numbers identically.
//
// The position recedes: four numbers at full strength compete with the four
// names for the same glance, and the name is what the reader is choosing
// between. Muted in every state, so an active or hovered tab reads the same
// way as the rest of the row.
//
// me-1 carries the gap, NOT the space in the message: a tab is a flex
// container, so the message's " " between the number and the name is a
// whitespace-only text node, which flex layout drops entirely. The message
// keeps the space for locales that read it as text, and the margin is what
// actually separates the two on screen.
export function chapterTabNumber(chunks: ReactNode): ReactNode {
  return <span className="me-1 text-muted-foreground">{chunks}</span>
}

// The chapter tab row of a guided section: one tab per chapter, and nothing
// else. Shared by the kartläggning's analysis chapters and the model section's
// four, so a reader who has met one row already knows the other, and neither
// can drift into its own underline, its own overflow behaviour, or its own
// idea of how a numbered tab reads.
//
// It is a switcher and nothing else. Both sections' rows carried a done mark
// per chapter for a while; the spine directly above already draws every
// chapter's progress as its own segment, so the mark repeated that reading in
// a coarser form and cost the row an icon slot it had to keep empty on every
// unfinished chapter.
//
// `underlineId` must be unique per row: two rows sharing one layoutId would
// cross-animate their underlines into each other.
export function ChapterTabs({
  navLabel,
  underlineId,
  tabs,
}: {
  navLabel: string
  underlineId: string
  tabs: readonly ChapterTab[]
}) {
  return (
    // The section's journey row: tabs and the open chapter's own count left,
    // that chapter's action right. The action used to sit in a row of its own
    // between this one and the chapter's content, which spent a whole band of
    // vertical space on a single button and pushed every chapter's grid that
    // much further down. The journey's own instrument sits on the title row
    // above, with the section's name.
    //
    // min-h-9 is the action button's height, held whether or not a chapter
    // offers one, so the content below starts at the same Y on every chapter
    // and switching chapters holds the columns still.
    //
    // The tabs never truncate: they are the navigation. At a narrow width the
    // action drops to its own right-aligned line, which is the only wrap this
    // row has.
    <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1">
      <nav
        aria-label={navLabel}
        className="-mx-1 flex items-stretch gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={`relative flex shrink-0 items-center whitespace-nowrap px-2 py-2 font-medium text-sm transition-colors ${
              tab.current
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {/* inset-x-2 is the label's own box, because the tab holds nothing
                but its label: the bar hugs the text, exactly as it does in the
                header tab rows. While a done mark's slot sat in front of the
                label, this same rule left the bar running 20px past the start
                of the text on every chapter that was not yet finished, with
                nothing above that stretch. Keep the tab a label and this stays
                true; put anything beside the label again and the bar has to be
                anchored to the label itself. The open chapter's figures live
                under the instrument on the title row, not here. */}
            {tab.current && (
              <motion.span
                layoutId={underlineId}
                transition={SPRING}
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground"
              />
            )}
          </Link>
        ))}
      </nav>
      <ChapterActionSlot />
    </div>
  )
}
