"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"

// Compact method-documentation progress for the overview side column. Reads the
// same getMethodModel query the To-do derives from (Convex dedupes identical
// calls, so no extra network). undefined = loading (skeleton); null = no model
// (render nothing). Not a resurrected count card: it shows progress, not a bare
// total.
export function ModelReadinessCard({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.overview.modelReadiness")
  const locale = useLocale()
  const method = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })

  if (method === undefined) {
    // The title and CTA link are static i18n text, so they render for real;
    // bars stand in for the progress lines (their counts are the data).
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Progress value={0} />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Progress value={0} />
          </div>
          <Link
            href="/model/method"
            className="inline-block text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {t("cta")}
          </Link>
        </CardContent>
      </Card>
    )
  }
  if (method === null) return null

  const { documented, approved, total } = method.progress
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1.5">
          <span className="text-muted-foreground">
            {t("documented", { documented, total })}
          </span>
          <Progress value={pct(documented)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground">
            {t("approved", { approved, total })}
          </span>
          <Progress value={pct(approved)} />
        </div>
        <Link
          href="/model/method"
          className="inline-block text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("cta")}
        </Link>
      </CardContent>
    </Card>
  )
}
