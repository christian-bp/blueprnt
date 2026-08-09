import Link from "next/link"

// Turns a whole card into one link: an anchor stretched over the card's box
// rather than a wrapper around its content, so the card's markup stays a
// heading, a figure, a chart instead of living inside an <a>.
//
// The focus ring is an INSET ring, not an outline. A Card carries
// overflow-hidden and this anchor's border box IS the card's clip edge, so
// anything painted outside that box never appears: an `outline-offset-2` ring
// left the dashboard with no visible focus indicator at all. An inset ring is
// drawn inside the same box, where the clip cannot reach it, and it matches
// the ring-based focus treatment the design system uses everywhere else
// rather than introducing an outline-based one.
//
// The accessible name comes from `label` rather than an sr-only child, or the
// card would carry its own title twice in the text tree.
//
// Anything interactive inside the card would sit UNDER this anchor and stop
// answering the mouse, which is why the components that use it accept a
// destination or in-card controls, never both (see WidgetCard's props).
export function CardOverlayLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      aria-label={label}
      href={href}
      className="absolute inset-0 rounded-xl focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
    />
  )
}
