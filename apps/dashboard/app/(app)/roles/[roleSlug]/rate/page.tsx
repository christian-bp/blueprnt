"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { useOrganization } from "@/components/org-context"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { StageEyebrow } from "@/components/stage-eyebrow"
import { RATE_COLUMN } from "@/lib/rate-column"
import { usePageTitle } from "@/hooks/use-page-title"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"
import { ReopenAssessmentButton } from "@/components/rating/reopen-assessment-button"
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
  const tNav = useTranslations("dashboard.nav")
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
  // Completion state (spec 2.4/6): fetched as soon as the role resolves, so it
  // is ready before either the reveal or the already-completed notice needs
  // it.
  const result = useQuery(
    api.assessment.results.getRoleResult,
    role != null ? { orgId, roleId: role.roleId, locale } : "skip"
  )
  usePageTitle([role?.title, t("title")])

  if (role === undefined || model === undefined) {
    // Content-shaped loading state mirroring the stepper's layout: heading,
    // the step-progress line, then the criterion card with its 1-5 anchor
    // options and the nav row, so nothing reflows when the data arrives.
    return (
      <div className={RATE_COLUMN}>
        {/* The ancestor crumbs are static i18n text; only the role title is
            data, so only it gets a skeleton crumb. */}
        <PageBreadcrumbRow
          eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { skeleton: true },
            { label: t("title") },
          ]}
        />
        <div className="space-y-4">
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
      <div className={RATE_COLUMN}>
        <PageBreadcrumbRow
          eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { label: t("title") },
          ]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("title")}</EmptyTitle>
            <EmptyDescription>{tDetail("notFound")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/roles"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {tDetail("backToRoles")}
          </Link>
        </Empty>
      </div>
    )
  }
  // The model must be approved before any role can be rated (ADR-0023): state
  // the precondition in words and send the admin to where it is resolved,
  // rather than letting setRating fail silently on the first save attempt.
  if (!model.approved) {
    return (
      <div className={RATE_COLUMN}>
        <PageBreadcrumbRow
          eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { label: role.title, href: `/roles/${role.slug}` },
            { label: t("title") },
          ]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("title")}</EmptyTitle>
            <EmptyDescription>
              {t("modelUnapprovedExplanation")}
            </EmptyDescription>
          </EmptyHeader>
          {/* Resolved through the chapter registry rather than written out:
              the approve control lives in one chapter at a time, and a
              hardcoded path here is what made this link a dead end when it
              moved. */}
          <Link
            href={chapterHref("approval")}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("modelUnapprovedCta")}
          </Link>
        </Empty>
      </div>
    )
  }
  // Locked or not ready to rate: state the precondition here and send the
  // user back to the role page where the controls live.
  if (role.archived || !role.profileComplete) {
    return (
      <div className={RATE_COLUMN}>
        <PageBreadcrumbRow
          eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { label: role.title, href: `/roles/${role.slug}` },
            { label: t("title") },
          ]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("title")}</EmptyTitle>
            <EmptyDescription>
              {role.profileComplete
                ? t("lockedExplanation")
                : tDetail("profileIncomplete")}
            </EmptyDescription>
          </EmptyHeader>
          <Link
            href={`/roles/${role.slug}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("result.backToRole")}
          </Link>
        </Empty>
      </div>
    )
  }

  // Completion state is not yet known: wait rather than flash the stepper for
  // a role that turns out to already be completed a moment later. `result` is only ever null for a garbage/missing
  // role id, which cannot happen here (getRoleBySlug above already resolved
  // this exact role), so null is treated the same as still-loading.
  if (result == null) {
    return (
      <div className={cn(RATE_COLUMN, "flex items-center justify-center p-6")}>
        <Spinner aria-label={t("result.computing")} />
      </div>
    )
  }

  // Already completed, whether from before this visit or from the last step
  // just now: the route states it in words and shows the reveal as the
  // confirmation (spec 2.4/6, completion is the reveal), with Re-evaluate as
  // the one-press way back into editing. RatingResult is a pure reveal; this
  // host owns the surrounding nav.
  if (result.completed) {
    return (
      <div className={RATE_COLUMN}>
        {/* Every state of this route carries the same trail and the same stage
          label: the two that did not (the reveal and the completion panel)
          were the two where an assessor is deepest in the work and most in
          need of knowing which stage they are in. The trail names no results
          surface: /work is the level matrix, so its crumb comes off this
          route entirely (deviation 10). */}
        <PageBreadcrumbRow
          eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { label: role.title, href: `/roles/${role.slug}` },
            { label: t("title") },
          ]}
        />
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t("alreadyCompletedExplanation")}
          </p>
          <RatingResult orgId={orgId} roleId={role.roleId} />
          <div className="flex flex-wrap items-center gap-2">
            <ReopenAssessmentButton orgId={orgId} roleId={role.roleId} />
            <Link
              href={`/roles/${role.slug}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("result.backToRole")}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // No completion screen between the last criterion and the reveal. The
  // stepper's own last step completes the assessment, so the branch above
  // takes the screen the moment the result turns readable; a role whose
  // criteria are all rated and which is still not completed (a reopened one,
  // normally) resumes at that last step, one press from its ending.

  return (
    <div className={RATE_COLUMN}>
      <PageBreadcrumbRow
        eyebrow={<StageEyebrow label={t("stageEyebrow")} />}
        segments={[
          { label: tNav("roles"), href: "/roles" },
          { label: role.title, href: `/roles/${role.slug}` },
          { label: t("title") },
        ]}
      />
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
      />
    </div>
  )
}
