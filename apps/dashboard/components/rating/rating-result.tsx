"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { SPRING } from "@/lib/motion"

// The reveal step after the last criterion: the FIRST place score and band
// outcome become visible (assessment glossary blindness). Live query: the
// result derives from current model + ratings, nothing is stored.
export function RatingResult({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.rating.result")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  if (result === undefined || result === null || !result.complete) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("computing")} />
      </main>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("heading")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-8">
              <div>
                <p className="text-muted-foreground text-sm">
                  {t("scoreLabel")}
                </p>
                <p className="font-semibold text-4xl tabular-nums">
                  {t("scoreOutOf", { score: result.score ?? 0 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">
                  {t("bandLabel")}
                </p>
                <Badge className="text-base">{result.band}</Badge>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{t("bandHighest")}</p>
            <Button asChild>
              <Link href={`/roles/${roleId}`}>{t("backToRole")}</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
