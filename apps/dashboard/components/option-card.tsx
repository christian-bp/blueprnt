"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { motion } from "motion/react"
import type { ReactNode } from "react"

// How long the non-chosen cards take to fade away. Screens that auto-advance
// after a choice wait at least this long before moving on, so the user sees
// the fade complete (see use-auto-advance.ts).
export const OPTION_FADE_MS = 300

// Large selectable card for one-question-per-screen choices (language,
// country, industry, model choice). The optional badge overlaps the top
// edge (the established "Recommended" ribbon position); the card reserves
// no extra space for it, so toggling selection never shifts layout.
//
// `media` renders a small decorative visual (flag, icon) inline to the left
// of the title, hidden from assistive tech since the title already names
// the option.
//
// `faded` fades the card away in place (opacity only, no layout change) and
// disables it; screens set it on the non-chosen cards once a choice is made.
export function OptionCard({
  title,
  description,
  badge,
  media,
  selected,
  faded = false,
  onSelect,
  className,
  children,
}: {
  title: string
  description?: string
  badge?: string
  media?: ReactNode
  selected: boolean
  faded?: boolean
  onSelect: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={faded}
      onClick={onSelect}
      initial={false}
      animate={{ opacity: faded ? 0 : 1 }}
      transition={{ duration: OPTION_FADE_MS / 1000, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50",
        selected && "border-primary bg-primary/5",
        className
      )}
    >
      {badge !== undefined && (
        <Badge className="absolute -top-2.5">{badge}</Badge>
      )}
      <span className="flex items-center gap-2">
        {media !== undefined && (
          <span aria-hidden="true" className="flex items-center">
            {media}
          </span>
        )}
        <span className="font-medium">{title}</span>
      </span>
      {description !== undefined && (
        <span className="text-muted-foreground text-sm">{description}</span>
      )}
      {children}
    </motion.button>
  )
}
