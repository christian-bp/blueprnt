"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"

// The fixed V1 track order (ADR-0006). Columns are the tracks PRESENT in the
// filtered rows, sorted by this order; unknown future keys sort last.
const TRACK_ORDER: Record<string, number> = { IC: 0, Lead: 1, M: 2 }

// Band x track matrix: bands down (Band 1 on top), tracks across. Each role
// sits in the cell where its band meets its track, so the view shows how far
// each track reaches. Same neutral-ink chips and inline anchor treatment as
// the ladder. With groupByFamily on, the roles inside each cell cluster by
// family (label + that family's chips); the chips keep their keys across the
// toggle and flip to their new positions (layout="position"), labels fade.
export function BandMatrix({
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
  const tracks = [
    ...new Map(placed.map((row) => [row.trackKey, row.trackName])).entries(),
  ]
    .sort((a, b) => (TRACK_ORDER[a[0]] ?? 99) - (TRACK_ORDER[b[0]] ?? 99))
    .map(([key, name]) => ({ key, name }))

  const renderChip = (role: BandRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`matrix-${role.roleId}`}
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <RoleChip role={role} />
    </motion.div>
  )

  // No exit on the label (see BandLadder): unmounting it instantly on ungroup
  // lets the cell's chips reflow in a single smooth FLIP instead of two phases.
  const familyLabel = (key: string, name: string) => (
    <motion.div
      key={`fam-${key}`}
      layout="position"
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-[10px] text-muted-foreground uppercase tracking-wide"
    >
      {name}
    </motion.div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            <th scope="col" className="w-24" />
            {tracks.map((track) => (
              <th
                key={track.key}
                scope="col"
                title={track.name}
                className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
              >
                {track.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => (
            <tr key={range.band}>
              <th scope="row" className="text-left align-middle font-normal">
                <div className="whitespace-nowrap font-semibold text-sm">
                  {t("bandRow", { band: range.band })}
                </div>
              </th>
              {tracks.map((track) => {
                const cell = placed.filter(
                  (row) => row.band === range.band && row.trackKey === track.key
                )
                return (
                  <td
                    key={track.key}
                    className="min-w-32 rounded-lg border p-2 align-top"
                  >
                    <div className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {groupByFamily
                          ? groupRowsByFamily(cell).flatMap((group) => [
                              familyLabel(
                                group.familyId ?? "none",
                                group.familyName ?? tFamily("none")
                              ),
                              ...group.rows.map(renderChip),
                            ])
                          : cell.map(renderChip)}
                      </AnimatePresence>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
