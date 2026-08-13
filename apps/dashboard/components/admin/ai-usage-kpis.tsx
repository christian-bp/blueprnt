"use client"

import {
  Building01Icon,
  ChartLineData01Icon,
  ChatSparkIcon,
  Coins01Icon,
  MicrochipIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { StatBar, WidgetCard } from "@/components/widget-card"
import {
  formatUsdCost,
  momChangePct,
  type AiUsageTotals,
} from "@/lib/admin-ai-usage"
import { signedPercentText } from "@/lib/percent"

// One tile of the 5-tile KPI strip: the label, the figure, then the note
// under it. Mirrors overview-widgets.tsx's StatTile (a bar in the same slot
// while `value` has not resolved, so the strip never changes height on
// arrival), but with no href: these tiles summarize the page below them
// rather than linking elsewhere.
function KpiTile({
  label,
  icon,
  value,
  note,
}: {
  label: string
  icon: IconSvgElement
  value: ReactNode | undefined
  note: ReactNode
}) {
  return (
    <WidgetCard
      title={label}
      icon={icon}
      value={value ?? <StatBar className="h-7 w-16" />}
      note={value === undefined ? <StatBar className="h-4 w-28" /> : note}
    />
  )
}

// The month-over-month tile's value: undefined while loading, the localized
// no-baseline text when there is nothing to compare against, or the signed
// percent otherwise. A small function rather than a nested ternary so each
// branch narrows cleanly (the signedPercentText call needs a plain
// `number`, not `number | null`).
function momDisplay(
  totals: AiUsageTotals | undefined,
  t: ReturnType<typeof useTranslations<"dashboard.admin.aiUsage.kpi">>,
  format: ReturnType<typeof useFormatter>
): string | undefined {
  if (totals === undefined) return undefined
  const mom = momChangePct(totals)
  if (mom === null) return t("momChangeNoBaseline")
  return signedPercentText(mom, format)
}

// The overview's 5-figure KPI strip: total cost, total calls, total tokens,
// the cost's month-over-month change, and how many organizations used AI at
// all this period. Every figure is derived from the same rows the chart and
// table read (lib/admin-ai-usage.ts), so the three surfaces can never
// disagree; `totals` is undefined while the query loads.
export function AiUsageKpis({ totals }: { totals: AiUsageTotals | undefined }) {
  const t = useTranslations("dashboard.admin.aiUsage.kpi")
  const format = useFormatter()
  const locale = useLocale()

  // The signed percent already carries its own direction (+/-), which is
  // why this tile needs no separate arrow: lib/percent.ts's signedPercentText
  // exists for exactly this "the sign IS the reading" case.
  const momValue = momDisplay(totals, t, format)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        label={t("costLabel")}
        icon={Coins01Icon}
        value={
          totals === undefined
            ? undefined
            : formatUsdCost(totals.costNanos, locale)
        }
        note={t("costNote")}
      />
      <KpiTile
        label={t("callsLabel")}
        icon={ChatSparkIcon}
        value={
          totals === undefined ? undefined : format.number(totals.callCount)
        }
        note={t("callsNote")}
      />
      <KpiTile
        label={t("tokensLabel")}
        icon={MicrochipIcon}
        value={
          totals === undefined ? undefined : format.number(totals.totalTokens)
        }
        note={t("tokensNote")}
      />
      <KpiTile
        label={t("momChangeLabel")}
        icon={ChartLineData01Icon}
        value={momValue}
        note={t("momChangeNote")}
      />
      <KpiTile
        label={t("activeOrgsLabel")}
        icon={Building01Icon}
        value={
          totals === undefined
            ? undefined
            : format.number(totals.activeOrgCount)
        }
        note={t("activeOrgsNote")}
      />
    </div>
  )
}
