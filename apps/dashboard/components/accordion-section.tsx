"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import type { ReactNode } from "react"

// The app's accordion-section anatomy (generalized from the overview to-do
// widget so every accordion in the app reads the same): a brand chevron at
// the START of the trigger row, pointing right when collapsed and rotating
// to point down when open, the section title
// next to it, and an optional right-aligned muted meta slot (typically a
// count). The vendor trigger's own trailing chevron pair is force-hidden
// with `[&>svg]:hidden!` (the `!` beats its expanded-state
// `group-aria-expanded:inline`; `>` targets only its direct-child icons,
// never our nested one). Compose sections inside a vendor <Accordion> root;
// the root decides single/multiple and default-open values.
export function AccordionSection({
  value,
  title,
  meta,
  className,
  contentClassName,
  children,
}: {
  value: string
  title: ReactNode
  // Right-aligned muted meta (a count); omit for a title-only trigger.
  meta?: ReactNode
  // Extra classes for the AccordionItem (e.g. the to-do widget's own
  // per-section card chrome: rounded-xl border px-4).
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    <AccordionItem value={value} className={className}>
      <AccordionTrigger className="[&>svg]:hidden!">
        <span className="flex flex-1 items-center gap-2">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4 shrink-0 text-brand transition-transform group-aria-expanded/accordion-trigger:rotate-90 motion-reduce:transition-none"
          />
          <span>{title}</span>
          {meta !== undefined && (
            <span className="ml-auto text-muted-foreground tabular-nums">
              {meta}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className={contentClassName}>
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}
