"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"

// Band x track matrix: bands down (Band 1 on top), tracks across. Each role
// sits in the cell where its band meets its track. The track columns are
// passed in (derived from the UNFILTERED roles) so the grid stays stable as
// the family filter changes: hidden families just leave hatched empty cells
// rather than collapsing the grid (and an all-hidden filter still shows the
// full hatched grid). Same neutral-ink chips, inline anchor treatment, and
// group-by-family clustering as the ladder.
export function BandMatrix({
  bands,
  rows,
  tracks,
  groupByFamily = false,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
  tracks: { key: string; name: string }[]
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
                // The visible header is the short key (IC / Lead / M); give
                // screen readers the full track name as the accessible name
                // (title alone is not reliably announced).
                aria-label={track.name}
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
                    // relative so the empty-cell hatch can fill the cell via
                    // absolute positioning: a percentage height on a <td> child
                    // does not resolve, but `absolute inset-*` against the
                    // relative cell does, so the hatch stretches to the full row
                    // height set by the tallest sibling cell.
                    className="relative min-w-32 rounded-lg border p-2 align-top"
                  >
                    {cell.length === 0 ? (
                      // Empty cell: a diagonal-hatch placeholder that fills the
                      // whole cell (matching a tall sibling, e.g. a 3-role
                      // track). The spacer floors the row height when the entire
                      // band row is empty; the absolute hatch then stretches to
                      // whatever height the row ends up being. Decorative (the
                      // row and column headers carry the band and track).
                      <>
                        <div aria-hidden="true" className="min-h-8" />
                        <div
                          aria-hidden="true"
                          className="absolute inset-2 rounded-md bg-[repeating-linear-gradient(-60deg,var(--border),var(--border)_1px,transparent_1px,transparent_6px)]"
                        />
                      </>
                    ) : (
                      // popLayout: chips the family filter removes pop out of
                      // flow so the survivors reflow in a single pass instead
                      // of two (docs/ui-animation.md rule 6); relative anchors
                      // the popped chips within the cell.
                      <div className="relative flex flex-col gap-2">
                        <AnimatePresence initial={false} mode="popLayout">
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
                    )}
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
