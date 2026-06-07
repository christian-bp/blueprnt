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

// Per-role result breakdown: rating + weight points per criterion, with the
// normalized 0-100 score in the header (ADR-0004). The weighted contribution
// per criterion is deliberately absent: the breakdown reads as ratings
// against criteria, not as an arithmetic worksheet.
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
            {tResult("scoreOutOf", { score: result.score ?? 0 })}
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
              <TableHead>{tModel("weightPoints")}</TableHead>
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
                <TableCell className="text-muted-foreground tabular-nums">
                  {row.weightPoints}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
