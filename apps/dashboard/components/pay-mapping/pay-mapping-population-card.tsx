"use client"

import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import { WidgetCard } from "@/components/widget-card"
import { populationTrend } from "./pay-mapping-population"
import { usePayMappingRun } from "./pay-mapping-run-context"

// How many people this mapping covers, and how that compares with the
// mapping before it. Both numbers are frozen onto the run rows at snapshot
// time, so the whole card reads from subscriptions the run shell already
// holds; nothing here costs a query.
//
// The delta pill is deliberately NOT a verdict colour. A workforce that
// shrank by three is not a worse pay mapping, so green/red would assert a
// judgement the number does not carry; the direction rides on an arrow
// instead, which also survives greyscale.
export function PayMappingPopulationCard() {
  const t = useTranslations("dashboard.payMapping")
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const format = useFormatter()
  const { run, runsList } = usePayMappingRun()

  if (run === undefined || runsList === undefined) {
    return (
      <WidgetCard
        title={t("detail.population")}
        icon={UserGroupIcon}
        value={
          <span className="flex items-center">
            <Skeleton className="h-7 w-16" />
          </span>
        }
        footer={
          <span className="flex items-center">
            <Skeleton className="h-4 w-28" />
          </span>
        }
      />
    )
  }

  const { count, previous, delta } = populationTrend(run, runsList)

  if (previous === null || delta === null) {
    return (
      <WidgetCard
        title={t("detail.population")}
        icon={UserGroupIcon}
        value={count}
        footer={tOverview("populationFirstRun")}
      />
    )
  }

  if (delta === 0) {
    return (
      <WidgetCard
        title={t("detail.population")}
        icon={UserGroupIcon}
        value={count}
        footer={tOverview("populationDeltaNone", { label: previous.label })}
      />
    )
  }

  const rising = delta > 0
  return (
    <WidgetCard
      title={t("detail.population")}
      icon={UserGroupIcon}
      value={count}
      headerExtra={
        <>
          {/* One sentence for a screen reader, the split visual for everyone
              else: read out, "+3" and "vs 2025" are two fragments that only
              mean something together. */}
          <span className="sr-only">
            {tOverview(
              rising ? "populationDeltaMore" : "populationDeltaFewer",
              {
                count: Math.abs(delta),
                label: previous.label,
              }
            )}
          </span>
          <Badge aria-hidden="true" variant="outline" className="tabular-nums">
            <HugeiconsIcon
              icon={rising ? ArrowUpRight01Icon : ArrowDownRight01Icon}
              strokeWidth={2}
            />
            {format.number(delta, { signDisplay: "exceptZero" })}
          </Badge>
        </>
      }
      footer={
        <span aria-hidden="true">
          {tOverview("populationDeltaVs", { label: previous.label })}
        </span>
      }
    />
  )
}
