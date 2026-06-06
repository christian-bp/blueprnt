"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Rating progress + the entry point into the blind stepper. Deliberately
// shows progress only: which values were given lives in the result card
// after completion, never here (blindness).
export function RoleRatingCard({
  roleId,
  status,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
}: {
  roleId: string
  status: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
}) {
  const t = useTranslations("dashboard.roles.detail")
  const locked = status === "approved" || archived
  const ctaLabel =
    ratedCount === 0
      ? t("rateCta")
      : ratedCount < totalCriteria
        ? t("resumeRateCta")
        : t("adjustRateCta")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ratingHeading")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {t("ratingProgress", { rated: ratedCount, total: totalCriteria })}
        </p>
        <Progress
          value={totalCriteria === 0 ? 0 : (ratedCount / totalCriteria) * 100}
        />
        {!locked &&
          (profileComplete ? (
            <Button asChild>
              <Link href={`/roles/${roleId}/rate`}>{ctaLabel}</Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("profileIncomplete")}
            </p>
          ))}
      </CardContent>
    </Card>
  )
}
