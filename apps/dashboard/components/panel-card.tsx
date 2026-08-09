import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import type { ReactNode } from "react"
import { Medallion } from "@/components/medallion"

// The dashboard's list surface: a titled panel holding rows (to-do items,
// recent activity, a chart). Its header is the chip + title on the left and,
// optionally, one text link out to the full surface on the right.
//
// The third and last card shape in the app, beside WidgetCard (one figure)
// and ActionCard (one destination). A dashboard reads as structure when
// every card is recognisably one of the three, so anything list-shaped
// belongs here rather than in hand-rolled card chrome.
export function PanelCard({
  title,
  icon,
  meta,
  action,
  bleed = false,
  className,
  children,
}: {
  title: string
  icon?: IconSvgElement
  // A short trailing readout in the header (e.g. how many items there are).
  meta?: ReactNode
  action?: { label: string; href: string }
  // Renders the body flush to the card's edges instead of inside the card's
  // padding, and drops the bottom padding with it. For a chart that is
  // meant to reach the card's own boundary: a plot inset by the card's
  // padding reads as a picture placed ON the card, one that bleeds reads as
  // the card's own surface. The card already clips its overflow, so the
  // fill takes the rounded bottom corners.
  bleed?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Card size="sm" className={cn("gap-3", bleed && "pb-0", className)}>
      <CardHeader className="flex flex-row items-center gap-3">
        {icon !== undefined && <Medallion icon={icon} size="sm" />}
        {/* A heading, not a paragraph: these panels are the page's sections,
            and a screen-reader user browsing by heading would otherwise find
            nothing below the first one. */}
        <h3 className="min-w-0 flex-1 truncate font-medium text-sm">{title}</h3>
        {meta}
        {action !== undefined && (
          <Link
            href={action.href}
            className="group/panel flex shrink-0 items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            {action.label}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover/panel:translate-x-0.5"
            />
          </Link>
        )}
      </CardHeader>
      {bleed ? children : <CardContent>{children}</CardContent>}
    </Card>
  )
}
