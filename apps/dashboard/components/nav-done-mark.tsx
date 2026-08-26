import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The quiet done-mark a sidebar chapter row wears once its work is finished:
// a small tick in the success ink, at the row's far end. One component for
// the registry-driven inner nav and the run sidebar, so the two journeys'
// rows can never drift into different marks. Success ink rather than brand,
// because brand is the app's attention color and four finished chapters are
// the opposite of a notification; the sr-only text is what a screen reader
// gets, since the tick alone is invisible to it.
export function NavDoneMark({ label }: { label: string }) {
  return (
    <span className="ms-auto flex size-4 shrink-0 items-center justify-center text-success [&_svg]:size-3.5">
      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
