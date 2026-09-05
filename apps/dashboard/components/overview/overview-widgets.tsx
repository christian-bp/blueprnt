"use client"

import {
  Briefcase01Icon,
  JusticeScale01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Sparkline } from "@/components/sparkline"
import { StatBar, WidgetCard } from "@/components/widget-card"
import type { HeadcountPoint } from "@/lib/headcount-trend"
import type { PayGapPoint } from "@/lib/pay-gap-trend"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import type { LevelOverview } from "@/lib/level-overview"
import { percentText } from "@/lib/percent"
import type { OverviewStats } from "@/lib/todo"

// One tile of the stat strip: the label, the one line that qualifies it, and
// the figure. The line is the tile's live state (what is waiting, what it
// spans), not a standing explainer of what the figure is; these tiles have no
// history to trend against, so it carries a state rather than a movement. A
// figure that has not resolved yet renders as a bar in the same slot, so a
// tile never changes height between its two states.
function StatTile({
  label,
  icon,
  href,
  value,
  caption,
  trailing,
}: {
  label: string
  icon: IconSvgElement
  href: string
  value: ReactNode | undefined
  caption: ReactNode
  // The figure's own history, where one exists. A tile without it is not a
  // defect: roles are not snapshotted over time, so there is nothing to
  // draw, and Sparkline draws nothing under two readings anyway.
  trailing?: ReactNode
}) {
  return (
    <WidgetCard
      title={label}
      icon={icon}
      href={href}
      // The bars sit in the SAME line boxes the loaded type creates, not at
      // their own heights: the figure is text-xl (a 28px line box) and the
      // note text-xs (16px), so bare bars left each tile short and the whole
      // strip grew on arrival.
      value={value ?? <StatBar className="h-7 w-16" />}
      note={value === undefined ? <StatBar className="h-4 w-28" /> : caption}
      trailing={trailing}
    />
  )
}

// The dashboard's stat strip: three figures that say where the organization
// stands, each one line, each linking to its own surface. The two trend
// panels that used to sit below this strip (workforce and pay-gap over time)
// moved into the assistant (AssistantChartPart); a tile here carries one
// number, a history is something the reader now asks the assistant for.
export function OverviewWidgets({
  stats,
  levelOverview,
  payMappingHeadline,
  headcountTrend,
  payGapTrend,
}: {
  stats: OverviewStats | undefined
  levelOverview: LevelOverview | undefined | null
  payMappingHeadline: PayMappingHeadline | undefined | null
  // The histories behind two of the three figures, passed in like every
  // other figure on this strip: the page owns the subscriptions, and both
  // of these derive from the run list it already holds.
  headcountTrend: HeadcountPoint[] | undefined | null
  payGapTrend: PayGapPoint[] | undefined | null
}) {
  const t = useTranslations("dashboard.overview.widgets")
  const format = useFormatter()

  const gapValue =
    payMappingHeadline === undefined
      ? undefined
      : payMappingHeadline === null
        ? t("gap.notStarted")
        : payMappingHeadline.gapPct === null ||
            payMappingHeadline.flag === "insufficient"
          ? t("gap.insufficientValue")
          : percentText(payMappingHeadline.gapPct, format)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatTile
        label={t("workforce.label")}
        icon={UserGroupIcon}
        href="/people"
        value={stats?.totalPeople}
        trailing={
          <Sparkline
            values={(headcountTrend ?? []).map(
              (point) => point.women + point.men
            )}
            variant="area"
            label={t("workforce.label")}
            formatValue={(count) => format.number(count)}
          />
        }
        caption={
          stats === undefined
            ? ""
            : stats.totalPeople === 0
              ? t("workforce.importPrompt")
              : stats.unclassifiedCount > 0
                ? t("workforce.unclassified", {
                    count: stats.unclassifiedCount,
                  })
                : t("workforce.allClassified")
        }
      />
      <StatTile
        label={t("roles.label")}
        icon={Briefcase01Icon}
        href="/roles"
        value={
          levelOverview === undefined
            ? undefined
            : (levelOverview?.totalRoles ?? 0)
        }
        caption={
          levelOverview === undefined || levelOverview === null
            ? t("roles.empty")
            : t("roles.caption", { count: levelOverview.levelCount })
        }
      />
      <StatTile
        label={t("gap.label")}
        icon={JusticeScale01Icon}
        href={
          payMappingHeadline === undefined || payMappingHeadline === null
            ? "/pay-mappings"
            : `/pay-mappings/${payMappingHeadline.slug}`
        }
        value={gapValue}
        trailing={
          <Sparkline
            values={(payGapTrend ?? [])
              .map((point) => point.gapPct)
              .filter((pct): pct is number => pct !== null)}
            variant="area"
            label={t("gap.label")}
            formatValue={(pct) => percentText(pct, format)}
          />
        }
        caption={
          payMappingHeadline === undefined || payMappingHeadline === null
            ? t("gap.prompt")
            : payMappingHeadline.label
        }
      />
    </div>
  )
}
