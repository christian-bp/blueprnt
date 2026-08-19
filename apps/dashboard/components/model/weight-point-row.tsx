"use client"

import { WEIGHT_POINT_VALUES } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { useTranslations } from "next-intl"

type WeightMeaningKey = `weightMeaning${1 | 2 | 3 | 4 | 5}`

// The 1-5 weight allocation for one criterion, as a joined row of five
// buttons. The only control anywhere for weight points (ADR-0004: 1-5 points
// under a fixed budget, never a free percentage), shared by every surface that
// weights a criterion so the semantics cannot drift between them.
//
// The buttons run 1 to 5, the direction every scale in this product reads: the
// evaluation scale, the anchor steps, and this row's own hover copy, which
// runs from "very low" to "very strong".
export function WeightPointRow({
  name,
  value,
  disabled,
  onChange,
}: {
  // The criterion this row weights; it names the group for assistive tech,
  // where a page holds one of these rows per criterion.
  name: string
  value: number
  // While the allocation is in flight: the row keeps its box and refuses input
  // rather than disappearing.
  disabled?: boolean
  onChange: (points: number) => void
}) {
  const t = useTranslations("dashboard.model.build")

  return (
    // Each weight button is its own hover trigger, so hovering (or focusing) a
    // single weight point reveals ONLY that point's meaning. Root/Trigger
    // (render) add no DOM and Content portals out, so the joined ButtonGroup
    // styling (which targets direct children) is unaffected.
    <ButtonGroup aria-label={t("setWeightPoints", { name })} className="w-full">
      {WEIGHT_POINT_VALUES.map((option) => {
        // Weight meanings are always the generic section 12.2 semantics
        // (getModel carries no per-criterion weighting text; decision 8).
        const meaning = t(`weightMeaning${option}` as WeightMeaningKey)
        return (
          <HoverCard
            key={option}
            // Keep the card open when you click to pick this weight point: the
            // button is its own trigger, so without this the press dismisses
            // the card and hover reopens it (a flicker). It still closes on
            // pointer-leave.
            onOpenChange={(nextOpen, eventDetails) => {
              if (
                !nextOpen &&
                (eventDetails.reason === "trigger-press" ||
                  eventDetails.reason === "outside-press")
              ) {
                eventDetails.cancel()
              }
            }}
          >
            <HoverCardTrigger
              delay={150}
              closeDelay={100}
              render={
                <Button
                  type="button"
                  size="sm"
                  variant={value === option ? "default" : "outline"}
                  disabled={disabled}
                  aria-pressed={value === option}
                  className="flex-1 px-0 tabular-nums"
                  onClick={() => onChange(option)}
                />
              }
            >
              {option}
            </HoverCardTrigger>
            <HoverCardContent align="center" className="w-72">
              <p className="text-muted-foreground text-sm">{meaning}</p>
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </ButtonGroup>
  )
}
