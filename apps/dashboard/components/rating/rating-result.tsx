"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { SPRING } from "@/lib/motion"

// The reveal step after the last criterion: the FIRST place score and band
// outcome become visible (assessment glossary blindness). Live query: the
// result derives from current model + ratings, nothing is stored.
export function RatingResult({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.rating.result")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })
  // Anchor-role comparison AFTER the ordinary assessment (the guide's order:
  // criteria first, anchors as a sanity check afterwards). Active anchors
  // only; the rated role itself may appear, in which case the row reads as
  // its own calibration point. The spinner gate below waits for this query
  // too, so the comparison renders with the reveal instead of popping in
  // under the band a beat later (layout-shift rule).
  const anchors = useQuery(api.assessment.anchorRoles.listAnchorRoles, {
    orgId,
  })

  if (
    result === undefined ||
    anchors === undefined ||
    result === null ||
    !result.complete
  ) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("computing")} />
      </main>
    )
  }

  const activeAnchors = anchors.filter((anchor) => anchor.status === "active")
  // The guide's manual-validation principle: when the result lands two or
  // more bands from EVERY anchor, the comparison is too uncertain to support
  // the score and the reveal asks for a manual check.
  const nearestDistance =
    result.band !== null && activeAnchors.length > 0
      ? Math.min(
          ...activeAnchors.map((anchor) =>
            Math.abs(anchor.expectedBand - (result.band ?? 0))
          )
        )
      : null

  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("heading")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-8">
              <div>
                <p className="text-muted-foreground text-sm">
                  {t("scoreLabel")}
                </p>
                <p className="font-semibold text-4xl tabular-nums">
                  {t("scoreOutOf", { score: result.score ?? 0 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  {t("bandLabel")}
                </p>
                <Badge className="text-base">{result.band}</Badge>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{t("bandHighest")}</p>
            {activeAnchors.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  {t("anchorsHeading")}
                </p>
                <ul className="space-y-1">
                  {activeAnchors.map((anchor) => (
                    <li
                      key={anchor.roleId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">{anchor.title}</span>
                      <Badge variant="outline">
                        {t("anchorBand", { band: anchor.expectedBand })}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {nearestDistance !== null && nearestDistance >= 2 && (
                  <p className="text-muted-foreground text-sm">
                    {t("farFromAnchors")}
                  </p>
                )}
              </div>
            )}
            <Button asChild>
              <Link href={`/roles/${roleId}`}>{t("backToRole")}</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
