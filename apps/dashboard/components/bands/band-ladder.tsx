"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"

// Vertical band ladder: one lane per band, Band 1 (highest) on top. Roles
// wrap as chips inside their lane, ordered by the incoming order (getResults
// already sorts by weighting desc within a band). Empty bands stay visible so
// the full band structure always reads. Chips animate to their new lane when
// a role's band changes (layoutId), per docs/ui-animation.md.
export function BandLadder({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
}) {
  const t = useTranslations("dashboard.bands")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)

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
              <div className="flex flex-1 flex-wrap gap-2">
                {inBand.length === 0 ? (
                  <span className="self-center text-muted-foreground text-sm italic">
                    {t("bandEmpty")}
                  </span>
                ) : (
                  <AnimatePresence initial={false}>
                    {inBand.map((role) => (
                      <motion.div
                        key={role.roleId}
                        layout
                        layoutId={`ladder-${role.roleId}`}
                        transition={SPRING}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <RoleChip role={role} />
                      </motion.div>
                    ))}
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
