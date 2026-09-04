"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { FrameCard, FrameCardSection } from "@/components/frame-card"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { RoleEvaluationSkeleton } from "@/components/roles/role-evaluation-skeleton"
import { RolePeopleCardSkeleton } from "@/components/roles/role-people-card"
import { ActionsMenuTrigger } from "@/components/actions-menu-trigger"

// Content-shaped loading state for the role page: the real layout (header,
// profile frame, evaluation rail) with the static chrome rendered for real
// (frame titles and field labels are i18n text, not data) and skeleton bars
// standing in only for the role's own values, so the structure appears
// instantly and nothing reflows when the data arrives.

// A data-driven frame title, in the line box the register-sized heading
// occupies (text-lg leads at 28px), so the header measures the same before
// and after the name arrives.
function TitleBar({ className }: { className: string }) {
  return (
    <span className="flex h-7 items-center">
      <Skeleton className={`h-5 ${className}`} />
    </span>
  )
}

// A read-view field: its real label over a value bar centered in the value
// text's line box (text-sm line height), the same centering trick as
// TableSkeleton so the loaded value does not shift the layout.
function FieldSkeleton({ label, bar }: { label: string; bar: string }) {
  return (
    <div className="space-y-1">
      {/* The real field reserves a h-6 line for its label (the row that can
          carry a help button), so the skeleton reserves it too. */}
      <div className="flex h-6 items-center">
        <Label className="text-muted-foreground">{label}</Label>
      </div>
      <div className="flex min-h-5 items-center">
        <Skeleton className={`h-4 ${bar}`} />
      </div>
    </div>
  )
}

export function RoleDetailSkeleton({
  criteriaCount,
}: {
  // The model's criterion count, when the model's own query has already
  // answered. It decides how many contribution rows the evaluation rail
  // stands in with, which is the tallest guess on the page.
  criteriaCount?: number
} = {}) {
  const t = useTranslations("dashboard.roles.detail")
  const tNav = useTranslations("dashboard.nav")
  const tRole = useTranslations("assessment.role")
  const tCreate = useTranslations("dashboard.roles.create")
  const tModel = useTranslations("model")

  return (
    <div className="space-y-6">
      <PageBreadcrumbRow
        // The ancestor crumbs are static; the title crumb joins with the
        // data, so a skeleton crumb holds its place.
        segments={[
          { label: tNav("work"), href: "/work" },
          { label: tNav("roles"), href: "/roles" },
          { skeleton: true },
        ]}
        actions={<Skeleton className="h-5 w-20 rounded-full" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FrameCard
            // The role's own name is the card's title, and it arrives with
            // the data: a bar in the line box the heading occupies, so the
            // header cannot change height when the name lands.
            title={<TitleBar className="w-48" />}
            titleLevel="h2"
            size="lg"
            toolbar={
              // The real actions trigger (static chrome, enabled no-op: the
              // load is brief and disabling would just flash gray).
              <ActionsMenuTrigger
                size="icon-sm"
                aria-label={t("profileActions")}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
              </ActionsMenuTrigger>
            }
          >
            <FrameCardSection>
              <div className="grid gap-4 sm:grid-cols-4">
                <FieldSkeleton
                  label={tModel("roleFamily")}
                  bar="w-24 max-w-full"
                />
                <FieldSkeleton
                  label={tRole("function")}
                  bar="w-24 max-w-full"
                />
                <FieldSkeleton label={tRole("team")} bar="w-20 max-w-full" />
                <FieldSkeleton
                  label={tCreate("trackLabel")}
                  bar="w-20 max-w-full"
                />
              </div>
            </FrameCardSection>
            <FrameCardSection>
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  {tRole("purpose")}
                </Label>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  {tRole("responsibilities")}
                </Label>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </FrameCardSection>
          </FrameCard>
        </div>
        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          {/* Which state the evaluation frame lands in is not known until the
              role's ratings arrive, so the rail stands in as the completed
              one: it is both the common state on a role page and the tallest,
              and it is the state the body below already draws. That is why
              there is no bar in the foot either. A completed frame has no
              foot, and standing in with one made the rail 39px too short in
              exactly the state it was drawing. */}
          <FrameCard
            title={t("evaluationHeading")}
            titleLevel="h2"
            size="lg"
            toolbar={
              <ActionsMenuTrigger
                size="icon-sm"
                aria-label={t("evaluationActions")}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
              </ActionsMenuTrigger>
            }
          >
            <FrameCardSection>
              <RoleEvaluationSkeleton criteriaCount={criteriaCount} />
            </FrameCardSection>
          </FrameCard>
        </div>
      </div>
      {/* The employee list's own loading state, so the frame is already in
          place when the role's data arrives and nothing below it moves. */}
      <RolePeopleCardSkeleton />
    </div>
  )
}
