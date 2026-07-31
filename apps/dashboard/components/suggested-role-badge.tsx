"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useTranslations } from "next-intl"

// The "Suggested" pill for a role assignment the AI proposed and HR has not
// confirmed yet (AI never auto-decides, ADR-0003). Shown wherever a person is
// listed under a role: the people register while narrowing by role, and the
// role page's employee list. Self-contained (own TooltipProvider, mirroring
// DeviationBadge) so it drops anywhere; the visible text is the short label,
// the tooltip and aria-label carry the explanation and where to confirm it.
export function SuggestedRoleBadge() {
  const t = useTranslations("dashboard.people")
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="outline"
              className="shrink-0 text-muted-foreground"
              aria-label={t("suggestedBadgeTooltip")}
            />
          }
        >
          {t("suggestedBadge")}
        </TooltipTrigger>
        <TooltipContent arrow>{t("suggestedBadgeTooltip")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
