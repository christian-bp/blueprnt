"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// Large selectable card for one-question-per-screen choices (language,
// country, industry, model choice). The optional badge overlaps the top
// edge (the established "Recommended" ribbon position); the card reserves
// no extra space for it, so toggling selection never shifts layout.
export function OptionCard({
  title,
  description,
  badge,
  selected,
  onSelect,
  className,
  children,
}: {
  title: string
  description?: string
  badge?: string
  selected: boolean
  onSelect: () => void
  className?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50",
        selected && "border-primary bg-primary/5",
        className
      )}
    >
      {badge !== undefined && (
        <Badge className="absolute -top-2.5">{badge}</Badge>
      )}
      <span className="font-medium">{title}</span>
      {description !== undefined && (
        <span className="text-muted-foreground text-sm">{description}</span>
      )}
      {children}
    </button>
  )
}
