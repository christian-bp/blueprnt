"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"

// The fixed V1 track order (ADR-0006). Columns are the tracks PRESENT in the
// filtered rows, sorted by this order; unknown future keys sort last.
const TRACK_ORDER: Record<string, number> = { IC: 0, Lead: 1, M: 2 }

// Band x track matrix: bands down (Band 1 on top), tracks across. Each role
// sits in the cell where its band meets its track, so the view shows how far
// each track reaches. Same neutral-ink chips and inline anchor treatment as
// the ladder.
export function BandMatrix({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
}) {
  const t = useTranslations("dashboard.bands")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)
  const tracks = [
    ...new Map(placed.map((row) => [row.trackKey, row.trackName])).entries(),
  ]
    .sort((a, b) => (TRACK_ORDER[a[0]] ?? 99) - (TRACK_ORDER[b[0]] ?? 99))
    .map(([key, name]) => ({ key, name }))

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
                        {cell.map((role) => (
                          <motion.div
                            key={role.roleId}
                            layout
                            layoutId={`matrix-${role.roleId}`}
                            transition={SPRING}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <RoleChip role={role} />
                          </motion.div>
                        ))}
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
