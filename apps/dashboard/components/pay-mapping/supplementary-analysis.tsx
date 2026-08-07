"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Accordion } from "@workspace/ui/components/accordion"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { AccordionSection } from "@/components/accordion-section"
import { HelpMorphButton } from "@/components/help-morph-button"
import { type CrossLevelCase, CrossLevelCases } from "./cross-level-section"
import { EquivalentWorkLevelAnalysis } from "./equivalent-work-level-analysis"
import {
  GenderPureDeepDive,
  SingletonNote,
  WomenAheadGroups,
} from "./excluded-groups-sections"
import {
  type ExcludedGroupsWire,
  type GapGroup,
  meetsEntryConditions,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"

// The drawer's items, in fixed order. Cross-level leads: it is the only one
// whose finding is a structural warning sign, so it is the one a user should
// meet first even though none of them is counted (ADR-0015, Iteration 3
// decision 2).
const ITEMS = [
  "crossLevel",
  "levelAnalysis",
  "womenAhead",
  "genderPure",
  "singletons",
] as const

type ItemKey = (typeof ITEMS)[number]

// Rung 4 of the ladder: everything that does NOT affect completion, in one
// place, under a heading that says exactly that. Before this, five sections
// with five different expand controls sat above and below the checklist,
// and nothing on screen told the user which of them carried an obligation.
// One anatomy (AccordionSection), one open at a time, a count per item.
//
// The heading claims nothing about the LAW, only about the gate: a
// cross-level pair carries actions that belong to the statutory action plan
// under DL 3 kap. 13-14 §§, so "not required by law" would be false.
export function SupplementaryAnalysis({
  excluded,
  equivalentWork,
  equalWork,
  rows,
  crossLevelCases,
  currency,
  documentation,
  openItem,
  onOpenItemChange,
}: {
  excluded: ExcludedGroupsWire
  equivalentWork: GapGroup[]
  equalWork: GapGroup[]
  rows: PayMappingSnapshotRow[]
  // Passed in rather than derived here: the completion panel names the same
  // count at the moment of finishing, and the O(women x men) scan should
  // run once for the page, not once per consumer.
  crossLevelCases: CrossLevelCase[]
  currency: string
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
  // Controlled by the page so the checklist's search results can open and
  // scroll to an item; uncontrolled (closed) when omitted.
  openItem?: ItemKey | null
  onOpenItemChange?: (item: ItemKey | null) => void
}) {
  const t = useTranslations("dashboard.payMapping.supplementary")
  const tHelp = useTranslations("dashboard.help")
  const [ownOpen, setOwnOpen] = useState<ItemKey | null>(null)
  const open = openItem === undefined ? ownOpen : openItem
  const setOpen = onOpenItemChange ?? setOwnOpen

  const cases = crossLevelCases
  const levels = useMemo(
    () => equivalentWork.filter(meetsEntryConditions),
    [equivalentWork]
  )

  const counts: Record<ItemKey, number> = {
    crossLevel: cases.length,
    levelAnalysis: levels.length,
    womenAhead: excluded.reverse.length,
    genderPure: excluded.genderPure.length,
    singletons: excluded.singletonCount,
  }

  function body(item: ItemKey) {
    if (counts[item] === 0) {
      // An empty check states its result rather than vanishing: a section
      // that disappears leaves the user unsure whether it ran at all.
      return (
        <p className="text-muted-foreground text-sm">{t(`empty.${item}`)}</p>
      )
    }
    switch (item) {
      case "crossLevel":
        return (
          <CrossLevelCases
            cases={cases}
            currency={currency}
            {...(documentation === undefined ? {} : { documentation })}
          />
        )
      case "levelAnalysis":
        return (
          <EquivalentWorkLevelAnalysis
            equivalentWork={equivalentWork}
            equalWork={equalWork}
            rows={rows}
            currency={currency}
            {...(documentation === undefined ? {} : { documentation })}
          />
        )
      case "womenAhead":
        return <WomenAheadGroups excluded={excluded} currency={currency} />
      case "genderPure":
        return (
          <GenderPureDeepDive
            excluded={excluded}
            rows={rows}
            currency={currency}
            {...(documentation === undefined ? {} : { documentation })}
          />
        )
      default:
        return <SingletonNote />
    }
  }

  return (
    <section className="space-y-2 rounded-md border border-dashed px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-sm">{t("heading")}</h3>
        <HelpMorphButton label={tHelp("supplementaryLabel")}>
          {tHelp("supplementaryBody")}
        </HelpMorphButton>
      </div>
      <p className="text-muted-foreground text-sm">{t("lead")}</p>
      {/* Single-open: one thing at a time on every rung of the ladder. */}
      <Accordion
        value={open === null ? [] : [open]}
        onValueChange={(value) => setOpen((value[0] as ItemKey) ?? null)}
      >
        {ITEMS.map((item) => (
          <AccordionSection
            key={item}
            value={item}
            id={`supplementary-${item}`}
            title={t(`items.${item}`)}
            meta={
              <span
                className={
                  // A real cross-level finding is the one thing in here
                  // worth pulling the eye: brand ink whenever cases exist.
                  item === "crossLevel" && counts[item] > 0
                    ? "text-brand"
                    : undefined
                }
              >
                {counts[item]}
              </span>
            }
          >
            {body(item)}
          </AccordionSection>
        ))}
      </Accordion>
    </section>
  )
}

export type { ItemKey as SupplementaryItemKey }
export { ITEMS as SUPPLEMENTARY_ITEMS }
