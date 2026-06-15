import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

// The track rendered as a tinted badge: track is a kind-of-job dimension
// (IC / Lead / M, the fixed trackKeyValidator union), and a consistent color
// per track lets the eye group roles across tables without reading. The
// tints deliberately deviate from the Badge defaults (this component IS the
// custom variant, per the shadcn-defaults convention): soft palette tints
// with dark-mode counterparts, outline base so the text keeps contrast.
// Unknown keys (future tracks) fall back to the plain outline badge.
const TRACK_TINTS: Record<string, string> = {
  IC: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  Lead: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  M: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
}

export function TrackBadge({
  trackKey,
  name,
  className,
  short = false,
}: {
  trackKey: string
  name: string
  className?: string
  // Always show the short track key (IC / Lead / M), regardless of viewport.
  // Used where space is tight and the track is a compact tag, e.g. the band
  // Overview chips. The full name stays reachable via the title tooltip.
  short?: boolean
}) {
  return (
    // Below md the tables get cramped, so the badge falls back to the short
    // track key (the full name stays reachable via the title tooltip); both
    // renderings are in the DOM and CSS picks one, so nothing measures or
    // reflows. With `short`, only the key ever renders.
    <Badge
      variant="outline"
      title={name}
      className={cn(TRACK_TINTS[trackKey], className)}
    >
      {short ? (
        <span>{trackKey}</span>
      ) : (
        <>
          <span className="max-md:hidden">{name}</span>
          <span className="md:hidden">{trackKey}</span>
        </>
      )}
    </Badge>
  )
}
