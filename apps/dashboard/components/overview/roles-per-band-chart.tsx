"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

// Placeholder role-per-band distribution. Wiring to real results (each role's
// band from getResults) is a deferred follow-up; the "Sample" badge makes clear
// these are not live numbers. Bands run 1 (highest) to 9.
const SAMPLE_DATA = [
  { band: "1", roles: 1 },
  { band: "2", roles: 2 },
  { band: "3", roles: 4 },
  { band: "4", roles: 7 },
  { band: "5", roles: 9 },
  { band: "6", roles: 6 },
  { band: "7", roles: 4 },
  { band: "8", roles: 2 },
  { band: "9", roles: 1 },
]

export function RolesPerBandChart() {
  const t = useTranslations("dashboard.overview.chart")
  const config = {
    roles: { label: t("roles"), color: "var(--brand)" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <Badge variant="outline" className="text-muted-foreground">
            {t("sampleBadge")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* aspect-auto overrides the container's default aspect-video so the
            full-width card gets a fixed, reasonable height instead of a tall
            16:9 box. */}
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart accessibilityLayer data={SAMPLE_DATA}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="band"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="roles" fill="var(--color-roles)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
