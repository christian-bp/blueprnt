"use client"

import {
  Briefcase01Icon,
  ChartHistogramIcon,
  JusticeScale01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { StatBar, WidgetCard } from "@/components/widget-card"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import type { LevelOverview } from "@/lib/level-overview"
import { percentText } from "@/lib/percent"
import type { OverviewStats } from "@/lib/todo"

// One tile of the stat strip: the label, the figure it labels, then the two
// lines that qualify it, in that order down the card. `caption` is the
// statement (what state the figure is in) and `note` says what the figure
// counts; these tiles have no history to trend against, so the statement
// carries a state rather than a movement. A figure that has not resolved yet
// renders as a bar in the same slot, so a tile never changes height between
// its two states.
function StatTile({
  label,
  icon,
  href,
  value,
  caption,
  note,
}: {
  label: string
  icon: IconSvgElement
  href: string
  value: ReactNode | undefined
  caption: ReactNode
  note: ReactNode
}) {
  return (
    <WidgetCard
      title={label}
      icon={icon}
      href={href}
      // The bars sit in the SAME line boxes the loaded type creates, not at
      // their own heights: CardTitle is leading-normal at text-2xl/text-3xl
      // (36-45px) and the footer lines are text-sm (20px), so bare h-8/h-4
      // bars left each tile short and the whole strip grew on arrival.
      value={value ?? <StatBar className="h-7 w-16" />}
      footer={value === undefined ? <StatBar className="h-4 w-28" /> : caption}
      note={value === undefined ? <StatBar className="h-4 w-24" /> : note}
    />
  )
}

// The dashboard's stat strip: four figures that say where the organization
// stands, each one line, each linking to its own surface. The two trend
// panels that used to sit below this strip (workforce and pay-gap over time)
// moved into the assistant (AssistantChartPart); a tile here carries one
// number, a history is something the reader now asks the assistant for.
export function OverviewWidgets({
  stats,
  levelOverview,
  payMappingHeadline,
}: {
  stats: OverviewStats | undefined
  levelOverview: LevelOverview | undefined | null
  payMappingHeadline: PayMappingHeadline | undefined | null
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label={t("workforce.label")}
        icon={UserGroupIcon}
        href="/people"
        value={stats?.totalPeople}
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
        note={t("workforce.note")}
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
        note={t("roles.note")}
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
        caption={
          payMappingHeadline === undefined || payMappingHeadline === null
            ? t("gap.prompt")
            : payMappingHeadline.label
        }
        note={t("gap.note")}
      />
      <StatTile
        label={t("levels.label")}
        icon={ChartHistogramIcon}
        href="/work"
        value={
          levelOverview === undefined
            ? undefined
            : (levelOverview?.levelCount ?? 0)
        }
        caption={
          levelOverview === undefined || levelOverview === null
            ? t("levels.empty")
            : t("levels.caption", { count: levelOverview.totalRoles })
        }
        note={t("levels.note")}
      />
    </div>
  )
}
