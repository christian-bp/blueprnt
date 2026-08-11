"use client"

import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { WidgetCard } from "@/components/widget-card"
import { populationTrend } from "./pay-mapping-trends"
import { usePayMappingRun } from "./pay-mapping-run-context"

// How many people this mapping covers, and how that compares with the
// mapping before it. Both numbers are frozen onto the run rows at snapshot
// time, so the whole card reads from subscriptions the run shell already
// holds; nothing here costs a query.
//
// The comparison is the footer's STATEMENT line, spelled out with its amount
// ("25 people fewer than 2025"), not a pill beside the icon chip. A pill left
// the amount and what it was measured against as two fragments that only mean
// something together, which is why it needed a screen-reader-only sentence
// rewriting it as one; the statement is that sentence, so everyone reads it.
//
// The direction rides on an arrow rather than a verdict colour: a workforce
// that shrank by three is not a worse pay mapping, so green/red would assert
// a judgement the number does not carry. The arrow also survives greyscale.
export function PayMappingPopulationCard() {
  const t = useTranslations("dashboard.payMapping")
  const tOverview = useTranslations("dashboard.payMapping.overview")
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
            <Skeleton className="h-4 w-36" />
          </span>
        }
        note={
          <span className="flex items-center">
            <Skeleton className="h-4 w-28" />
          </span>
        }
      />
    )
  }

  const { count, previous, delta } = populationTrend(run, runsList)
  const note = tOverview("populationNote")

  if (previous === null || delta === null || delta === 0) {
    return (
      <WidgetCard
        title={t("detail.population")}
        icon={UserGroupIcon}
        value={count}
        footer={
          previous === null || delta === null
            ? tOverview("populationFirstRun")
            : tOverview("deltaUnchanged", { label: previous.label })
        }
        note={note}
      />
    )
  }

  const rising = delta > 0
  return (
    <WidgetCard
      title={t("detail.population")}
      icon={UserGroupIcon}
      value={count}
      footer={tOverview(
        rising ? "populationDeltaMore" : "populationDeltaFewer",
        { count: Math.abs(delta), label: previous.label }
      )}
      footerIcon={rising ? ArrowUpRight01Icon : ArrowDownRight01Icon}
      note={note}
    />
  )
}
