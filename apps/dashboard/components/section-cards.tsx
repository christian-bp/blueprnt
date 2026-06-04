"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartDownIcon, ChartUpIcon } from "@hugeicons/core-free-icons"
import { useTranslations } from "next-intl"

export function SectionCards() {
  const t = useTranslations("dashboard.cards")

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{t("totalRevenue")}</CardDescription>
          {/* Fixture: $1,250.00 is demo data */}
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <HugeiconsIcon icon={ChartUpIcon} strokeWidth={2} />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("trendingUp")}{" "}
            <HugeiconsIcon
              icon={ChartUpIcon}
              strokeWidth={2}
              className="size-4"
            />
          </div>
          <div className="text-muted-foreground">
            {t("visitorsLast6Months")}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{t("newCustomers")}</CardDescription>
          {/* Fixture: 1,234 is demo data */}
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <HugeiconsIcon icon={ChartDownIcon} strokeWidth={2} />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("down20Period")}{" "}
            <HugeiconsIcon
              icon={ChartDownIcon}
              strokeWidth={2}
              className="size-4"
            />
          </div>
          <div className="text-muted-foreground">
            {t("acquisitionAttention")}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{t("activeAccounts")}</CardDescription>
          {/* Fixture: 45,678 is demo data */}
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <HugeiconsIcon icon={ChartUpIcon} strokeWidth={2} />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("strongRetention")}{" "}
            <HugeiconsIcon
              icon={ChartUpIcon}
              strokeWidth={2}
              className="size-4"
            />
          </div>
          <div className="text-muted-foreground">{t("engagementExceed")}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>{t("growthRate")}</CardDescription>
          {/* Fixture: 4.5% is demo data */}
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <HugeiconsIcon icon={ChartUpIcon} strokeWidth={2} />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("steadyIncrease")}{" "}
            <HugeiconsIcon
              icon={ChartUpIcon}
              strokeWidth={2}
              className="size-4"
            />
          </div>
          <div className="text-muted-foreground">{t("meetsProjections")}</div>
        </CardFooter>
      </Card>
    </div>
  )
}
