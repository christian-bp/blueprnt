"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"
import {
  AssessmentStatusBadge,
  CompletedIncompleteNotice,
  MethodDriftBadge,
} from "@/components/assessment-status"
import { DeviationBadge } from "@/components/deviation-badge"
import { ConfirmPlacementDialog } from "@/components/levels/confirm-placement-dialog"
import {
  AnchorDialog,
  type AnchorRoleInfo,
} from "@/components/roles/role-anchor-control"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { toast } from "@/lib/toast"
import {
  type CalibrationReason,
  calibrationReason,
} from "@/lib/calibration-queue"
import { useOrganization } from "@/components/org-context"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"
import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"
import { LevelBadge } from "@/components/level-badge"
import { TrackBadge } from "@/components/track-badge"

interface RoleSheetContextValue {
  openRole: (roleId: string) => void
}

const RoleSheetContext = createContext<RoleSheetContextValue | null>(null)

// Required reader: any surface that must open the sheet.
export function useRoleSheet(): RoleSheetContextValue {
  const value = useContext(RoleSheetContext)
  if (value === null) {
    throw new Error("useRoleSheet must be used inside RoleSheetProvider")
  }
  return value
}

// Optional reader: lets a component (RoleChip) work with or without a provider.
export function useRoleSheetOptional(): RoleSheetContextValue | null {
  return useContext(RoleSheetContext)
}

// Holds the open role and renders the single Sheet. `roleId` persists while the
// sheet animates closed (and after), so the body never blanks mid-slide and
// reopening the same role is instant; `open` alone drives visibility.
export function RoleSheetProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const openRole = useCallback((id: string) => {
    setRoleId(id)
    setOpen(true)
  }, [])

  return (
    <RoleSheetContext value={{ openRole }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        {roleId !== null && (
          <RoleSheetContent roleId={roleId} onClose={() => setOpen(false)} />
        )}
      </Sheet>
    </RoleSheetContext>
  )
}

function RoleSheetContent({
  roleId,
  onClose,
}: {
  roleId: string
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roleSheet")
  const tLevels = useTranslations("dashboard.levels")
  const tRoles = useTranslations("dashboard.roles")
  const tDetail = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const _tAssessment = useTranslations("assessment")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const tAnchor = useTranslations("dashboard.roles.anchor")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  // The anchor as a LIVE reference: null once it has been retired.
  const liveAnchor =
    role?.anchorRole != null && role.anchorRole.status !== "replaced"
      ? role.anchorRole
      : null

  // THE FLAG (masterdokument 14.8), read from the same fold the chip that
  // opened this sheet used, so the sheet can never disagree with the marker
  // the reader just clicked.
  const reason =
    result === undefined || result === null
      ? null
      : calibrationReason({
          completed: result.completed,
          level: result.level,
          calibrated: result.calibrated,
          methodDrift: result.methodDrift,
          profileLimited: result.profileLimited,
          // A RETIRED anchor is not a live reference, so it cannot deviate
          // from anything. getResults already drops a replaced anchor before
          // the ladder folds it; the sheet reads getRole, which keeps it, so
          // the same rule has to be applied here or a retired anchor would
          // flag in the sheet and nowhere else.
          anchor: liveAnchor,
        })

  // Function and team join into the subtitle, dropping empties so an unset
  // pair never renders as a stray "·" separator.
  const subtitle = role
    ? [role.function, role.team]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" · ")
    : ""

  return (
    <SheetContent>
      {role === undefined ? (
        <>
          <SheetTitle className="sr-only">{t("loading")}</SheetTitle>
          <div className="flex flex-1 items-center justify-center p-6">
            <Spinner aria-label={t("loading")} />
          </div>
        </>
      ) : role === null ? (
        <SheetHeader>
          <SheetTitle>{tDetail("notFound")}</SheetTitle>
        </SheetHeader>
      ) : (
        <>
          <SheetHeader>
            {/* Title and track sit on one line, matching the role detail
                header. The text-lg override is deliberate: the vendored
                SheetTitle inherits the content's text-sm, too small for the
                primary heading. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <SheetTitle className="text-lg">{role.title}</SheetTitle>
              <TrackBadge
                trackKey={role.trackKey}
                name={role.trackName}
                short
              />
              {/* Level sits with the title once the assessment is completed
                  (completion is the reveal, spec 2.4/6), matching the role page result
                  badge; the completed/drift badges ride alongside it. */}
              {result?.completed ? (
                <>
                  {/* The level only once there IS one: a criterion added
                      after completion leaves a completed role incomplete, and the
                      completion is still true even though nothing computes. The
                      completed chip stays either way, because saying nothing
                      about a completed assessment reads as "not evaluated". */}
                  {result.level !== null ? (
                    <LevelBadge level={result.level} />
                  ) : null}
                  <AssessmentStatusBadge calibrated={result.calibrated} />
                  {result.methodDrift ? <MethodDriftBadge /> : null}
                </>
              ) : null}
            </div>
            {subtitle.length > 0 ? (
              <SheetDescription>{subtitle}</SheetDescription>
            ) : (
              // Keep a description node for accessibility even when function
              // and team are unset, but render nothing visible.
              <SheetDescription className="sr-only">
                {role.title}
              </SheetDescription>
            )}
            {role.anchorRole !== null && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <HugeiconsIcon
                    icon={AnchorIcon}
                    size={12}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {tLevels("anchorLabel")}
                </span>
                {/* A retired anchor says so, and never wears the deviation
                    chip: "not level 8" is a live claim about a reference this
                    organization has stopped referring to. */}
                {role.anchorRole.status === "replaced" ? (
                  <Badge variant="outline">{tAnchor("statusReplaced")}</Badge>
                ) : (
                  result !== undefined &&
                  result !== null &&
                  result.level !== null &&
                  result.level !== role.anchorRole.expectedLevel && (
                    <DeviationBadge
                      agreedLevel={role.anchorRole.expectedLevel}
                    />
                  )
                )}
              </div>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {/* The job profile leads the sheet: it is what the reader came for;
                the evaluation result (level + breakdown) follows below. No
                heading: as the first section, the profile needs no label. */}
            <section className="space-y-4">
              {role.purpose.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("purpose")}
                  </p>
                  <p className="whitespace-pre-line text-sm">{role.purpose}</p>
                </div>
              )}
              {role.responsibilities.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("responsibilities")}
                  </p>
                  <ResponsibilitiesList value={role.responsibilities} />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {tModel("roleFamily")}
                </p>
                <p className="text-sm">{role.familyName ?? tFamily("none")}</p>
              </div>
            </section>

            {/* STATE-PRIORITISED. What this sheet leads with is whatever the
                role most needs from the reader.

                FLAGGED replaces the evaluation entirely: a role whose
                placement raises a question has one thing to say, and the
                weighting breakdown under it is what the reader would have to
                scroll past to reach the act. The act itself lives here now
                (14.8 asks for the flag and the act, never a list).

                Otherwise the sheet says only what the ladder row does not: the
                row already carries the level, the track and the flag, so an
                unflagged role adds its per-criterion contributions and nothing
                else. */}
            {result === undefined ? (
              <div className="flex justify-center py-4">
                <Spinner aria-label={t("loading")} />
              </div>
            ) : reason !== null && result !== null ? (
              <ReviewBlock
                orgId={orgId}
                roleId={roleId}
                title={role.title}
                slug={role.slug}
                reason={reason}
                failures={result.profileFailures ?? []}
                computedLevel={result.level}
                agreedLevel={role.anchorRole?.expectedLevel ?? null}
                anchorRole={liveAnchor}
                onClose={onClose}
              />
            ) : (
              <section className="space-y-3">
                {liveAnchor !== null && (
                  // Manage the anchor WHERE YOU SEE IT. The role page's own
                  // menu keeps its shortcut, but a reader who opened this
                  // sheet because they were looking at the ladder should not
                  // have to leave it to change an agreed level.
                  <AnchorManageRow
                    orgId={orgId}
                    roleId={roleId}
                    anchorRole={liveAnchor}
                  />
                )}
                {result?.completed &&
                result.complete &&
                result.level !== null ? (
                  <RoleCriterionBreakdown criteria={result.criteria} />
                ) : result?.completed ? (
                  // Completed but not readable: say so, instead of falling
                  // back to the "not yet evaluated" line an unrated role gets.
                  // The role WAS evaluated; a criterion arrived afterwards.
                  <CompletedIncompleteNotice />
                ) : (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                      {result?.complete
                        ? tLevels("readyToComplete")
                        : tRoles("notEvaluated")}
                    </p>
                    {!result?.complete && (
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {t("progress", {
                          rated: role.ratedCount,
                          total: role.totalCriteria,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          <SheetFooter>
            <Link
              href={`/roles/${role?.slug ?? ""}`}
              onClick={onClose}
              className={cn(buttonVariants())}
            >
              {t("openRole")}
            </Link>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}

// The review block: the reason in one sentence, then the act.
//
// Reason BEFORE act, which is the guidance law and also the only order that
// works here: "Confirm the placement" means nothing until the reader knows
// what capped it. The sentences are the ones the retired queue used, per
// class, so nothing about the three questions was re-worded when the surface
// moved.
//
// Each class gets the act that actually answers it. The capped placement is
// the only one with an act of its own (confirming it); an anchor deviation is
// answered by changing what the organization agreed, and a stale method by
// completing the assessment again.
function ReviewBlock({
  orgId,
  roleId,
  title,
  slug,
  reason,
  failures,
  computedLevel,
  agreedLevel,
  anchorRole,
  onClose,
}: {
  orgId: string
  roleId: string
  title: string
  slug: string
  reason: CalibrationReason
  failures: {
    criterionId: string
    name: string
    required: number
    actual: number
  }[]
  // The two levels the deviation sentence names: what the engine computed, and
  // what the organization agreed for this anchor.
  computedLevel: number | null
  agreedLevel: number | null
  anchorRole: AnchorRoleInfo | null
  onClose: () => void
}) {
  const t = useTranslations("dashboard.levels.calibration")
  const tAnchor = useTranslations("dashboard.roles.anchor")
  const [confirming, setConfirming] = useState(false)
  const [managing, setManaging] = useState(false)
  const [pending, setPending] = useState(false)
  const tToast = useTranslations("dashboard.toast")
  const updateAnchor = useMutation(api.assessment.anchorRoles.updateAnchorRole)

  // Both decisions are the SAME audited mutation the advanced form calls, with
  // one field each. Nothing here is a shortcut around the write path; what the
  // acts remove is the reader having to know which field to set.
  async function act(patch: { expectedLevel?: number; status?: "replaced" }) {
    if (pending) return
    setPending(true)
    try {
      await updateAnchor({ orgId, roleId: roleId as Id<"roles">, ...patch })
      toast.success(tToast("anchorUpdated"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      className={cn("space-y-3 rounded-xl border p-4", WARNING_ALERT_CLASS)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-foreground text-sm">
          {t(`class.${reason}`)}
        </h3>
      </div>
      {/* The reason, in words. Running text, so it floors at text-sm. */}
      <p className="text-foreground text-sm leading-relaxed">
        {reason === "profileLimited"
          ? t("profileLimitedReason")
          : reason === "anchorDeviation"
            ? t("anchorDeviationReason", {
                level: computedLevel ?? 0,
                expected: agreedLevel ?? 0,
              })
            : t("staleMethodReason")}
      </p>
      {failures.length > 0 && reason === "profileLimited" && (
        // WHICH requirement held the role back: the criterion by name, what
        // the zone asked of it, and what the role scored. Without these three
        // the sentence above is a verdict with no evidence.
        <ul className="flex flex-wrap gap-1">
          {failures.map((failure) => (
            <li key={failure.criterionId}>
              <Badge variant="outline" className="font-normal">
                {t("profileLimitedFailure", {
                  name: failure.name,
                  required: failure.required,
                  actual: failure.actual,
                })}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {reason === "anchorDeviation" ? (
        // A QUESTION MEETS ANSWERS, not a form.
        //
        // The deviation asks one thing: the assessment and the agreement
        // disagree, so which of them moves? A status select answers that in
        // bookkeeping vocabulary ("set status to Replaced"), which asks the
        // reader to translate a decision into a field value and then work out
        // what the field value does. The three answers are acts, each saying
        // what it will do before it is pressed.
        //
        // The full form survives as the advanced path below: fine control over
        // level, motivation and status is still reachable, it is just not the
        // front door to a review.
        <div className="space-y-2">
          <AnchorActRow
            label={tAnchor("alignCta", { level: computedLevel ?? 0 })}
            consequence={tAnchor("alignConsequence", {
              level: computedLevel ?? 0,
            })}
            pending={pending}
            onAct={() => act({ expectedLevel: computedLevel ?? 0 })}
          />
          <AnchorActRow
            label={t("rateCta")}
            consequence={tAnchor("reassessConsequence")}
            href={`/roles/${slug}/rate`}
            onNavigate={onClose}
          />
          <AnchorActRow
            label={tAnchor("retireCta")}
            consequence={tAnchor("retireConsequence")}
            pending={pending}
            onAct={() => act({ status: "replaced" })}
          />
          {/* The advanced path, deliberately quiet: a review never needs it. */}
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setManaging(true)}
            >
              {tAnchor("detailsCta")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {reason === "profileLimited" ? (
            <Button type="button" size="sm" onClick={() => setConfirming(true)}>
              {t("confirmCta")}
            </Button>
          ) : (
            <Link
              href={`/roles/${slug}/rate`}
              onClick={onClose}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("rateCta")}
            </Link>
          )}
        </div>
      )}
      {/* MOUNTED ONLY WHILE OPEN, and that is not a nicety.
          These are Base UI Dialog roots, and this block renders INSIDE an open
          Sheet, which is a dialog itself. Mounting them unconditionally put
          three dialog roots on the page at once, each running its own
          scroll-lock and focus-guard against the same <body>; they fight, and
          the page stops producing frames. Sync scripts still run, so it does
          not read as a busy CPU: what dies is rendering. No paint, no idle, no
          click ever handled, and every screenshot times out.
          A closed dialog has nothing to render, so there is no reason to mount
          one. */}
      {confirming && (
        <ConfirmPlacementDialog
          orgId={orgId}
          target={{ roleId: roleId as Id<"roles">, title }}
          onOpenChange={(open) => {
            if (!open) setConfirming(false)
          }}
        />
      )}
      {managing && (
        <AnchorDialog
          open
          onOpenChange={setManaging}
          orgId={orgId}
          roleId={roleId as Id<"roles">}
          anchorRole={anchorRole}
        />
      )}
    </section>
  )
}

// The anchor's own management, on the surface where the anchor is visible.
// The role page's actions menu keeps its shortcut; this is the one the reader
// reaches without leaving the ladder they were reading.
function AnchorManageRow({
  orgId,
  roleId,
  anchorRole,
}: {
  orgId: string
  roleId: string
  anchorRole: AnchorRoleInfo
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-sm">
          {`${t("expectedLevelLabel")}: ${t("levelOption", {
            level: anchorRole.expectedLevel,
          })}`}
        </p>
        {anchorRole.motivation.trim().length > 0 && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {anchorRole.motivation}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        {t("manageCta")}
      </Button>
      {/* Same rule: a dialog root inside an open Sheet only while it is
          actually open. See the note in ReviewBlock above. */}
      {open && (
        <AnchorDialog
          open
          onOpenChange={setOpen}
          orgId={orgId}
          roleId={roleId as Id<"roles">}
          anchorRole={anchorRole}
        />
      )}
    </div>
  )
}

// One answer to the review's question: the act, and what it will do, in that
// order. The consequence is not decoration — the whole reason the status
// select failed the reader is that pressing it told them nothing about what
// would happen (the consequence-before-act law).
function AnchorActRow({
  label,
  consequence,
  pending,
  onAct,
  href,
  onNavigate,
}: {
  label: string
  consequence: string
  pending?: boolean
  onAct?: () => void
  // A link act (re-evaluating happens on another route) rather than a mutation.
  href?: string
  onNavigate?: () => void
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-card p-3">
      {href === undefined ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={onAct}
        >
          {label}
        </Button>
      ) : (
        <Link
          href={href}
          onClick={onNavigate}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {label}
        </Link>
      )}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {consequence}
      </p>
    </div>
  )
}
