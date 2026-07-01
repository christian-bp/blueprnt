"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  AnchorIcon,
  MoreHorizontalIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { DeviationBadge } from "@/components/deviation-badge"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  type AnchorRoleInfo,
  AnchorDialog,
} from "@/components/roles/role-anchor-control"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// One card for the whole evaluation lifecycle. While incomplete it shows the
// progress and the entry into the blind stepper; once complete it shows the
// weighting, band, and per-criterion breakdown, with the anchor status inline
// and the two actions (adjust, manage anchor) in a header menu. The result view
// applies only to a live, fully-evaluated role: an archived role has left the
// results set, so it stays read-only.
export function RoleEvaluationCard({
  orgId,
  roleId,
  slug,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
  anchorRole,
  isAdmin,
}: {
  orgId: string
  roleId: Id<"roles">
  slug: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
  anchorRole: AnchorRoleInfo | null
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRoles = useTranslations("dashboard.roles")
  const tAnchor = useTranslations("dashboard.roles.anchor")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()

  const [anchorOpen, setAnchorOpen] = useState(false)

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })
  // The band-position scale needs the band count; only the result view uses it.
  const model = useQuery(
    api.evaluationModel.model.getModel,
    showResult ? { orgId, locale } : "skip"
  )
  const bandCount = model?.bandThresholds.length ?? 0
  // The band leads with the engine-computed outcome for every role (ADR-0002).
  // An anchor role additionally flags a deviation when its computed band
  // differs from the agreed band: the score is primary, the anchor is a sanity
  // check (matching the bands overview and the rating flow).
  const heroBand = result?.band ?? null
  const anchorDeviates =
    anchorRole !== null &&
    result?.band != null &&
    result.band !== anchorRole.expectedBand

  const ctaLabel = ratedCount === 0 ? t("rateCta") : t("resumeRateCta")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("evaluationHeading")}
          {showResult ? (
            <HelpMorphButton label={tHelp("scoreLabel")}>
              {tHelp("scoreBody")}
            </HelpMorphButton>
          ) : (
            <HelpMorphButton label={tHelp("blindRatingLabel")}>
              {tHelp("blindRatingBody")}
            </HelpMorphButton>
          )}
        </CardTitle>
        {showResult && result?.complete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("manageCta")}
                className="shrink-0"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/roles/${slug}/rate`}>{t("adjustRateCta")}</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={() => setAnchorOpen(true)}>
                  {anchorRole === null
                    ? tAnchor("designateCta")
                    : tAnchor("manageCta")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {showResult ? (
          result?.complete ? (
            <>
              {/* The band is the engine-computed outcome. An anchor role is
                  marked with the anchor icon + a help morph and, when its
                  computed band differs from the agreed band, a deviation flag
                  (the agreed band is the sanity check, not the headline); its
                  motivation shows below the scale. A normal role uses the tag
                  icon. The full-width scale marks the computed band in the
                  brand color (Band 1 = highest, per the help). */}
              <div className="space-y-2">
                {heroBand != null && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={anchorRole !== null ? AnchorIcon : Tag01Icon}
                      strokeWidth={2}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="flex flex-1 items-baseline justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-xl leading-none">
                          {`${tAssessment("band")} ${heroBand}`}
                        </span>
                        {anchorRole !== null && (
                          <HelpMorphButton label={tHelp("anchorRoleLabel")}>
                            {tHelp("anchorRoleBody")}
                          </HelpMorphButton>
                        )}
                        {anchorDeviates && anchorRole !== null && (
                          <DeviationBadge
                            agreedBand={anchorRole.expectedBand}
                          />
                        )}
                      </span>
                      {result.score != null && (
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {`${tResult("scoreLabel")} ${result.score}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {heroBand != null && bandCount > 0 && (
                  <div className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: bandCount }, (_, i) => i + 1).map(
                      (b) => (
                        <div
                          key={b}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            b === heroBand ? "bg-brand" : "bg-muted"
                          )}
                        />
                      )
                    )}
                  </div>
                )}
                {anchorRole?.motivation && (
                  <p className="text-muted-foreground text-sm">
                    <span className="font-medium text-foreground">
                      {`${tAnchor("motivationHeading")}: `}
                    </span>
                    {anchorRole.motivation}
                  </p>
                )}
              </div>
              <RoleCriterionBreakdown criteria={result.criteria} />
              {isAdmin && (
                <AnchorDialog
                  open={anchorOpen}
                  onOpenChange={setAnchorOpen}
                  orgId={orgId}
                  roleId={roleId}
                  anchorRole={anchorRole}
                />
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {tResult("computing")}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {evaluated ? tRoles("evaluated") : tRoles("notEvaluated")}
            </p>
            {!archived &&
              (profileComplete ? (
                <Button asChild>
                  <Link href={`/roles/${slug}/rate`}>{ctaLabel}</Link>
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("profileIncomplete")}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
