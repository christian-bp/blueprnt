"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"

// Vertical band ladder: one lane per band, Band 1 (highest) on top. Roles wrap
// as chips inside their lane (getResults already sorts by weighting desc within
// a band). Empty bands stay visible so the full band structure always reads.
//
// With groupByFamily on, the chips inside each band lane cluster by family: a
// full-width family label (family A-Z, family-less last) precedes that family's
// chips. The chips live in ONE container per lane and keep their keys across
// the toggle, so flipping the grouping re-flows them to their new positions
// with a layout animation while the labels fade in/out. Chips use
// layout="position" so the move never scales/warps their text (ui-animation.md
// rule 1); the shared layoutId also animates a role between lanes when its band
// changes.
export function BandLadder({
  bands,
  rows,
  groupByFamily = false,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
  groupByFamily?: boolean
}) {
  const t = useTranslations("dashboard.bands")
  const tFamily = useTranslations("dashboard.roles.family")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)

  const renderChip = (role: BandRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`ladder-${role.roleId}`}
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <RoleChip role={role} />
    </motion.div>
  )

  // No exit on the label: a full-width label that lingered (fading) while it
  // still occupied its row would make the chips below it reflow in two phases
  // on ungroup (move, pause, finish). Unmounting it instantly lets the chips
  // do a single smooth FLIP to their flat positions. It still fades in on
  // group, where a freshly mounted row reserves its space immediately.
  const familyLabel = (key: string, name: string) => (
    <motion.div
      key={`fam-${key}`}
      layout="position"
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full pt-1 text-muted-foreground text-xs"
    >
      {name}
    </motion.div>
  )

  return (
    <ul className="space-y-2">
      {ranges.map((range) => {
        const inBand = placed.filter((row) => row.band === range.band)
        return (
          <li key={range.band} className="rounded-xl border p-3">
            <div className="flex gap-4">
              <div className="w-28 shrink-0">
                <div className="font-semibold text-sm">
                  {t("bandRow", { band: range.band })}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t("roleCount", { count: inBand.length })}
                </div>
              </div>
              <div className="relative flex flex-1 flex-wrap items-start gap-2">
                {inBand.length === 0 ? (
                  // Empty band: a subtle diagonal-hatch placeholder (the
                  // band's "0 roles" count in the rail carries the wording).
                  // var(--border) adapts per theme, so one class covers light
                  // and dark.
                  <div
                    role="img"
                    aria-label={t("bandEmpty")}
                    className="h-8 w-full rounded-md bg-[repeating-linear-gradient(-60deg,var(--border),var(--border)_1px,transparent_1px,transparent_6px)]"
                  />
                ) : (
                  <AnimatePresence initial={false} mode="popLayout">
                    {groupByFamily
                      ? groupRowsByFamily(inBand).flatMap((group) => [
                          familyLabel(
                            group.familyId ?? "none",
                            group.familyName ?? tFamily("none")
                          ),
                          ...group.rows.map(renderChip),
                        ])
                      : inBand.map(renderChip)}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
