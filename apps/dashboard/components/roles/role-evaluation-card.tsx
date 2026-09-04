"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { LEVEL_COUNT } from "@workspace/core"
import {
  AnchorIcon,
  InformationCircleIcon,
  MoreVerticalIcon,
  Stairs01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { buttonVariants } from "@workspace/ui/components/button"
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
  CalibratedBadge,
  CompletedIncompleteNotice,
  MethodDriftBadge,
} from "@/components/assessment-status"
import { DeviationBadge } from "@/components/deviation-badge"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  type AnchorRoleInfo,
  AnchorDialog,
} from "@/components/roles/role-anchor-control"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"
import {
  LEVEL_LINE_CLASS,
  RoleEvaluationSkeleton,
} from "@/components/roles/role-evaluation-skeleton"
import { useReopenAssessment } from "@/hooks/use-reopen-assessment"
import { ActionsMenuTrigger } from "@/components/actions-menu-trigger"

// One card for the whole evaluation lifecycle, in three states (completion is
// the reveal, spec 2.4/6): not fully rated (progress + stepper entry), rated
// but not completed (where the card says what is left and points into the
// flow that ends it), and completed (weighting, level, and per-criterion
// breakdown, with the anchor status inline and the header menu). An archived
// role has left
// the results set (deriveResults excludes it), so it stays read-only
// regardless of any completion state it carries.
export function RoleEvaluationCard({
  orgId,
  roleId,
  slug,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
  motivatedCount,
  anchorRole,
}: {
  orgId: string
  roleId: Id<"roles">
  slug: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
  // How many of the role's ratings carry a motivation, from the role's own
  // query. The result query is the one still in flight, so this is what lets
  // the loading state reserve the disclosure that folds them away.
  motivatedCount: number
  anchorRole: AnchorRoleInfo | null
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
  const { reopen, pending: reopenPending } = useReopenAssessment(orgId, roleId)

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data. `showResult` means "past the in-progress stepper
  // state", covering BOTH rated-not-completed and completed; which of those
  // two is decided below once `result` (query-based; it is not a prop)
  // resolves.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })
  const completed = result?.completed ?? false
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

  // The way into the assessment, in the frame's foot where every surface in
  // the app keeps its primary action. A state with nothing to press passes
  // no footer at all, so an empty foot never holds its height.
  // Right-aligned in its own row: FrameFooter is a column, so a bare link
  // stretches to the frame's full width and reads as a banner rather than
  // as the action every other foot in the app puts on the right.
  const rateLink = (label: string) => (
    <div className="flex justify-end">
      <Link
        href={`/roles/${slug}/rate`}
        className={cn(buttonVariants({ size: "sm" }))}
      >
        {label}
      </Link>
    </div>
  )
  const footer = showResult
    ? result != null && !completed
      ? rateLink(tRating("openAssessmentCta"))
      : undefined
    : !archived && profileComplete
      ? rateLink(ctaLabel)
      : undefined
  // The missing job profile is stated as an Alert, which is already a
  // bounded object: it stands on the frame's ground as its own panel rather
  // than inside one.
  const profileGate = !showResult && !archived && !profileComplete

  const badges = (
    <>
      <CalibratedBadge calibrated={result?.calibrated ?? false} />
      {result?.methodDrift ? <MethodDriftBadge /> : null}
      {showResult && completed ? (
        <HelpMorphButton label={tHelp("scoreLabel")}>
          {tHelp("scoreBody")}
        </HelpMorphButton>
      ) : (
        <HelpMorphButton label={tHelp("blindRatingLabel")}>
          {tHelp("blindRatingBody")}
        </HelpMorphButton>
      )}
    </>
  )

  // The menu is page chrome, not data: it renders while the result loads too,
  // because it is the tallest thing in the header and holding it back made the
  // whole card 4px shorter until the result arrived. Its items follow
  // `completed`, which reads false in that window, so the one it offers
  // (adjust the ratings) is valid in every state it can be pressed in.
  const toolbar = showResult ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ActionsMenuTrigger
            // icon-sm, not icon: a 32px control sets a frame header's
            // height on its own, which reads as a taller bar than every
            // other frame.
            size="icon-sm"
            aria-label={t("manageCta")}
          />
        }
      >
        <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {completed ? (
          // Not destructive, and no confirm: reopening keeps every
          // rating and is undone by completing again from the flow's
          // last step. The result it hides is derived, never stored
          // (ADR-0002), so there is nothing here to lose.
          <DropdownMenuItem
            disabled={reopenPending}
            onClick={() => void reopen()}
          >
            {tRating("reopenCta")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem render={<Link href={`/roles/${slug}/rate`} />}>
            {t("adjustRateCta")}
          </DropdownMenuItem>
        )}
        {/* An anchor role must be a completed reference (completion is the
              reveal): the backend refuses designate/update on an uncompleted
              role, so the affordance stays hidden for a rated-but-uncompleted
              role rather than opening a dialog whose submit always fails. */}
        {completed && (
          <DropdownMenuItem onClick={() => setAnchorOpen(true)}>
            {anchorRole === null
              ? tAnchor("designateCta")
              : tAnchor("manageCta")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : undefined

  return (
    <>
      <FrameCard
        title={t("evaluationHeading")}
        titleLevel="h2"
        size="lg"
        extra={badges}
        toolbar={toolbar}
        footer={footer}
      >
        {profileGate ? (
          // Preconditions in words (guidance convention): a role cannot be
          // evaluated until its job profile has a purpose and
          // responsibilities, so the missing step is an alert with focus,
          // not a quiet line.
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>{t("profileIncompleteTitle")}</AlertTitle>
            <AlertDescription>{t("profileIncomplete")}</AlertDescription>
          </Alert>
        ) : (
          <FrameCardSection className="space-y-6">
            {showResult ? (
              result == null ? (
                // The card's own second query: shaped like the completed
                // body it becomes, so the rail keeps its height and the
                // list below it does not move when the result lands.
                <RoleEvaluationSkeleton
                  criteriaCount={totalCriteria}
                  motivatedCount={motivatedCount}
                  anchorMotivation={anchorRole?.motivation ?? null}
                />
              ) : completed ? (
                result.complete ? (
                  <>
                    {/* The level is the engine-computed outcome. An anchor
                        role is marked with the anchor icon + a help morph
                        and, when its computed level differs from the agreed
                        level, a deviation flag (the agreed level is the
                        sanity check, not the headline); its motivation shows
                        below the scale. A normal role uses the tag icon. The
                        full-width scale marks the computed level in the brand
                        color (Level 1 = highest, per the help). */}
                    <div className="space-y-2">
                      {heroLevel != null && (
                        <div className="flex items-center gap-2">
                          <HugeiconsIcon
                            icon={
                              anchorRole !== null ? AnchorIcon : Stairs01Icon
                            }
                            strokeWidth={2}
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <div className={LEVEL_LINE_CLASS}>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold text-xl leading-none">
                                {tAssessment("levelNumbered", {
                                  level: heroLevel,
                                })}
                              </span>
                              {anchorRole !== null && (
                                <HelpMorphButton
                                  label={tHelp("anchorRoleLabel")}
                                >
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
                      {heroLevel != null && (
                        <div className="flex gap-1" aria-hidden="true">
                          {Array.from(
                            { length: LEVEL_COUNT },
                            (_, i) => i + 1
                          ).map((b) => (
                            <div
                              key={b}
                              className={cn(
                                "h-1.5 flex-1 rounded-full",
                                b === heroLevel ? "bg-brand" : "bg-muted"
                              )}
                            />
                          ))}
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
                  <CompletedIncompleteNotice />
                )
              ) : (
                // Rated, not completed (an assessment reopened for re-evaluation
                // is the ordinary way here). The ACT is not offered from this
                // card: completing is the assessment flow's own ending, and an
                // errand that finished an assessment from outside it was exactly
                // the second trip decision 14 removed.
                //
                // So the control says what it DOES. It carried the act's own label
                // for a while and only navigated, which promised a press that
                // completes and delivered a press that opens a screen where an
                // identically labelled button completes: one press more than the
                // retired panel, wearing a label that said otherwise. And the
                // sentence states what is LEFT, which is what this card owes the
                // reader; the shared completeExplanation said only what completing
                // does, which reads as a definition with no subject once it is not
                // sitting on the button that performs it.
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tRating("readyToCompleteExplanation")}
                </p>
              )
            ) : (
              <p className="text-muted-foreground text-sm">
                {evaluated ? tRoles("evaluated") : tRoles("notEvaluated")}
              </p>
            )}
          </FrameCardSection>
        )}
      </FrameCard>
      <AnchorDialog
        open={anchorOpen}
        onOpenChange={setAnchorOpen}
        orgId={orgId}
        roleId={roleId}
        anchorRole={anchorRole}
      />
    </>
  )
}
