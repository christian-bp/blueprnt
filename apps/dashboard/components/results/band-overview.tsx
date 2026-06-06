"use client"

import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { SPRING } from "@/lib/motion"
import { bandCounts } from "@/lib/results"

// Band distribution: one row per band, Band 1 (highest) on top. Bars animate
// to their width with the shared spring; reduced motion is honoured globally
// via MotionConfig. Counts only, never scores or weights.
export function BandOverview({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: { band: number | null }[]
}) {
  const t = useTranslations("dashboard.results")
  const counts = bandCounts(bands, rows)
  const max = Math.max(1, ...counts.map((entry) => entry.count))

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-sm">{t("bandsHeading")}</h3>
        <p className="text-muted-foreground text-sm">{t("bandHighest")}</p>
      </div>
      <ul className="space-y-1.5">
        {counts.map((entry) => (
          <li key={entry.band} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-muted-foreground text-sm">
              {t("bandRow", { band: entry.band })}
            </span>
            <span className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-sm bg-primary/70"
                initial={false}
                animate={{ width: `${(entry.count / max) * 100}%` }}
                transition={SPRING}
              />
            </span>
            <span className="w-20 shrink-0 text-right text-muted-foreground text-sm tabular-nums">
              {t("roleCount", { count: entry.count })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
