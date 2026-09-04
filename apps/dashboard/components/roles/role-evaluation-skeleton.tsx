"use client"

import { LEVEL_COUNT, MODEL_MIN_CRITERIA } from "@workspace/core"
import { Accordion } from "@workspace/ui/components/accordion"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { AccordionSection } from "@/components/accordion-section"
import { BreakdownLabel } from "@/components/roles/role-criterion-breakdown"

// The evaluation card's body while its result is still loading, shaped like
// the completed state it becomes: the level line with its score, the level
// scale, and the per-criterion contribution rows.
//
// It exists because the page and the card load in sequence: the page's own
// skeleton clears when the role arrives, and the card then issues a SECOND
// query for the engine result. A one-line "deriving the result" sentence in
// that gap collapsed the rail to a fraction of its height and dropped the
// employee list a third of a screen when the result landed. Shared by the
// page skeleton and the card so the three states measure the same.
//
// The model's criteria count is known before the result is: the card is
// already told how many criteria the role is rated against, so the
// contribution list stands in at its real length rather than a guess. The
// fallback is the model's own minimum, for the page skeleton, which does
// not know the role yet.
const FALLBACK_ROWS = MODEL_MIN_CRITERIA

// The level line, shared with the loaded card. Its content decides its height
// three different ways: baseline alignment between a text-xl level and a
// text-sm score lands on a fractional 21.5px, an anchor role's help button
// pushes it to 24, and bars have no baseline to reproduce either. So the line
// is a fixed 24px slot in every state, and the baseline alignment inside it
// keeps the level and its score sitting on the same line.
export const LEVEL_LINE_CLASS =
  "flex h-6 flex-1 items-baseline justify-between gap-3"

export function RoleEvaluationSkeleton({
  criteriaCount,
  motivatedCount,
  anchorMotivation,
}: {
  criteriaCount?: number
  // How many criteria carry a motivation. The card knows it before the result
  // arrives (the role's own query returns its ratings), so the disclosure that
  // folds them away is reserved at its real size instead of appearing from
  // nowhere. Left out by the page's own skeleton, which runs before any of the
  // role is known: the row is reserved anyway, because a completed role almost
  // always carries at least one motivation, and the count stands in as a bar.
  motivatedCount?: number
  // An anchor role's motivation, which the card knows from the role's own
  // query. It prints under the level scale once the result lands, so a
  // loading state that left it out dropped everything below the card by the
  // height of a paragraph the moment the result arrived.
  anchorMotivation?: string | null
}) {
  const tAnchor = useTranslations("dashboard.roles.anchor")
  const tResult = useTranslations("dashboard.rating.result")
  const rows =
    criteriaCount !== undefined && criteriaCount > 0
      ? criteriaCount
      : FALLBACK_ROWS
  const knowsMotivations = motivatedCount !== undefined
  const showMotivations = !knowsMotivations || motivatedCount > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {/* The level line: the icon slot, the level itself, and the score on
            the right, each in the box its own type would occupy. */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <div className={LEVEL_LINE_CLASS}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {/* The level scale, at its real height and segment count so the
            band cannot change thickness when the level arrives. */}
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1).map(
            (segment) => (
              <Skeleton key={segment} className="h-1.5 flex-1 rounded-full" />
            )
          )}
        </div>
        {/* Real text, not a bar: the words are already known, and only the
            words themselves give the paragraph the right number of lines. */}
        {anchorMotivation !== undefined && anchorMotivation !== null && (
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">
              {`${tAnchor("motivationHeading")}: `}
            </span>
            {anchorMotivation}
          </p>
        )}
      </div>
      <div className="space-y-1">
        {/* The section's own label is static i18n text, so it renders for
            real, help button included: the shared component is what keeps
            the two states the same height. */}
        <BreakdownLabel />
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, index) => index).map((row) => (
            <div key={row} className="space-y-1">
              {/* The same h-5 line box the loaded row's text occupies. */}
              <div className="flex h-5 items-center justify-between gap-3">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        {/* The motivations disclosure, at its real width and count, standing
            open to nothing until the words arrive. Reserving it matters more
            than it looks: it is a 46px block at the very bottom of the
            card, so without it everything below the card jumps when a role
            with motivations resolves. */}
        {showMotivations && (
          <Accordion className="pt-1">
            <AccordionSection
              value="motivations"
              title={tResult("motivationsLabel")}
              meta={
                knowsMotivations ? (
                  motivatedCount
                ) : (
                  // Centred in the line box the count would occupy, so the
                  // bar cannot make the trigger a different height.
                  <span className="flex h-5 items-center">
                    <Skeleton className="h-3.5 w-3" />
                  </span>
                )
              }
            >
              <div className="space-y-3 pb-1">
                {Array.from({ length: motivatedCount ?? 2 }, (_, i) => i).map(
                  (row) => (
                    <div key={row} className="space-y-1">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )
                )}
              </div>
            </AccordionSection>
          </Accordion>
        )}
      </div>
    </div>
  )
}
