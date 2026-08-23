"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
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
import {
  CalibratedBadge,
  LockedBadge,
  LockedIncompleteNotice,
  MethodDriftBadge,
} from "@/components/assessment-status"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// The reveal step after the last criterion: the FIRST place score and level
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
  const tHelp = useTranslations("dashboard.help")
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
  // under the level a beat later (layout-shift rule).
  const anchors = useQuery(api.assessment.anchorRoles.listAnchorRoles, {
    orgId,
  })

  // Locking is the reveal (spec 2.4/6): this component only ever renders
  // AFTER a successful lock (rate/page.tsx) or for a role that arrives
  // already locked, so it waits on `locked`, not merely `complete` (a
  // complete-but-unlocked role's score/level/zone read null on the wire).
  if (
    result === undefined ||
    anchors === undefined ||
    result === null ||
    !result.locked
  ) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("computing")} />
      </main>
    )
  }

  // `locked` alone is not enough: a criterion added after the lock leaves a
  // locked role incomplete again, reading back as complete=false, score=null,
  // level=null while locked stays true (results.ts). `score ?? 0` would print
  // a dishonest "0 / 100" for a result that was never computed. Nothing is in
  // flight in that state either, so it is a message, not a spinner: the
  // spinner spun forever and told the reader to keep waiting for a
  // computation that will not start until the new criterion is rated.
  if (!result.complete || result.level === null) {
    return (
      <main className="w-full max-w-2xl">
        <LockedIncompleteNotice />
      </main>
    )
  }

  const activeAnchors = anchors.filter((anchor) => anchor.status === "active")
  // The guide's manual-validation principle: when the result lands two or
  // more levels from EVERY anchor, the comparison is too uncertain to support
  // the score and the reveal asks for a manual check.
  const nearestDistance =
    result.level !== null && activeAnchors.length > 0
      ? Math.min(
          ...activeAnchors.map((anchor) =>
            Math.abs(anchor.expectedLevel - (result.level ?? 0))
          )
        )
      : null

  return (
    <div className="w-full max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("heading")}
              {/* The same status vocabulary the role page and the sheet use.
                  The reveal is where a result is read most closely, so a role
                  rated under a superseded method has to say so here too. */}
              <LockedBadge />
              {result.calibrated ? <CalibratedBadge /> : null}
              {result.methodDrift ? <MethodDriftBadge /> : null}
              <HelpMorphButton label={tHelp("scoreLabel")}>
                {tHelp("scoreBody")}
              </HelpMorphButton>
            </CardTitle>
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
                  {t("levelLabel")}
                </p>
                <Badge className="text-base">{result.level}</Badge>
              </div>
            </div>
            {activeAnchors.length > 0 && (
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  {t("anchorsHeading")}
                  <HelpMorphButton label={tHelp("anchorRoleLabel")}>
                    {tHelp("anchorRoleBody")}
                  </HelpMorphButton>
                </span>
                <ul className="space-y-1">
                  {activeAnchors.map((anchor) => (
                    <li
                      key={anchor.roleId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">{anchor.title}</span>
                      <Badge variant="outline">
                        {t("anchorLevel", { level: anchor.expectedLevel })}
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
