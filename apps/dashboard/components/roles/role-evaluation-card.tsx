"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  AnchorIcon,
  InformationCircleIcon,
  MoreHorizontalIcon,
  Stairs01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import {
  LockedBadge,
  MethodDriftBadge,
} from "@/components/assessment-lock-badges"
import { DeviationBadge } from "@/components/deviation-badge"
import { HelpMorphButton } from "@/components/help-morph-button"
import { LockAssessmentPanel } from "@/components/rating/lock-assessment-panel"
import { UnlockAssessmentDialog } from "@/components/rating/unlock-assessment-dialog"
import {
  type AnchorRoleInfo,
  AnchorDialog,
} from "@/components/roles/role-anchor-control"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// One card for the whole evaluation lifecycle, now three states instead of
// two (lock-as-reveal, spec 2.4/6): incomplete (progress + stepper entry),
// complete-but-unlocked ("ready to lock", the Lock action itself is the
// reveal), and locked (weighting, level, and per-criterion breakdown, with
// the anchor status inline and the header menu). An archived role has left
// the results set (deriveResults excludes it), so it stays read-only
// regardless of any lock state it carries.
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
  const tRating = useTranslations("dashboard.rating")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()

  const [anchorOpen, setAnchorOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data. `showResult` means "past the in-progress stepper
  // state", covering BOTH ready-to-lock and locked; which of those two is
  // decided below once `result` (query-based; lock state is not a prop)
  // resolves.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })
  const locked = result?.locked ?? false
  // The level-position scale needs the level count; only the locked view uses it.
  const model = useQuery(
    api.evaluationModel.model.getModel,
    showResult && locked ? { orgId, locale } : "skip"
  )
  const levelCount = model?.levelRules.length ?? 0
  // The level leads with the engine-computed outcome for every role (ADR-0002).
  // An anchor role additionally flags a deviation when its computed level
  // differs from the agreed level: the score is primary, the anchor is a
  // sanity check (matching the levels overview and the rating flow).
  const heroLevel = result?.level ?? null
  const anchorDeviates =
    anchorRole !== null &&
    result?.level != null &&
    result.level !== anchorRole.expectedLevel

  const ctaLabel = ratedCount === 0 ? t("rateCta") : t("resumeRateCta")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("evaluationHeading")}
          {locked && <LockedBadge />}
          {result?.methodDrift && <MethodDriftBadge />}
          {showResult && locked ? (
            <HelpMorphButton label={tHelp("scoreLabel")}>
              {tHelp("scoreBody")}
            </HelpMorphButton>
          ) : (
            <HelpMorphButton label={tHelp("blindRatingLabel")}>
              {tHelp("blindRatingBody")}
            </HelpMorphButton>
          )}
        </CardTitle>
        {showResult && result != null && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("manageCta")}
                  className="shrink-0"
                />
              }
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {locked ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setUnlockOpen(true)}
                >
                  {tRating("unlockCta")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  render={<Link href={`/roles/${slug}/rate`} />}
                >
                  {t("adjustRateCta")}
                </DropdownMenuItem>
              )}
              {/* An anchor role must be a locked reference (lock-as-reveal):
                  the backend refuses designate/update on an unlocked role,
                  so the affordance stays hidden for a complete-but-unlocked
                  role rather than opening a dialog whose submit always fails. */}
              {isAdmin && locked && (
                <DropdownMenuItem onClick={() => setAnchorOpen(true)}>
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
          result == null ? (
            <p className="text-muted-foreground text-sm">
              {tResult("computing")}
            </p>
          ) : locked ? (
            result.complete ? (
              <>
                {/* The level is the engine-computed outcome. An anchor role is
                    marked with the anchor icon + a help morph and, when its
                    computed level differs from the agreed level, a deviation
                    flag (the agreed level is the sanity check, not the
                    headline); its motivation shows below the scale. A normal
                    role uses the tag icon. The full-width scale marks the
                    computed level in the brand color (Level 1 = highest, per
                    the help). */}
                <div className="space-y-2">
                  {heroLevel != null && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={anchorRole !== null ? AnchorIcon : Stairs01Icon}
                        strokeWidth={2}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <div className="flex flex-1 items-baseline justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold text-xl leading-none">
                            {tAssessment("levelNumbered", { level: heroLevel })}
                          </span>
                          {anchorRole !== null && (
                            <HelpMorphButton label={tHelp("anchorRoleLabel")}>
                              {tHelp("anchorRoleBody")}
                            </HelpMorphButton>
                          )}
                          {anchorDeviates && anchorRole !== null && (
                            <DeviationBadge
                              agreedLevel={anchorRole.expectedLevel}
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
                  {heroLevel != null && levelCount > 0 && (
                    <div className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: levelCount }, (_, i) => i + 1).map(
                        (b) => (
                          <div
                            key={b}
                            className={cn(
                              "h-1.5 flex-1 rounded-full",
                              b === heroLevel ? "bg-brand" : "bg-muted"
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
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tResult("computing")}
              </p>
            )
          ) : (
            <LockAssessmentPanel orgId={orgId} roleId={roleId} />
          )
        ) : !archived && !profileComplete ? (
          // Preconditions in words (guidance convention): a role cannot be
          // evaluated until its job profile has a purpose and responsibilities,
          // so the missing step is an alert with focus, not a quiet line.
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>{t("profileIncompleteTitle")}</AlertTitle>
            <AlertDescription>{t("profileIncomplete")}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {evaluated ? tRoles("evaluated") : tRoles("notEvaluated")}
            </p>
            {!archived && profileComplete && (
              <Link
                href={`/roles/${slug}/rate`}
                className={cn(buttonVariants())}
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        )}
      </CardContent>
      {isAdmin && (
        <AnchorDialog
          open={anchorOpen}
          onOpenChange={setAnchorOpen}
          orgId={orgId}
          roleId={roleId}
          anchorRole={anchorRole}
        />
      )}
      <UnlockAssessmentDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        orgId={orgId}
        roleId={roleId}
      />
    </Card>
  )
}
