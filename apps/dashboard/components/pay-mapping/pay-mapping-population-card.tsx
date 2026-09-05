"use client"

import { UserGroupIcon } from "@hugeicons/core-free-icons"
import { useFormatter, useTranslations } from "next-intl"
import { Sparkline } from "@/components/sparkline"
import { StatBar, WidgetCard } from "@/components/widget-card"
import { populationTrend } from "./pay-mapping-trends"
import { usePayMappingRun } from "./pay-mapping-run-context"

// How many people this mapping covers, and how that compares with the
// mapping before it. Both numbers are frozen onto the run rows at snapshot
// time, so the whole card reads from subscriptions the run shell already
// holds; nothing here costs a query.
//
// The comparison is the tile's one qualifying line, spelled out with its
// amount ("25 people fewer than 2026"), not a pill beside the mark. A pill
// left the amount and what it was measured against as two fragments that
// only mean something together, which is why it needed a screen-reader-only
// sentence rewriting it as one; the line is that sentence, so everyone
// reads it.
//
// No verdict colour on the direction: a workforce that shrank by three is
// not a worse pay mapping, so green/red would assert a judgement the number
// does not carry.
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
        value={<StatBar className="h-7 w-16" />}
        note={<StatBar className="h-4 w-36" />}
      />
    )
  }

  const { count, previous, delta, points } = populationTrend(run, runsList)

  return (
    <WidgetCard
      title={t("detail.population")}
      icon={UserGroupIcon}
      value={count}
      // The headcounts behind the figure, oldest first: how the population
      // has moved across the org's mappings, at the size of a word.
      trailing={
        <Sparkline
          values={points}
          variant="area"
          label={t("detail.population")}
          formatValue={(count) => format.number(count)}
        />
      }
      note={
        previous === null || delta === null
          ? tOverview("populationFirstRun")
          : delta === 0
            ? tOverview("deltaUnchanged")
            : tOverview(
                delta > 0 ? "populationDeltaMore" : "populationDeltaFewer",
                { count: Math.abs(delta) }
              )
      }
    />
  )
}
