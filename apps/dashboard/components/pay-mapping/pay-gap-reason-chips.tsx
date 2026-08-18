"use client"

import type { PayGapReason } from "@workspace/constants"
import {
  PAY_GAP_REASON_GROUP_KEYS,
  PAY_GAP_REASON_GROUPS,
} from "@workspace/constants"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { OptionCard } from "@/components/option-card"

// The objective-reason taxonomy as toggleable chips, grouped by its own
// families (market, individual, and so on).
//
// Extracted from the group form because two surfaces now document a pay
// difference: equal work answers for the group as a whole (DL 3 kap. 8 § p2
// compares within one group), while equivalent work answers per comparison
// (p3 compares BETWEEN groups, and 3 kap. 9 § asks about each difference
// separately). Both must offer the identical taxonomy in the identical
// order, so the chips live in one place rather than being written twice.
//
// Presentational only: the caller owns the value, the saving and the
// reopen-on-edit discipline, which differ between the two surfaces.
export function PayGapReasonChips({
  reasons,
  disabled,
  onToggle,
  title,
}: {
  reasons: readonly PayGapReason[]
  disabled?: boolean
  onToggle: (reason: PayGapReason) => void
  // The heading above the chips. The group form passes its own "Objective
  // reasons" title; the comparison panel names the pair being explained, so
  // the reader can never be unsure which difference they are answering for.
  title: ReactNode
}) {
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tHelp = useTranslations("dashboard.help")

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {title}
        <HelpMorphButton label={tHelp("payGapReasonsLabel")}>
          {tHelp("payGapReasonsBody")}
        </HelpMorphButton>
      </div>
      {PAY_GAP_REASON_GROUP_KEYS.map((group) => (
        <div key={group} className="space-y-1.5">
          <p className="text-muted-foreground text-xs">
            {tReasons(`groups.${group}`)}
          </p>
          <div className="flex flex-wrap gap-3">
            {PAY_GAP_REASON_GROUPS[group].map((reason) => (
              <OptionCard
                key={reason}
                size="sm"
                title={tReasons(reason)}
                selected={reasons.includes(reason)}
                disabled={disabled}
                onSelect={() => onToggle(reason)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
