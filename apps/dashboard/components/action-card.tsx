import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CardOverlayLink } from "@/components/card-overlay-link"
import { Medallion, medallionClass } from "@/components/medallion"

// A dashboard's "do this next" card: one row, the chip on the left, what it
// does and where it leads in the middle, a chevron on the right. Short by
// design (one label line over one detail line), so a row of them reads as a
// bar of destinations rather than four more panels competing with the data
// below.
//
// The whole card is the link (CardOverlayLink), so the hit area is the card
// rather than a control inside it.
export function ActionCard({
  title,
  description,
  icon,
  href,
  tone = "brand",
}: {
  title: string
  description: string
  icon: IconSvgElement
  href: string
  // Brand marks a card that concerns the reader right now; muted marks one
  // that is only a destination. The two have to be told apart across a row
  // at a glance, so the tone rides on the whole card, not just its chip: a
  // brand card takes a near-white brand wash and a brand ring, and states
  // its detail (a count of what is waiting) in brand ink. The wash stays
  // barely-there on purpose; the ring, the chip and the coloured text carry
  // the signal, and a saturated tile in the top row shouts over the figures
  // underneath it.
  tone?: "brand" | "muted"
}) {
  const brand = tone === "brand"
  return (
    <Card
      size="sm"
      data-tone={tone}
      className={cn(
        "group/action relative flex-row items-center gap-3 px-(--card-spacing) transition-colors",
        brand
          ? // OPAQUE, mixed rather than washed. twMerge collapses bg-*, so a
            // `bg-brand/4` here REPLACED the Card's own bg-card and left the
            // card 4% opaque: it looked right against a white page, but
            // anything painted behind it showed through at 96%, which is how
            // the confetti stayed visible inside the card. color-mix gives
            // the identical tint as a solid colour, so the card can occlude.
            //
            // Two things have to match for the tint to come out unchanged.
            // in_srgb, NOT in_oklab: alpha compositing happens in sRGB, so
            // that is the space that reproduces the wash exactly, while the
            // same 4% in Oklab is perceptually reasonable and visibly a
            // different colour. And --background, NOT --card: with no
            // background of its own the card washed the brand over the PAGE.
            // The two tokens are the same white in light mode, so only dark
            // mode can tell them apart, and there --card is three steps
            // lighter, which turns the recessed tinted card into a raised one.
            "bg-[color-mix(in_srgb,var(--brand)_4%,var(--background))] ring-brand/25 hover:bg-[color-mix(in_srgb,var(--brand)_8%,var(--background))] dark:bg-[color-mix(in_srgb,var(--brand)_8%,var(--background))]"
          : "hover:bg-accent/40"
      )}
    >
      <Medallion icon={icon} tone={tone} ring={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{title}</p>
        <p
          className={cn(
            "truncate text-xs",
            brand ? "font-medium text-brand" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 transition-transform group-hover/action:translate-x-0.5",
          brand ? "text-brand" : "text-muted-foreground"
        )}
      />
      <CardOverlayLink href={href} label={title} />
    </Card>
  )
}

// The same card with its two data-dependent lines standing in as bars.
//
// A to-do card's identity IS data: which work it points at is not known until
// the query lands. Rendering the standing destinations meanwhile looked
// decisive and then silently became different cards, which reads as the page
// changing its mind. The chip and the chevron are chrome every card carries,
// so they render real (muted) rather than as grey blocks.
//
// The bars sit in line boxes matching the type they replace (text-sm is a
// 20px line, text-xs a 16px one), so a row of these measures exactly what the
// loaded row measures and nothing moves when the cards arrive.
export function ActionCardSkeleton() {
  return (
    <Card size="sm" className="flex-row items-center gap-3 px-(--card-spacing)">
      <span
        aria-hidden="true"
        className={medallionClass("md", "muted", false)}
      />
      <div className="min-w-0 flex-1">
        <span className="flex h-5 items-center">
          <Skeleton className="h-4 w-28" />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-36" />
        </span>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground/40"
      />
    </Card>
  )
}
