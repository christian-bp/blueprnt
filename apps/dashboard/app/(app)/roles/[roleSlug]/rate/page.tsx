"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeading } from "@/components/page-heading"
import { usePageTitle } from "@/hooks/use-page-title"
import { LockAssessmentPanel } from "@/components/rating/lock-assessment-panel"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"
import { UnlockAssessmentDialog } from "@/components/rating/unlock-assessment-dialog"
import { chapterHref } from "@/lib/model-chapters"

// Steps 1-5 are always per-criterion; the library leaves 2/4 undefined when
// it has nothing more specific to say than "a considered midpoint", and the
// model's shared midpoints copy fills exactly those gaps.
function resolveAnchors(
  criterion: { anchors: { step: number; text: string }[] },
  midpoints: { step2: string; step4: string }
): { step: number; text: string }[] {
  const byStep = new Map(
    criterion.anchors.map((anchor) => [anchor.step, anchor.text])
  )
  return [1, 2, 3, 4, 5].map((step) => {
    const text = byStep.get(step)
    if (text !== undefined) return { step, text }
    return { step, text: step === 2 ? midpoints.step2 : midpoints.step4 }
  })
}

export default function RatePage(props: {
  params: Promise<{ roleSlug: string }>
}) {
  const { roleSlug } = use(props.params)
  const t = useTranslations("dashboard.rating")
  const tDetail = useTranslations("dashboard.roles.detail")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRoleBySlug, {
    orgId,
    slug: roleSlug,
    locale,
  })
  // The rating read, not the model wire: an assessor is served the criteria and
  // their anchors without the weighting, so what they must not see is not in
  // the client at all rather than merely unrendered.
  const model = useQuery(api.evaluationModel.model.getRatingModel, {
    orgId,
    locale,
  })
  // Lock state (spec 2.4/6): fetched as soon as the role resolves, so it is
  // ready before either the reveal or the already-locked notice needs it.
  const result = useQuery(
    api.assessment.results.getRoleResult,
    role != null ? { orgId, roleId: role.roleId, locale } : "skip"
  )
  const [finished, setFinished] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  usePageTitle([role?.title, t("title")])

  if (role === undefined || model === undefined) {
    // Content-shaped loading state mirroring the stepper's layout: heading,
    // the step-progress line, then the criterion card with its 1-5 anchor
    // options and the nav row, so nothing reflows when the data arrives.
    return (
      <div className="space-y-4">
        {/* The heading's prefix is static i18n text; only the role title is
            data, so only it gets a bar. */}
        <PageHeading>
          <span className="flex items-center gap-2">
            {t("title")}:
            <Skeleton className="h-5 w-48 max-w-full" />
          </span>
        </PageHeading>
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-1.5 w-20 rounded-full" />
          </div>
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <Skeleton key={step} className="h-12 w-full rounded-md" />
                ))}
              </div>
              {/* The real nav buttons (static i18n chrome). Disabled is the
                  truthful state here, not a loading effect: the loaded
                  stepper opens with Back disabled on step 1 and Next
                  disabled until an anchor is picked. */}
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" disabled>
                  {t("backCta")}
                </Button>
                <Button type="button" disabled>
                  {t("nextCta")}
                  <Kbd
                    data-icon="inline-end"
                    aria-hidden="true"
                    className="translate-x-0.5"
                  >
                    ⏎
                  </Kbd>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  if (role === null || model === null) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{tDetail("notFound")}</p>
        <Link href="/roles" className="text-sm underline underline-offset-4">
          {tDetail("backToRoles")}
        </Link>
      </div>
    )
  }
  // The model must be approved before any role can be rated (ADR-0023): state
  // the precondition in words and send the admin to where it is resolved,
  // rather than letting setRating fail silently on the first save attempt.
  if (!model.approved) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {t("modelUnapprovedExplanation")}
        </p>
        {/* Resolved through the chapter registry rather than written out: the
            approve control lives in one chapter at a time, and a hardcoded
            path here is what made this link a dead end when it moved. */}
        <Link
          href={chapterHref("approval")}
          className="text-sm underline underline-offset-4"
        >
          {t("modelUnapprovedCta")}
        </Link>
      </div>
    )
  }
  // Locked or not ready to rate: state the precondition here and send the
  // user back to the role page where the controls live.
  if (role.archived || !role.profileComplete) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {role.profileComplete
            ? t("lockedExplanation")
            : tDetail("profileIncomplete")}
        </p>
        <Link
          href={`/roles/${role.slug}`}
          className="text-sm underline underline-offset-4"
        >
          {t("result.backToRole")}
        </Link>
      </div>
    )
  }

  // Lock state is not yet known: wait rather than flash the stepper (or the
  // stale ready-to-lock panel) for a role that turns out to already be
  // locked a moment later. `result` is only ever null for a garbage/missing
  // role id, which cannot happen here (getRoleBySlug above already resolved
  // this exact role), so null is treated the same as still-loading.
  if (result == null) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner aria-label={t("result.computing")} />
      </div>
    )
  }

  // Already locked, whether from before this visit or from just clicking
  // Lock below: the rate entry states it in words and shows the reveal as
  // confirmation (spec 2.4/6, lock-as-reveal), with Unlock as the explicit,
  // audited way back into editing. RatingResult is a pure reveal; this host
  // owns the surrounding nav (the onboarding host owns its own
  // back-to-your-roles button instead).
  if (result.locked) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("alreadyLockedExplanation")}
        </p>
        <RatingResult orgId={orgId} roleId={role.roleId} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setUnlockOpen(true)}
          >
            {t("unlockCta")}
          </Button>
          <Link
            href={`/roles/${role.slug}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("result.backToRole")}
          </Link>
        </div>
        <UnlockAssessmentDialog
          open={unlockOpen}
          onOpenChange={setUnlockOpen}
          orgId={orgId}
          roleId={role.roleId}
        />
      </div>
    )
  }

  // Every criterion answered but not yet locked: the completion state offers
  // the lock action itself; the branch above takes over as the reveal once
  // it succeeds (result.locked flips reactively).
  if (finished) {
    return (
      <div className="w-full max-w-2xl">
        <LockAssessmentPanel orgId={orgId} roleId={role.roleId} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeading>
        {t("title")}: {role.title}
      </PageHeading>
      <RatingStepper
        orgId={orgId}
        roleId={role.roleId}
        criteria={model.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          name: criterion.name,
          question: criterion.assessmentQuestion,
          measures: criterion.measures,
          notMeasures: criterion.notMeasures,
          dimensionKey: criterion.dimensionKey,
          anchors: resolveAnchors(criterion, model.midpoints),
        }))}
        ratings={role.ratings}
        onCompleted={() => setFinished(true)}
      />
    </div>
  )
}
