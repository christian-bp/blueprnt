"use client"

import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { type ReactNode, useEffect, useState } from "react"

// The percentage is derived in this one place so no caller recomputes (and
// potentially diverges from) the same math. A non-positive total reads as
// "not started" (0%) rather than dividing by zero.
function percentOf(done: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)))
}

// The shared "we are working, here is how far" screen: a status row (a
// decorative spinner and a label on the left, the count in its own
// right-aligned slot on the right) above a Progress bar. The anatomy comes
// from the people import screen, the one call site that reasoned through two
// properties worth keeping everywhere this pattern appears: the count's own
// slot means its appearance, or its width changing as the digits climb,
// shifts nothing else on the row; tabular-nums keeps those digits from
// jiggling while they count up.
//
// An optional heading-styled label and a muted description paragraph let a
// wizard phase (onboarding, the role import) carry its own headline and
// explanation through the same anatomy, instead of a second, private layout
// bolted onto the bar.
export function WizardProgress({
  done,
  total,
  label,
  heading = false,
  description,
  countLabel,
  accent = false,
  testId,
  className,
}: {
  // The numerator/denominator driving the bar.
  done: number
  total: number
  // Status text beside the spinner; also the Progress element's accessible
  // name, since the spinner itself carries no name of its own (decorative).
  label: string
  // Renders the label with heading emphasis instead of the default muted
  // status style, for a phase that needs its own headline (onboarding, role
  // import) rather than a plain working-status line.
  heading?: boolean
  // Optional muted paragraph under the status row.
  description?: string
  // The right-slot "{done} of {total} ..." text, already localized by the
  // caller. Left empty while there is nothing real to report yet; the slot
  // stays reserved either way so nothing shifts once it appears.
  // A node, not a string: a live count renders through NumberFlow, so the
  // caller passes the rendered rich message rather than a formatted string.
  countLabel?: ReactNode
  // Brand-accented bar and spinner, both together: one flag cannot express
  // "bar branded, spinner not" or vice versa, and the two pre-extraction
  // implementations disagreed on which piece to brand (the people import
  // branded its spinner and left the bar neutral; onboarding and the role
  // import branded the bar and left the spinner plain). Defaults to false:
  // the standing rule this codebase already documented at the onboarding
  // call site is that the drafting bar earns the accent because it matches
  // this phase's own heading, and "other progress bars stay neutral"
  // otherwise. Onboarding and the role import opt in; the people import,
  // which has no such heading to match, takes the neutral default.
  accent?: boolean
  // Base test id for the Progress element; the count slot reuses it with a
  // "-count" suffix, so a caller asserting on these ids keeps working
  // unchanged.
  testId?: string
  className?: string
}) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    // The source counts are monotonic in every current caller (a live import
    // query, a role count derived from listRoles); the max is a safety net so
    // the bar can never move backwards.
    setPct((current) => Math.max(current, percentOf(done, total)))
  }, [done, total])

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Decorative: the Progress element carries the accessible state. */}
          <Spinner aria-hidden="true" className={cn(accent && "text-brand")} />
          <span
            className={
              heading
                ? "font-medium text-base"
                : "text-muted-foreground text-sm"
            }
          >
            {label}
          </span>
        </div>
        <p
          className="text-muted-foreground text-sm tabular-nums"
          data-testid={testId ? `${testId}-count` : undefined}
        >
          {countLabel}
        </p>
      </div>
      {description !== undefined && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
      <Progress
        value={pct}
        aria-label={label}
        data-testid={testId}
        className={cn(accent && "[&>[data-slot=progress-indicator]]:bg-brand")}
      />
    </div>
  )
}
