"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { motion } from "motion/react"
import type { ReactNode } from "react"
import { OPTION_FADE_MS } from "@/hooks/use-auto-advance"

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
  disabled = false,
  size = "default",
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
  // A real read-only state (e.g. a completed pay-mapping run's locked step),
  // unlike `faded` it keeps the card visible, just non-interactive.
  disabled?: boolean
  // "sm" is the compact in-form variant (the review steps' verdict and
  // reason choices); "default" is the onboarding screens' large card.
  size?: "default" | "sm"
  onSelect: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={faded || disabled}
      onClick={onSelect}
      initial={false}
      animate={{ opacity: faded ? 0 : 1 }}
      transition={{ duration: OPTION_FADE_MS / 1000, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border text-center transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "p-2.5 text-sm" : "p-4",
        selected && "border-brand bg-brand/5",
        className
      )}
    >
      {badge !== undefined && (
        // The "recommended" ribbon is a positive accent, so brand it. Call-site
        // override since Badge's default variant is neutral (bg-primary).
        <Badge className="absolute -top-2.5 right-3 bg-brand text-brand-foreground">
          {badge}
        </Badge>
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
