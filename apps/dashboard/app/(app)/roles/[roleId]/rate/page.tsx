"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"

export default function RatePage(props: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = use(props.params)
  const t = useTranslations("dashboard.rating")
  const tDetail = useTranslations("dashboard.roles.detail")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const [finished, setFinished] = useState(false)
  usePageTitle([role?.title, t("title")])

  if (role === undefined || model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("title")} />
      </main>
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
          href={`/roles/${role.roleId}`}
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
        <RatingResult orgId={orgId} roleId={roleId} />
        <Button asChild variant="outline">
          <Link href={`/roles/${roleId}`}>{t("result.backToRole")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-medium text-lg">
        {t("title")}: <span className="text-brand">{role.title}</span>
      </h2>
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
