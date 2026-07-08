"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useTranslations } from "next-intl"

// The anchor-deviation flag: a destructive "not Band {agreedBand}" pill whose
// tooltip explains that the engine-computed band differs from the agreed band.
// Shared by the bands overview, the role sheet, and the evaluation card so the
// signal reads identically everywhere. Self-contained (its own TooltipProvider)
// so it works wherever it is dropped, including a component rendered in
// isolation. The caller decides WHEN to render it (only when the computed band
// differs from the agreed band); the aria-label carries the full meaning for
// screen readers, the tooltip is the on-hover visual.
export function DeviationBadge({ agreedBand }: { agreedBand: number }) {
  const t = useTranslations("dashboard.bands")
  const label = t("deviationLabel", { band: agreedBand })
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<Badge variant="destructive" aria-label={label} />}
        >
          {t("deviation", { band: agreedBand })}
        </TooltipTrigger>
        <TooltipContent arrow>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
