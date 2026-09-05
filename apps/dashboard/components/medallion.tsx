import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

// The app's icon chip: a tinted square holding one domain icon. It is the
// identity mark on every dashboard surface (widget tiles, action cards,
// panel headers, to-do groups), so it lives here rather than as four copies
// of the same class string that drifted a step apart.
//
// Always decorative: every surface that uses one already names itself in
// text beside it, so the chip is aria-hidden and never the accessible name.
const SIZES = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-9 [&_svg]:size-5",
  lg: "size-10 [&_svg]:size-6",
} as const

// The default is the design system's own item chip: a muted tile with the
// app's ink on the icon. Not the brand tint it carried before, because the
// mark identifies a surface and does not ask to be acted on, while the rose
// is what the links and the primary button speak with; a page of rose chips
// spent the CTA colour on decoration.
//
// Muted keeps the quieter icon for a card that is only a way in, with
// nothing waiting behind it: it lets one row hold both without a second
// heading to separate them.
//
// Brand survives for ONE surface: the to-do cards, where the tint says
// something is waiting. There the chip belongs to the card's own state
// rather than to the app's furniture, so it keeps the rose it always had.
const TONES = {
  default: "bg-muted text-accent-foreground",
  brand: "bg-brand/10 text-brand dark:bg-brand/20",
  muted: "bg-muted text-muted-foreground",
} as const

export function Medallion({
  icon,
  size = "md",
  tone = "default",
  ring = true,
}: {
  icon: IconSvgElement
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  // The outer ring earns its keep on white ground (empty states, widget
  // headers). On an already-tinted surface (the action cards) it crowds the
  // chip, so those opt out.
  ring?: boolean
}) {
  return (
    <span aria-hidden="true" className={medallionClass(size, tone, ring)}>
      {/* A finer line than the app's usual 2: the chip's ink went from the
          brand rose to near-black, and the same stroke against that much
          contrast reads as a heavier icon than it did on the tint. */}
      <HugeiconsIcon icon={icon} strokeWidth={1.5} />
    </span>
  )
}

// The chip WITHOUT an icon, for skeletons: which icon belongs in a chip is
// often data-dependent, but the square itself is fixed chrome and has to
// measure identically in both states.
export function medallionClass(
  size: keyof typeof SIZES = "md",
  tone: keyof typeof TONES = "default",
  ring = true
) {
  return cn(
    "flex shrink-0 items-center justify-center rounded-lg",
    // The reference's outer ring: a background-colored border with the shadow
    // cast OUTSIDE it, so the chip reads tile / light ring / soft contour.
    ring &&
      "border-2 border-background shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border",
    TONES[tone],
    SIZES[size]
  )
}
