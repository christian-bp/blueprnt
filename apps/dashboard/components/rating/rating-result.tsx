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

  const warnings = result.criteria.filter((row) => row.outside)

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
                  {result.score}
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
            <div className="space-y-2">
              <p className="font-medium text-sm">{t("guardrailsHeading")}</p>
              {warnings.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("noWarnings")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {warnings.map((row) => (
                    <li
                      key={row.criterionId}
                      className="text-amber-600 text-sm dark:text-amber-500"
                    >
                      {t("guardrailRow", {
                        name: row.name,
                        value: row.value ?? 0,
                        min: row.guardrail?.min ?? 0,
                        max: row.guardrail?.max ?? 0,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button asChild>
              <Link href={`/roles/${roleId}`}>{t("backToRole")}</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
