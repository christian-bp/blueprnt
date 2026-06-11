"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import Link from "next/link"

// The calibration panel on the results page: every non-replaced anchor role
// with its agreed band next to the live computed band (ADR-0002: computed at
// read time, never stored). A deviation between the two is the signal the
// anchor-role guide asks for: either the model drifted or the anchor needs a
// review, so the row is flagged instead of auto-corrected. The page owns the
// listAnchorRoles query (and gates its spinner on it) so this panel never
// pops in between already-visible content.
export interface AnchorRolesPanelRow {
  roleId: string
  title: string
  expectedBand: number
  computedBand: number | null
  status: "active" | "underReview" | "replaced"
}

export function AnchorRolesPanel({
  anchors,
}: {
  anchors: AnchorRolesPanelRow[]
}) {
  const t = useTranslations("dashboard.results.anchors")
  const tAnchor = useTranslations("dashboard.roles.anchor")

  // Replaced anchors are history, not calibration points; with no anchors at
  // all the panel disappears entirely (the concept is introduced on the role
  // page, not here).
  const visible = anchors.filter((anchor) => anchor.status !== "replaced")
  if (visible.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {visible.map((anchor) => (
            <li
              key={anchor.roleId}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/roles/${anchor.roleId}`}
                  className="truncate font-medium hover:underline"
                >
                  {anchor.title}
                </Link>
                {anchor.status === "underReview" && (
                  <Badge variant="secondary">
                    {tAnchor("statusUnderReview")}
                  </Badge>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    {t("expectedBand")}
                  </span>
                  <Badge variant="outline">{anchor.expectedBand}</Badge>
                </span>
                {/* Same convention as the results table: a null band (model
                    changed since designation) renders no badge at all. */}
                {anchor.computedBand !== null && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {t("computedBand")}
                    </span>
                    <Badge>{anchor.computedBand}</Badge>
                  </span>
                )}
                {anchor.computedBand !== null &&
                  anchor.computedBand !== anchor.expectedBand && (
                    <Badge variant="destructive">{t("mismatch")}</Badge>
                  )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
