"use client"

import { ArrowRight01Icon, ExpandIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  CardAction,
  CardContent,
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
import { Frame, FramePanel } from "@workspace/ui/components/frame"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { createContext, type ReactNode, useContext, useState } from "react"
import { CardOverlayLink } from "@/components/card-overlay-link"
import { Medallion } from "@/components/medallion"

// The app's ONE widget card: every stat, chart and status tile in the
// dashboard is this component. There used to be two (this one and the
// overview's own), which meant two answers to what a widget looks like and
// per-surface drift in padding, title size and header controls.
//
// A STAT tile reads name-then-figure: the identity mark and the tile's name
// on the first line with whatever the caller puts on its right, then the
// figure on the row below with its one qualifying line above it and its own
// history beside it. The words are on top and the number is at the bottom
// left of every tile, so a strip of them scans as a row of numbers rather
// than as three columns of prose.
//
// One qualifying line, not two. The second line was always a standing
// explainer of what the figure is ("Everyone included in this pay mapping"),
// which a tile is the wrong place for; the line that earns its keep is the
// live one (how the figure moved, what state it is in).
//
// A CHART card keeps the vendor card's own header: its title is a heading
// rather than a label, and whatever qualifies the picture sits under it in
// the footer.
//
// A widget that navigates makes the WHOLE card the link and shows a chevron
// on hover, so no control sits in the corner competing with the mark.
interface WidgetCardBase {
  title: string
  // The card's identity mark.
  icon?: IconSvgElement
  // The one line that qualifies the figure, in muted type under its name.
  // Keep it a phrase, not a sentence: it is clipped to one line, because a
  // tile's height cannot depend on how long the same note happens to be in
  // the reader's language.
  note?: ReactNode
  // An extra control on the head line, right-aligned: a delta chip, a
  // severity badge, a scope chip. Never interactive on a linked card.
  headerExtra?: ReactNode
  className?: string
  children?: ReactNode
}

// A tile either carries a FIGURE or a picture, never both, and each shape
// owns the slots that only make sense for it: a sparkline belongs beside a
// number, a footer statement belongs under a chart. Splitting them makes the
// wrong combination a compile error instead of content that silently never
// renders.
type WidgetCardShape =
  | {
      // The headline figure. With one, the card is a stat tile and `title`
      // becomes its label.
      value: ReactNode
      // Beside the figure on its own line: the figure's own history as a
      // sparkline.
      trailing?: ReactNode
      footer?: never
      footerIcon?: never
    }
  | {
      value?: never
      trailing?: never
      // What qualifies the picture, in foreground weight under it.
      footer?: ReactNode
      // Trailing direction arrow on that line. aria-hidden: the statement
      // already says which way it went, so the arrow exists to make the
      // direction survive a glance (and greyscale), not to carry it.
      footerIcon?: IconSvgElement
    }

// The bar that stands in for a tile's `value` or `note` while it waits for
// its figure. It lives here rather than at each call site because it is the
// same bar in the same slots everywhere, and four hand-rolled copies had all
// made the same mistake.
//
// The zero-width strut is what makes the slot measure right. A wrapper
// carrying only `flex items-center` has no line box at all: a flex container
// sizes to its content, so the slot measured the BAR (28px under a 45px
// figure, 16px under each 20px footer line) and a strip of tiles stood 25px
// short until its data arrived, taking everything below it down the page. The
// strut is an empty inline box that inherits the surrounding size and leading,
// so it reinstates exactly the line box the loaded text would have made, at
// every size a tile uses: 28px inside the text-xl figure, 16px in a text-xs
// note. A fixed height would have to restate each of those to do the same,
// and would drift the moment any of them changed.
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

// Whether the subtree is being rendered inside an expanded widget dialog
// rather than in the card itself.
//
// A chart cannot size itself without this. Expanding is a request for a
// LARGER canvas, and a chart whose height is a fixed class renders at exactly
// the same size in the dialog: it gains the dialog's extra width and not one
// pixel of height, which is the whole reason expanding felt broken on a big
// screen. Charts read this and pick their plot height from it.
//
// A context rather than a prop, because the alternative was making every call
// site pass the same component twice, once with a size flag set. Three call
// sites did exactly that, which is three chances for the two renderings to
// drift into different charts.
const WidgetExpandedContext = createContext(false)

export function useWidgetExpanded(): boolean {
  return useContext(WidgetExpandedContext)
}

// A card either NAVIGATES or holds its own controls, never both. The link is
// an anchor stretched over the whole card, so anything interactive underneath
// it stops answering the mouse while still being reachable by keyboard: an
// expand button on a linked card would be half-broken in a way nothing on
// screen reveals. Splitting the props makes that combination a compile error
// rather than a comment nobody reads. (The earlier comment here gave the
// wrong reason: the anchor is a sibling of the controls, not their ancestor,
// so it is not invalid HTML, it is invisible interception.)
//
// No help layer: a widget carries no explaining popover of its own. The tile
// is title, figure and one qualifying line, and the concept behind it is
// explained where it is worked with rather than beside every readout of it.
type WidgetCardProps = WidgetCardBase &
  WidgetCardShape &
  (
    | {
        // Makes the WHOLE card the link to this destination.
        href: string
        expandable?: never
      }
    | {
        href?: never
        expandable?: boolean
      }
  )

export function WidgetCard({
  title,
  icon,
  value,
  footer,
  footerIcon,
  note,
  headerExtra,
  trailing,
  href,
  expandable = false,
  className,
  children,
}: WidgetCardProps) {
  const t = useTranslations("dashboard.widgetCard")
  const [open, setOpen] = useState(false)
  const stat = value !== undefined

  const expandButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={t("expand")}
      onClick={() => setOpen(true)}
    >
      <HugeiconsIcon icon={ExpandIcon} strokeWidth={2} />
    </Button>
  )

  return (
    // EXPERIMENT: the widget on the app's frame anatomy, a muted ground
    // carrying one white panel, so a tile reads as the same object as a
    // register or an analysis step instead of a lone flat card.
    <Frame className={cn("w-full", className)}>
      <FramePanel
        // The card parts inside (CardTitle, CardDescription) size themselves
        // off the card group's own data-size, so the panel carries it: the
        // figure keeps its step-up now that the Card element is gone.
        data-size="sm"
        className={cn(
          // A floor height so a strip of tiles is one band whatever each
          // carries, and the rows spaced by the reference's own step.
          "group/card @container/card flex min-h-28 flex-col gap-5",
          href !== undefined &&
            "group/widget relative transition-colors hover:bg-accent/40"
        )}
      >
        {stat ? (
          <>
            {/* The tile's name on its own line, with the mark that identifies
                it and whatever the caller puts on the right (a delta chip, a
                scope chip). */}
            <div className="flex items-center gap-3">
              {icon !== undefined && <Medallion icon={icon} size="sm" />}
              <span className="min-w-0 flex-1 truncate font-semibold text-sm">
                {title}
              </span>
              {headerExtra}
              {expandable && expandButton}
            </div>
            {/* The figure with its one qualifying line above it, and the
                figure's own history beside it. The line sits ABOVE rather
                than below, so the number is the last thing read on the row
                and the two tiles beside it line their numbers up on the same
                baseline whatever their labels say.

                pb-2 lifts the pair off the bottom edge, where the strip's
                own fill runs out: without it the figure reads as sitting
                lower than the curve it belongs to. */}
            <div className="flex items-end justify-between gap-2.5">
              <div className="flex min-w-0 flex-col gap-px pb-2">
                {note !== undefined && (
                  <span className="truncate whitespace-nowrap text-muted-foreground text-xs">
                    {note}
                  </span>
                )}
                <span className="truncate font-semibold text-foreground text-xl tabular-nums tracking-tight">
                  {value}
                </span>
              </div>
              {trailing}
            </div>
          </>
        ) : (
          <CardHeader>
            <CardTitle className="truncate text-muted-foreground">
              {title}
            </CardTitle>
            <CardAction className="flex items-center gap-2">
              {headerExtra}
              {icon !== undefined && <Medallion icon={icon} />}
              {expandable && expandButton}
            </CardAction>
          </CardHeader>
        )}
        {children !== undefined && <CardContent>{children}</CardContent>}
        {/* The qualifier under a chart card, one line, clipped rather than
          wrapped: a card's height cannot depend on how long a sentence
          happens to be in the reader's language, or a strip grows by a line
          in the locales where the same note wraps. The copy is written to
          fit, so the ellipsis is the guard rather than the normal state.

          The nova footer ships border-t + bg-muted/50 chrome for footers
          that ARE a distinct band (a frame's pagination foot), which reads
          as a broken seam here. Neutralized, and pt-0 restores the column
          rhythm the card had before the footer slot went tonal. */}
        {!stat && (footer !== undefined || note !== undefined) && (
          <CardFooter className="mt-auto flex-col items-start gap-0.5 border-t-0 bg-transparent pt-0 text-sm">
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
              <div className="w-full truncate text-muted-foreground">
                {note}
              </div>
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
            {/* Sized to the SCREEN, not to a fixed step. The dialog used to cap
              at 5xl (1024px), which is narrower than the page behind it on any
              large monitor: expanding a chart there made it smaller. It keeps
              a cap all the same, because a plot stretched across 2500px
              spreads its points into a thin band that reads worse than the
              card did, and it keeps a margin so the dialog still reads as a
              layer above the page rather than as a new page.

              The height cap plus a scrolling body is what lets the chart
              inside ask for a tall canvas without the dialog growing past the
              viewport and taking its own header off screen. */}
            <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-[min(96rem,calc(100vw-4rem))]">
              {/* The same heading and controls the card carries. The dialog
                is where the reader actually works with the chart, and a mode
                toggle that only exists in the small version means expanding
                costs you the controls. */}
              <DialogHeader className="flex-row items-center justify-between gap-4 space-y-0 pr-8">
                <DialogTitle>{title}</DialogTitle>
                {headerExtra !== undefined && (
                  <div className="flex items-center gap-2">{headerExtra}</div>
                )}
              </DialogHeader>
              <WidgetExpandedContext.Provider value={true}>
                {children}
              </WidgetExpandedContext.Provider>
            </DialogContent>
          </Dialog>
        )}
      </FramePanel>
    </Frame>
  )
}
