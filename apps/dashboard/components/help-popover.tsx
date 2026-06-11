"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// A discreet round information icon that opens an explainer popover. Sits
// next to a heading or a field label; `label` doubles as the trigger's
// accessible name and the popover title.
//
// Built on the design-system Popover (radix, portaled) instead of the
// in-flow MorphPopover: help triggers sit inside arbitrary containers,
// including dialogs and scroll areas, and only a portaled panel escapes
// their overflow clipping while composing with the dialog's focus trap and
// Escape handling (a hand-rolled absolute panel was clipped inside the
// add-criterion dialog's scroll container).
export function HelpPopover({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
      </PopoverTrigger>
      {/* Wider than the popover default (w-72): help bodies run a few
          sentences and the default width wraps them into a tall ribbon. */}
      <PopoverContent align="start" className="w-[26rem] max-w-[85vw]">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <PopoverDescription>{children}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
