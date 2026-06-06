"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { importanceLabelKey } from "@/lib/importance"

// Per-role result breakdown: rating + importance LABEL per criterion. The
// weighted contribution per criterion is deliberately absent: showing it
// would expose the numeric weights (CLAUDE.md rule).
export function RoleResultCard({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const tModel = useTranslations("model")
  const tImportance = useTranslations("model.importance")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  if (result === undefined || result === null || !result.complete) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("resultHeading")}</CardTitle>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-2xl tabular-nums">
            {result.score}
          </span>
          <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {tResult("bandHighest")}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tModel("criterion")}</TableHead>
              <TableHead>{tImportance("label")}</TableHead>
              <TableHead className="text-right">
                {tAssessment("rating")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.criteria.map((row) => (
              <TableRow key={row.criterionId}>
                <TableCell>
                  <div className="space-y-0.5">
                    <p>{row.name}</p>
                    {row.motivation !== null && (
                      <p className="text-muted-foreground text-xs">
                        {row.motivation}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tImportance(importanceLabelKey(row.importanceLevel))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={
                      row.outside
                        ? "text-amber-600 dark:text-amber-500"
                        : undefined
                    }
                  >
                    {row.value}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
