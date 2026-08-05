"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useTranslations } from "next-intl"

// The anchor-deviation flag: a destructive "not Level {agreedLevel}" pill whose
// tooltip explains that the engine-computed level differs from the agreed
// level. Shared by the levels overview, the role sheet, and the evaluation
// card so the signal reads identically everywhere. Self-contained (its own
// TooltipProvider) so it works wherever it is dropped, including a component
// rendered in isolation. The caller decides WHEN to render it (only when the
// computed level differs from the agreed level); the aria-label carries the
// full meaning for screen readers, the tooltip is the on-hover visual.
export function DeviationBadge({ agreedLevel }: { agreedLevel: number }) {
  const t = useTranslations("dashboard.levels")
  const label = t("deviationLabel", { level: agreedLevel })
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<Badge variant="destructive" aria-label={label} />}
        >
          {t("deviation", { level: agreedLevel })}
        </TooltipTrigger>
        <TooltipContent arrow>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
