import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The quiet done-mark a sidebar chapter row wears once its work is finished:
// a small tick at the row's far end, in the ROW'S OWN ink (currentColor, so
// it follows foreground on the registry rows and muted on the run sidebar's
// children). Not a status color: four finished chapters are the ordinary
// state of a finished build, not an alert, and a colored tick per row turned
// the nav into a scoreboard. One component for both sidebars, so the two
// journeys' rows can never drift into different marks; the sr-only text is
// what a screen reader gets, since the tick alone is invisible to it.
export function NavDoneMark({ label }: { label: string }) {
  return (
    <span className="ms-auto flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
