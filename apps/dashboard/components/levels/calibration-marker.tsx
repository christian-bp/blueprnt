"use client"

import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import { MethodDriftBadge } from "@/components/assessment-status"
import { DeviationBadge } from "@/components/deviation-badge"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import type { CalibrationReason } from "@/lib/calibration-queue"

// The border a flagged role's chip wears.
//
// Warning tone, never brand: brand on this page belongs to the level a role
// landed on, and this is an alert to act on rather than a judgement of the
// role. The tone comes from the app's one warning definition (lib/alert-tone),
// so the six surfaces with something amber to say cannot drift into six ambers.
//
// NEVER COLOUR ALONE. Every flagged chip also carries a text marker below, so
// the state survives greyscale, print, and a reader who cannot separate the two
// hues; the border is the fast channel that makes the chip findable in a
// ladder, not the thing that carries the meaning.
export const CALIBRATION_CHIP_CLASS = WARNING_ALERT_CLASS

// The marker itself, one per class, so a reader can tell WHICH of three
// questions the role raises without opening it.
//
// Two of the three already had a marker in the app and keep it: the anchor
// deviation says which level was agreed, and the method drift says the method
// moved. Only the capped placement needed one, because it had never been shown
// anywhere except in the list that has now gone.
export function CalibrationMarker({
  reason,
  agreedLevel,
}: {
  reason: CalibrationReason
  // Only read for `anchorDeviation`, where the marker names the agreed level.
  agreedLevel?: number | null
}) {
  const t = useTranslations("dashboard.levels.calibration")
  if (reason === "anchorDeviation") {
    return agreedLevel === null || agreedLevel === undefined ? null : (
      <DeviationBadge agreedLevel={agreedLevel} />
    )
  }
  if (reason === "staleMethod") return <MethodDriftBadge />
  return (
    <Badge variant="outline" className={WARNING_ALERT_CLASS}>
      {t("cappedMarker")}
    </Badge>
  )
}
