"use client"

import { ArrowRight01Icon, ExpandIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { CardOverlayLink } from "@/components/card-overlay-link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { Medallion } from "@/components/medallion"

// The app's ONE widget card: every stat, chart and status tile in the
// dashboard is this component. There used to be two (this one and the
// overview's own), which meant two answers to what a widget looks like and
// per-surface drift in padding, title size and header controls.
//
// It reads in one column, top to bottom, which is the shadcn stat-card
// anatomy: the label (CardDescription), then the figure it labels
// (CardTitle), then whatever qualifies the figure (CardFooter). Text used to
// sit BESIDE the figure, which made a row of tiles a set of three columns to
// scan instead of three headlines.
//
// The card's identity mark, a tinted icon chip, sits in CardAction with any
// badge the caller passes. A widget that navigates makes the WHOLE card the
// link and shows a chevron on hover, so no control sits in the corner
// competing with the chip.
//
// Card size="sm" rather than hand-picked padding: it is the design system's
// own compact scale (a tighter --card-spacing and a smaller CardTitle), so a
// widget stays a widget when the vendor card changes.
interface WidgetCardBase {
  title: string
  // The card's identity mark, top right.
  icon?: IconSvgElement
  // The headline figure. With one, the card is a stat tile and `title`
  // becomes its label; without one (a chart card), `title` stays the card's
  // own heading.
  value?: ReactNode
  // What qualifies the figure: a comparison, a state, a run's name. Below
  // the figure, never beside it.
  footer?: ReactNode
  // An extra header control beside the icon chip (e.g. a severity badge or
  // a delta pill). Never interactive on a linked card: see below.
  headerExtra?: ReactNode
  className?: string
  children?: ReactNode
}

// A card either NAVIGATES or holds its own controls, never both. The link is
// an anchor stretched over the whole card, so anything interactive underneath
// it stops answering the mouse while still being reachable by keyboard: a
// help popover or an expand button on a linked card would be half-broken in a
// way nothing on screen reveals. Splitting the props makes that combination a
// compile error rather than a comment nobody reads. (The earlier comment here
// gave the wrong reason: the anchor is a sibling of the controls, not their
// ancestor, so it is not invalid HTML, it is invisible interception.)
type WidgetCardProps = WidgetCardBase &
  (
    | {
        // Makes the WHOLE card the link to this destination.
        href: string
        help?: never
        expandable?: never
        expandedChildren?: never
      }
    | {
        href?: never
        help?: { label: string; body: string }
        expandable?: boolean
        expandedChildren?: ReactNode
      }
  )

export function WidgetCard({
  title,
  icon,
  help,
  value,
  footer,
  headerExtra,
  href,
  expandable = false,
  expandedChildren,
  className,
  children,
}: WidgetCardProps) {
  const t = useTranslations("dashboard.widgetCard")
  const [open, setOpen] = useState(false)
  const stat = value !== undefined

  const label = (
    <>
      {title}
      {help !== undefined && (
        <HelpMorphButton label={help.label}>{help.body}</HelpMorphButton>
      )}
    </>
  )

  return (
    <Card
      size="sm"
      className={cn(
        // Tighter than the card default between header and body: a stat tile
        // is one number under one label, and the standard gap made a row of
        // them twice the height of the reading they carry.
        "@container/card gap-3",
        href !== undefined &&
          "group/widget relative transition-colors hover:bg-accent/40",
        className
      )}
    >
      <CardHeader>
        {stat ? (
          <>
            <CardDescription className="flex items-center gap-2">
              {label}
            </CardDescription>
            {/* The figure IS the card's title once there is one. It steps up
                a size on a wide tile, so a four-across strip and a two-across
                one both fill their width.

                The size has to be written as the same variant CardTitle uses
                (group-data-[size=sm]/card:text-sm), not as a plain text-2xl:
                a variant beats a bare utility whatever the order, so the
                unqualified class lost and the figure rendered at label
                size. */}
            <CardTitle className="font-semibold tabular-nums @[220px]/card:group-data-[size=sm]/card:text-3xl group-data-[size=sm]/card:text-2xl">
              {value}
            </CardTitle>
          </>
        ) : (
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            {label}
          </CardTitle>
        )}
        <CardAction className="flex items-center gap-2">
          {headerExtra}
          {icon !== undefined && <Medallion icon={icon} />}
          {expandable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("expand")}
              onClick={() => setOpen(true)}
            >
              <HugeiconsIcon icon={ExpandIcon} strokeWidth={2} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {children !== undefined && <CardContent>{children}</CardContent>}
      {footer !== undefined && (
        <CardFooter className="text-muted-foreground text-sm">
          {footer}
        </CardFooter>
      )}
      {href !== undefined && (
        <>
          <CardOverlayLink href={href} label={title} />
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute right-(--card-spacing) bottom-(--card-spacing) size-4 text-muted-foreground opacity-0 transition-opacity group-hover/widget:opacity-100"
          />
        </>
      )}
      {expandable && (
        <Dialog open={open} onOpenChange={setOpen}>
          {/* Deliberately wider than the sm:max-w-md default: the whole point
              of expanding is a larger canvas for the chart. */}
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {expandedChildren ?? children}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
