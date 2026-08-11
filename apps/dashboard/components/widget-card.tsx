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
import { Skeleton } from "@workspace/ui/components/skeleton"
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
  // What qualifies the figure, as two lines under it (the shadcn stat-card
  // anatomy). `footer` is the STATEMENT: how the figure moved, or what state
  // it is in, in foreground weight because it is the second thing worth
  // reading after the number. `note` is the muted line under it saying what
  // the figure covers.
  //
  // The statement is where a delta belongs, spelled out with its amount
  // ("25 people fewer than 2026"), not a pill in the corner. A pill splits
  // one reading into two fragments that only mean something together, sits
  // where the identity chip already is, and forces a screen reader to be
  // handed a separate sentence to make up for it.
  footer?: ReactNode
  // Trailing direction arrow on the statement line. aria-hidden: the
  // statement already says which way it went, so the arrow exists to make the
  // direction survive a glance (and greyscale), not to carry it.
  footerIcon?: IconSvgElement
  note?: ReactNode
  // An extra header control beside the icon chip (e.g. a severity badge or
  // a delta pill). Never interactive on a linked card: see below.
  headerExtra?: ReactNode
  className?: string
  children?: ReactNode
}

// The bar that stands in for one of the three slots above (`value`, `footer`,
// `note`) while a tile waits for its figure. It lives here rather than at each
// call site because it is the same bar in the same slots everywhere, and four
// hand-rolled copies had all made the same mistake.
//
// The zero-width strut is what makes the slot measure right. A wrapper
// carrying only `flex items-center` has no line box at all: a flex container
// sizes to its content, so the slot measured the BAR (28px under a 45px
// figure, 16px under each 20px footer line) and a strip of tiles stood 25px
// short until its data arrived, taking everything below it down the page. The
// strut is an empty inline box that inherits the surrounding size and leading,
// so it reinstates exactly the line box the loaded text would have made, at
// every size a tile uses: 45px inside a text-3xl figure, 36px when the tile is
// narrow enough to drop to text-2xl, 20px in a text-sm footer line. A fixed
// height would have to restate the figure's container query to do the same,
// and would drift the moment either size changed.
export function StatBar({ className }: { className: string }) {
  return (
    <span className="flex items-center">
      <span aria-hidden="true" className="w-0 overflow-hidden">
        &nbsp;
      </span>
      <Skeleton className={className} />
    </span>
  )
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
  footerIcon,
  note,
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
      {/* Both lines are ONE line each, clipped rather than wrapped. A tile's
          height cannot depend on how long a sentence happens to be in the
          reader's language: at the width a 1280px window leaves (232px per
          tile), the same note fits on one line in Swedish and takes two in
          English and Finnish, so the strip grew by 20px in those locales the
          moment its figures landed. Clipping makes the height a constant of
          the card instead, in every locale and at every width. The copy is
          written to fit, so the ellipsis is the guard rather than the normal
          state. Same decision as ActionCard, which truncates both its lines
          for the same reason. */}
      {(footer !== undefined || note !== undefined) && (
        <CardFooter className="flex-col items-start gap-0.5 text-sm">
          {footer !== undefined && (
            <div className="flex w-full min-w-0 items-center gap-1.5 font-medium">
              <span className="truncate">{footer}</span>
              {footerIcon !== undefined && (
                <HugeiconsIcon
                  icon={footerIcon}
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="shrink-0"
                />
              )}
            </div>
          )}
          {note !== undefined && (
            <div className="w-full truncate text-muted-foreground">{note}</div>
          )}
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
