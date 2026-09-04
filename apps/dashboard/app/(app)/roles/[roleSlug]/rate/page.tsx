"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Kbd } from "@workspace/ui/components/kbd"
import { Label } from "@workspace/ui/components/label"
import { QuestionnaireActions } from "@workspace/ui/components/questionnaire"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import {
  RATE_COLUMN,
  RATE_NEXT_KBD_CLASS,
  RATE_PREVIOUS_SLOT,
  RATE_PRIMARY_SLOT,
} from "@/lib/rate-column"
import { resolveAnchorSteps } from "@/lib/anchors"
import { groupByFamily } from "@/lib/role-groups"
import { usePageTitle } from "@/hooks/use-page-title"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"
import { ReopenAssessmentButton } from "@/components/rating/reopen-assessment-button"
import { chapterHref } from "@/lib/model-chapters"

export default function RatePage(props: {
  params: Promise<{ roleSlug: string }>
}) {
  const { roleSlug } = use(props.params)
  const t = useTranslations("dashboard.rating")
  const tNav = useTranslations("dashboard.nav")
  const tHelp = useTranslations("dashboard.help")
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
  // The reveal's way onward: once THIS assessment is completed, the next role
  // still waiting for a rating, in the register's own family order, so a
  // rating session never has to route back through the register per role.
  // Skipped in every earlier state, so the rating act itself loads nothing
  // about the rest of the org.
  const completed = result?.completed === true
  const orgRoles = useQuery(
    api.assessment.roles.listRoles,
    completed ? { orgId, locale } : "skip"
  )
  const orgResults = useQuery(
    api.assessment.results.getResults,
    completed ? { orgId, locale } : "skip"
  )
  usePageTitle([role?.title, t("title")])

  if (role === undefined || model === undefined) {
    // Content-shaped loading state mirroring the stepper's own frame: the
    // real title of the shared scale, the real context toggle and the real
    // nav row, with bars only where the criterion's own words go, so nothing
    // reflows when the data arrives.
    return (
      <div className={RATE_COLUMN}>
        {/* The ancestor crumbs are static i18n text; only the role title is
            data, so only it gets a skeleton crumb. */}
        <PageBreadcrumbRow
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { skeleton: true },
            { label: t("title") },
          ]}
        />
        {/* The role-title heading's own silhouette (text-lg line box). */}
        <Skeleton className="h-7 w-56 max-w-full" />
        {/* The position row the flow opens with: how many criteria there are
            is data, so both its halves are bars. */}
        <div className="flex min-h-5 items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-1.5 w-20 rounded-full" />
        </div>
        <FrameCard
          title={<Skeleton className="h-5 w-48 max-w-full" />}
          titleLevel="h3"
          description={<Skeleton className="h-4 w-3/4" />}
          extra={
            <HelpMorphButton label={tHelp("blindRatingLabel")}>
              {tHelp("blindRatingBody")}
            </HelpMorphButton>
          }
          footer={
            // The real nav buttons (static i18n chrome). Disabled is the
            // truthful state here, not a loading effect: the loaded stepper
            // opens with Back disabled on step 1 and the primary disabled
            // until an anchor is picked.
            <QuestionnaireActions>
              <Button
                type="button"
                variant="outline"
                disabled
                className={RATE_PREVIOUS_SLOT}
              >
                {t("backCta")}
              </Button>
              <Button type="button" disabled className={RATE_PRIMARY_SLOT}>
                {t("nextCta")}
                <Kbd
                  data-icon="inline-end"
                  aria-hidden="true"
                  className={RATE_NEXT_KBD_CLASS}
                >
                  ⏎
                </Kbd>
              </Button>
            </QuestionnaireActions>
          }
        >
          {/* Both of the step's panels, at their real sizes: the loaded step
              carries the motivation field under the scale, and standing in
              with the scale alone dropped the foot's own row by the height of
              that panel the moment the criteria arrived. */}
          <FrameCardSection
            title={t("scale.title")}
            help={
              <HelpMorphButton label={tHelp("sharedScaleLabel")}>
                {tHelp("sharedScaleBody")}
              </HelpMorphButton>
            }
          >
            <div>
              <DisclosureToggle
                label={t("contextToggleLabel")}
                open={false}
                onToggle={() => undefined}
              />
            </div>
            {/* An option card is its anchor text: two lines on most criteria,
                three on the long ones, so its height is not knowable before
                the model arrives. The bar stands at the height they average
                to, which lands the panel within a line of where it settles
                instead of a hundred pixels short. */}
            <div className="grid gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <Skeleton key={step} className="h-18 w-full rounded-lg" />
              ))}
            </div>
          </FrameCardSection>
          <FrameCardSection className="space-y-2">
            {/* The label and its rule are static i18n text, so they render
                for real; only the field the rater types into is a bar. */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Label htmlFor="rating-motivation">{t("motivationLabel")}</Label>
              <span className="text-muted-foreground text-sm">
                {t("motivationRule")}
              </span>
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
          </FrameCardSection>
        </FrameCard>
      </div>
    )
  }
  if (role === null || model === null) {
    return (
      <div className={RATE_COLUMN}>
        <PageBreadcrumbRow
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
    // The next role whose rating can start right now: profile ready, no level
    // yet (still being rated, or rated and not completed). Undefined while
    // the two register reads are in flight, so the row below simply gains the
    // link when it resolves (content may extend, nothing shifts).
    const levelByRole = new Map(
      (orgResults?.rows ?? []).map((row) => [
        row.roleId as string,
        row.level ?? null,
      ])
    )
    const nextRole =
      orgRoles === undefined || orgResults === undefined
        ? undefined
        : groupByFamily(orgRoles)
            .flatMap((group) => group.rows)
            .find(
              (candidate) =>
                candidate.slug !== role.slug &&
                candidate.profileComplete &&
                (levelByRole.get(candidate.roleId as string) ?? null) === null
            )
    return (
      <div className={RATE_COLUMN}>
        {/* Every state of this route carries the same trail and the same stage
          label: the two that did not (the reveal and the completion panel)
          were the two where an assessor is deepest in the work and most in
          need of knowing which stage they are in. The trail names no results
          surface: /work is the level matrix, so its crumb comes off this
          route entirely (deviation 10). */}
        <PageBreadcrumbRow
          segments={[
            { label: tNav("roles"), href: "/roles" },
            { label: role.title, href: `/roles/${role.slug}` },
            { label: t("title") },
          ]}
        />
        <div className="space-y-4">
          <h2 className="font-semibold text-lg tracking-tight">{role.title}</h2>
          <p className="text-muted-foreground text-sm">
            {t("alreadyCompletedExplanation")}
          </p>
          <RatingResult
            orgId={orgId}
            roleId={role.roleId}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                {/* The session's continuation leads the row, filled: rating an
                    org is a run of these flows, and the run's next step should
                    not cost a register round-trip. Silent when nothing ratable
                    remains. */}
                {nextRole !== undefined && (
                  <Link
                    href={`/roles/${nextRole.slug}/rate`}
                    className={cn(buttonVariants(), "max-w-full")}
                  >
                    <span className="truncate">
                      {t("result.nextRoleCta", { title: nextRole.title })}
                    </span>
                  </Link>
                )}
                <ReopenAssessmentButton orgId={orgId} roleId={role.roleId} />
                <Link
                  href={`/roles/${role.slug}`}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  {t("result.backToRole")}
                </Link>
              </div>
            }
          />
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
        segments={[
          { label: tNav("roles"), href: "/roles" },
          { label: role.title, href: `/roles/${role.slug}` },
          { label: t("title") },
        ]}
      />
      {/* The role's name as the flow's own heading: an assessor mid-stepper
          reads the surface, not the chrome, so which role is being rated must
          not live only in a crumb. */}
      <h2 className="font-semibold text-lg tracking-tight">{role.title}</h2>
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
          anchors: resolveAnchorSteps(criterion.anchors, model.midpoints),
        }))}
        ratings={role.ratings}
      />
    </div>
  )
}
