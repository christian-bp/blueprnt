"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Kbd } from "@workspace/ui/components/kbd"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeading } from "@/components/page-heading"
import { usePageTitle } from "@/hooks/use-page-title"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"

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
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const [finished, setFinished] = useState(false)
  usePageTitle([role?.title, t("title")])

  if (role === undefined || model === undefined) {
    // Content-shaped loading state mirroring the stepper's layout: heading,
    // the step-progress line, then the criterion card with its 0-5 anchor
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
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <Skeleton key={level} className="h-12 w-full rounded-md" />
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

  // RatingResult is a pure reveal; this host owns the back-to-role nav below
  // it (the onboarding host owns its own back-to-your-roles button instead).
  if (finished) {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <RatingResult orgId={orgId} roleId={role.roleId} />
        <Link
          href={`/roles/${role.slug}`}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("result.backToRole")}
        </Link>
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
        criteria={model.criteria}
        ratings={role.ratings}
        onCompleted={() => setFinished(true)}
      />
    </div>
  )
}
