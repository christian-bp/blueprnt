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

// Brand is the default and means "this concerns you". Muted is for a card
// that is only a way in, with nothing waiting behind it: it lets one row
// hold both without a second heading to separate them.
const TONES = {
  brand: "bg-brand/10 text-brand dark:bg-brand/20",
  muted: "bg-muted text-muted-foreground",
} as const

export function Medallion({
  icon,
  size = "md",
  tone = "brand",
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
      <HugeiconsIcon icon={icon} strokeWidth={2} />
    </span>
  )
}

// The chip WITHOUT an icon, for skeletons: which icon belongs in a chip is
// often data-dependent, but the square itself is fixed chrome and has to
// measure identically in both states.
export function medallionClass(
  size: keyof typeof SIZES = "md",
  tone: keyof typeof TONES = "brand",
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
